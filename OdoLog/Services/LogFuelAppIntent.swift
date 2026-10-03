import AppIntents
import Foundation

struct VehicleAppEntity: AppEntity {
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Vehicle")
    static var defaultQuery = VehicleAppEntityQuery()

    let id: UUID
    let name: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }
}

struct VehicleAppEntityQuery: EntityStringQuery {
    @Dependency private var store: OdoLogStore

    @MainActor
    func entities(for identifiers: [UUID]) async throws -> [VehicleAppEntity] {
        store.vehicles
            .filter { identifiers.contains($0.id) }
            .map(VehicleAppEntity.init)
    }

    @MainActor
    func entities(matching string: String) async throws -> [VehicleAppEntity] {
        let query = string.trimmingCharacters(in: .whitespacesAndNewlines)
        return store.vehicles
            .filter { query.isEmpty || $0.displayName.localizedCaseInsensitiveContains(query) }
            .map(VehicleAppEntity.init)
    }

    @MainActor
    func suggestedEntities() async throws -> [VehicleAppEntity] {
        store.vehicles.map(VehicleAppEntity.init)
    }
}

private extension VehicleAppEntity {
    init(_ vehicle: Vehicle) {
        id = vehicle.id
        name = vehicle.displayName
    }
}

/// Appears in the Home Screen long-press menu / Spotlight / Siri — not a WidgetKit widget.
struct LogFuelAppIntent: AppIntent {
    static var title: LocalizedStringResource = "Log fuel"
    static var description = IntentDescription("Open OdoLog and start a new fuel log.")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        QuickActionsRouter.shared.requestLogFuel()
        return .result()
    }
}

struct SetReserveIntent: AppIntent {
    static var title: LocalizedStringResource = "Set reserve"
    static var description = IntentDescription("Switch a vehicle to reserve at an odometer reading.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Vehicle")
    var vehicle: VehicleAppEntity

    @Parameter(title: "Odometer")
    var odometer: Double

    @Dependency private var store: OdoLogStore

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let storedVehicle = store.vehicle(id: vehicle.id) else {
            throw OdoLogError.notFound
        }
        guard storedVehicle.icon.supportsReserveTap, storedVehicle.hasReserve else {
            return .result(dialog: "Reserve is not available for \(storedVehicle.displayName).")
        }

        try store.validateReserveOdometer(odometer, for: storedVehicle.id)
        store.markReserve(
            for: storedVehicle.id,
            at: odometer,
            note: "Switched to reserve with Siri"
        )
        await store.refresh(reportError: false)
        return .result(dialog: "\(storedVehicle.displayName) is now on reserve at \(Format.km(odometer)).")
    }
}

struct MileageIntent: AppIntent {
    static var title: LocalizedStringResource = "Check mileage"
    static var description = IntentDescription("Get a vehicle’s calculated mileage.")

    @Parameter(title: "Vehicle")
    var vehicle: VehicleAppEntity

    @Dependency private var store: OdoLogStore

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        guard let storedVehicle = store.vehicle(id: vehicle.id) else {
            throw OdoLogError.notFound
        }

        guard let kmpl = store.mileageResult(for: storedVehicle.id).kmpl else {
            let message = "There is not enough data to calculate mileage for \(storedVehicle.displayName)."
            return .result(value: message, dialog: IntentDialog(stringLiteral: message))
        }

        let mileage = String(format: "%.1f km/L", kmpl)
        let message = "\(storedVehicle.displayName) is getting \(mileage)."
        return .result(value: mileage, dialog: IntentDialog(stringLiteral: message))
    }
}

struct OdoLogAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LogFuelAppIntent(),
            phrases: [
                "Log fuel in \(.applicationName)",
                "Add a fuel log in \(.applicationName)",
                "Log a fill up in \(.applicationName)",
                "Record fuel in \(.applicationName)",
                "Add petrol in \(.applicationName)",
                "Log diesel in \(.applicationName)",
                "Open fuel log in \(.applicationName)"
            ],
            shortTitle: "Log fuel",
            systemImageName: "fuelpump.fill"
        )
        AppShortcut(
            intent: SetReserveIntent(),
            phrases: [
                "Set reserve in \(.applicationName)",
                "Switch to reserve in \(.applicationName)"
            ],
            shortTitle: "Set reserve",
            systemImageName: "fuelpump"
        )
        AppShortcut(
            intent: MileageIntent(),
            phrases: [
                "What's my mileage in \(.applicationName)",
                "Check my mileage in \(.applicationName)"
            ],
            shortTitle: "Check mileage",
            systemImageName: "gauge.with.dots.needle.50percent"
        )
    }
}
