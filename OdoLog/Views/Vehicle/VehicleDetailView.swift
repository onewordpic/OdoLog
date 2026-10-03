import SwiftUI

@Observable
@MainActor
final class VehicleDetailModel {
    var showLogFuel = false
    var showMaintenance = false
    var showTrip = false
    var vehicleToEdit: Vehicle?
    var editingRefuel: Refuel?
    var editingMaintenance: MaintenanceLog?
    var confirmDelete = false
    var showReserveSheet = false
    var reserveOdo: Double?
    var displayed: Vehicle?
    var totalCostText = "—"
    var fuelCostText = "—"
    var distanceText = "—"
    var kmplText = "—"
    var litresText = "—"
    var costPerKmText: String?
    var monthCpkText: String?
    var lastOdoText: String?
    var lastOdoNumeric: Double?
    var rangeCaption: String?
    var mileageProgressValue: Double = 0
    var droppedMileageReasons: [String] = []
    var reserveEstimate: ReserveRangeEstimate?
    var fills: [Refuel] = []
    var logs: [MaintenanceLog] = []
    var trips: [Trip] = []
    var reserveLog: [ReserveEvent] = []
}

struct VehicleDetailView: View {
    @Environment(OdoLogStore.self) private var store
    @Environment(AppSettings.self) private var settings
    @Environment(\.dismiss) private var dismiss
    let vehicleId: UUID

    @State private var model = VehicleDetailModel()

    init(vehicleId: UUID) {
        self.vehicleId = vehicleId
    }

    init(vehicle: Vehicle) {
        self.vehicleId = vehicle.id
    }

    var body: some View {
        @Bindable var model = model
        Group {
            if let displayed = model.displayed {
                detailScroll(displayed)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(model.displayed?.name ?? "Vehicle")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if let displayed = model.displayed {
                    Button("Edit") { model.vehicleToEdit = displayed }
                }
            }
        }
        .task(id: vehicleId) { await reloadMetrics() }
        .sheet(item: $model.vehicleToEdit, onDismiss: { Task { await reloadMetrics() } }) { editing in
            NavigationStack { EditVehicleSheet(vehicle: editing) }
        }
        .sheet(isPresented: $model.showLogFuel, onDismiss: { Task { await reloadMetrics() } }) {
            if let displayed = model.displayed {
                NavigationStack { LogFuelSheet(vehicle: displayed) }
            }
        }
        .sheet(item: $model.editingRefuel, onDismiss: { Task { await reloadMetrics() } }) { fill in
            if let displayed = model.displayed {
                NavigationStack { LogFuelSheet(vehicle: displayed, existing: fill) }
            }
        }
        .sheet(isPresented: $model.showMaintenance, onDismiss: { Task { await reloadMetrics() } }) {
            if let displayed = model.displayed {
                NavigationStack { MaintenanceSheet(vehicle: displayed) }
            }
        }
        .sheet(item: $model.editingMaintenance, onDismiss: { Task { await reloadMetrics() } }) { log in
            if let displayed = model.displayed {
                NavigationStack { MaintenanceSheet(vehicle: displayed, existing: log) }
            }
        }
        .sheet(isPresented: $model.showTrip, onDismiss: { Task { await reloadMetrics() } }) {
            if let displayed = model.displayed {
                NavigationStack { TripSheet(vehicle: displayed) }
            }
        }
        .sheet(isPresented: $model.showReserveSheet) {
            if let displayed = model.displayed {
                NavigationStack {
                    MarkReserveSheet(vehicle: displayed, initialOdo: model.reserveOdo ?? model.lastOdoNumeric) { odo in
                        store.markReserve(for: displayed.id, at: odo)
                        model.reserveOdo = odo
                        model.reserveLog = store.reserveEvents(for: displayed.id)
                        model.reserveEstimate = store.reserveRange(for: displayed)
                        Task { await ReminderService.reschedule(using: store, enabled: settings.remindersEnabled) }
                    }
                }
            }
        }
        .alert("Delete this vehicle?", isPresented: $model.confirmDelete) {
            Button("Delete", role: .destructive) {
                Task {
                    try? await store.deleteVehicle(vehicleId)
                    dismiss()
                }
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    @ViewBuilder
    private func detailScroll(_ displayed: Vehicle) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VehicleHeroCard(
                    vehicle: displayed,
                    spend: model.totalCostText,
                    onLogFuel: displayed.fuelType.isFuelable ? { model.showLogFuel = true } : nil,
                    onOpen: nil
                )

                HStack(spacing: 12) {
                    StatTile(title: "Fuel cost", value: model.fuelCostText, tint: settings.accentColor)
                    StatTile(title: "Distance", value: model.distanceText, tint: settings.accentTertiary)
                }

                DashCard {
                    HStack(alignment: .center, spacing: 18) {
                        RingProgress(
                            progress: model.mileageProgressValue,
                            value: model.kmplText,
                            caption: "km/L",
                            tint: settings.accentColor
                        )
                        .frame(width: 110, height: 110)
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Efficiency").font(.headline)
                            if model.kmplText == "—" {
                                Text("Not enough data")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            LabeledContent("Fuel used", value: model.litresText)
                            if let claimed = displayed.resolvedClaimedKmpl {
                                LabeledContent("Company claim", value: Format.kmpl(claimed))
                            }
                            if let costPerKmText = model.costPerKmText { LabeledContent("Cost per km", value: costPerKmText) }
                            if let monthCpkText = model.monthCpkText { LabeledContent("This month", value: monthCpkText) }
                            if let lastOdoText = model.lastOdoText { LabeledContent("Last odo", value: lastOdoText) }
                            ForEach(model.droppedMileageReasons, id: \.self) { reason in
                                Label(reason, systemImage: "exclamationmark.triangle")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    if let rangeCaption = model.rangeCaption {
                        Text(rangeCaption)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                DashCard {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("Vehicle").font(.headline)
                            Spacer()
                            Button("Edit") { model.vehicleToEdit = displayed }
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(settings.accentColor)
                        }
                        LabeledContent("Type", value: displayed.icon.title)
                        LabeledContent("Fuel", value: displayed.fuelType.title)
                        if let make = displayed.make, !make.isEmpty { LabeledContent("Make", value: make) }
                        if let year = displayed.modelYear { LabeledContent("Year", value: "\(year)") }
                        if let reg = displayed.regNumber, !reg.isEmpty { LabeledContent("Registration", value: reg) }
                        if displayed.icon.supportsReserveTap {
                            LabeledContent("Reserve tap", value: displayed.hasReserve ? "Yes" : "No")
                        }
                        if displayed.isGuest {
                            LabeledContent("Borrowed", value: displayed.ownerName?.isEmpty == false ? displayed.ownerName! : "Yes")
                        }
                    }
                }

                if displayed.icon.supportsReserveTap && displayed.hasReserve {
                    reserveSection(displayed)
                } else if displayed.icon.supportsReserveTap {
                    DashCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Reserve tap").font(.headline)
                            Text("No reserve tap tracked for this bike. Carbureted bikes often have one; fuel-injected bikes usually don’t. Enable only if yours has a reserve fuel tap.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Button("Enable in Edit") { model.vehicleToEdit = displayed }
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(settings.accentColor)
                        }
                    }
                }

                HStack(spacing: 10) {
                    Button { model.showMaintenance = true } label: {
                        Label("Log service", systemImage: "wrench.and.screwdriver")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Color.primary.opacity(0.06), in: Capsule())
                    }
                    .buttonStyle(.plain)
                    Button { model.showTrip = true } label: {
                        Label("Log trip", systemImage: "road.lanes")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Color.primary.opacity(0.06), in: Capsule())
                    }
                    .buttonStyle(.plain)
                }

                DashCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Refuels").font(.headline)
                        if model.fills.isEmpty {
                            Text("No fills yet.").foregroundStyle(.secondary)
                        } else {
                            ForEach(model.fills) { fill in
                                Button { model.editingRefuel = fill } label: {
                                    HStack(alignment: .top) {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(Format.dateLabel(fill.refuelDate)).font(.subheadline.weight(.semibold))
                                            Text(fillLine(fill)).font(.caption).foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        Text(Format.rupees(fill.amountInr)).fontWeight(.bold)
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                DashCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Maintenance").font(.headline)
                        if model.logs.isEmpty {
                            Text("No service logs yet.").foregroundStyle(.secondary)
                        } else {
                            ForEach(model.logs) { log in
                                Button { model.editingMaintenance = log } label: {
                                    HStack {
                                        VStack(alignment: .leading) {
                                            Text(log.serviceType).fontWeight(.semibold)
                                            Text(Format.dateLabel(log.serviceDate)).font(.caption).foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        if let cost = log.costInr { Text(Format.rupees(cost)) }
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                DashCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Trips & tolls").font(.headline)
                        if model.trips.isEmpty {
                            Text("No trips yet.").foregroundStyle(.secondary)
                        } else {
                            ForEach(model.trips) { trip in
                                HStack(alignment: .top) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(trip.purpose?.isEmpty == false ? trip.purpose! : "Trip")
                                            .font(.subheadline.weight(.semibold))
                                        Text(tripLine(trip)).font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    if let tolls = trip.tollsInr, tolls > 0 {
                                        Text(Format.rupees(tolls)).fontWeight(.bold)
                                    }
                                    Button(role: .destructive) {
                                        Task {
                                            try? await store.deleteTrip(trip.id)
                                            await reloadMetrics()
                                        }
                                    } label: {
                                        Image(systemName: "trash").font(.caption)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }

                Button("Delete vehicle", role: .destructive) { model.confirmDelete = true }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
            .padding(16)
        }
    }

    @ViewBuilder
    private func reserveSection(_ displayed: Vehicle) -> some View {
        DashCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Reserve tap").font(.headline)
                if displayed.reserveLitres == nil || (displayed.reserveLitres ?? 0) <= 0 {
                    Text("Set your reserve tank size in Edit so OdoLog can estimate how far you’ll go and when to refuel.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Button("Set reserve size") { model.vehicleToEdit = displayed }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(settings.accentColor)
                }
                if let estimate = model.reserveEstimate, !estimate.isActive {
                    Text("Reserve holds about \(Format.km(estimate.reserveRangeKm)) at \(estimate.estimated ? "typical" : "your") \(Format.kmpl(estimate.kmPerL)).")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if let markedOdo = model.reserveOdo {
                    Label("On reserve since \(Format.km(markedOdo))", systemImage: "exclamationmark.fuelpump.fill")
                        .foregroundStyle(reserveAccent(for: model.reserveEstimate?.status))
                    if let estimate = model.reserveEstimate,
                       let kmLeft = estimate.kmLeft,
                       let suggested = estimate.suggestedRefuelOdo,
                       let empty = estimate.emptyOdo {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("~\(Format.km(kmLeft)) left on reserve")
                                .font(.title3.weight(.bold))
                                .foregroundStyle(reserveAccent(for: estimate.status))
                            LabeledContent("Refuel by", value: Format.km(suggested))
                            LabeledContent("Empty around", value: Format.km(empty))
                            Text(reserveStatusCaption(estimate))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Button("Clear reserve mode") {
                        store.clearReserve(
                            for: displayed.id,
                            at: model.lastOdoNumeric ?? markedOdo,
                            note: "Cleared manually"
                        )
                        model.reserveOdo = nil
                        model.reserveLog = store.reserveEvents(for: displayed.id)
                        model.reserveEstimate = store.reserveRange(for: displayed)
                        Task { await ReminderService.reschedule(using: store, enabled: settings.remindersEnabled) }
                    }
                } else {
                    Button { model.showReserveSheet = true } label: {
                        Label("I switched to reserve", systemImage: "fuelpump.fill")
                    }
                }
                if let litres = displayed.reserveLitres, litres > 0 {
                    Text("Reserve capacity: \(Format.litres(litres))")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                if !model.reserveLog.isEmpty {
                    Divider().padding(.vertical, 4)
                    Text("Reserve history").font(.subheadline.weight(.semibold))
                    ForEach(model.reserveLog.prefix(12)) { event in
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: event.action == .entered ? "fuelpump.fill" : "checkmark.circle.fill")
                                .foregroundStyle(event.action == .entered ? Color.orange : settings.accentColor)
                                .frame(width: 20)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(event.action.title).font(.subheadline.weight(.medium))
                                Text("\(Format.dateLabel(event.eventDate)) · \(Format.km(event.odoKm))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                if let note = event.note, !note.isEmpty {
                                    Text(note).font(.caption2).foregroundStyle(.tertiary)
                                }
                            }
                            Spacer(minLength: 0)
                        }
                    }
                }
            }
        }
    }

    @MainActor
    private func reloadMetrics() async {
        guard let live = store.vehicle(id: vehicleId) else { return }
        let total = store.totalCost(for: live.id)
        let spend = store.spend(for: live.id)
        let distance = store.distance(for: live.id)
        let mileage = store.mileageResult(for: live.id)
        let kmpl = mileage.kmpl
        let litres = store.litres(for: live.id)
        let cpk = store.costPerKm(for: live.id)
        let monthCpk = store.costPerKm(inCalendarMonthOf: .now, vehicleId: live.id)
        let lastOdo = store.lastOdo(for: live.id)
        let range = store.range(for: live)
        let reserve = store.reserveRange(for: live)
        let reserveAt = store.reserveOdo(for: live.id)
        let nextFills = store.refuels(for: live.id)
        let nextLogs = store.maintenance(for: live.id)
        let nextTrips = store.trips(for: live.id)
        let nextReserveLog = store.reserveEvents(for: live.id)
        let claimed = live.resolvedClaimedKmpl ?? live.fuelType.fallbackKmpl

        model.displayed = live
        model.totalCostText = Format.rupees(total)
        model.fuelCostText = Format.rupees(spend)
        model.distanceText = distance.map { Format.km($0) } ?? "—"
        model.kmplText = kmpl.map { String(format: "%.1f", $0) } ?? "—"
        model.litresText = Format.litres(litres)
        model.costPerKmText = cpk.map { Format.rupeesPerKm($0) }
        model.monthCpkText = monthCpk.map { Format.rupeesPerKm($0) }
        model.lastOdoText = lastOdo.map { Format.km($0) }
        model.lastOdoNumeric = lastOdo
        if let range {
            model.rangeCaption = "Your last full fill should last about \(Format.km(range.fullRangeKm)). About \(Format.km(range.kmLeft)) remains; refuel around \(Format.km(range.nextOdo))."
        } else {
            model.rangeCaption = nil
        }
        model.mileageProgressValue = (kmpl != nil && claimed > 0) ? min(1, kmpl! / claimed) : 0
        model.droppedMileageReasons = mileage.droppedSegments.map(\.reason.message)
        model.reserveEstimate = reserve
        model.reserveOdo = reserveAt
        model.fills = nextFills
        model.logs = nextLogs
        model.trips = nextTrips
        model.reserveLog = nextReserveLog
    }

    private func reserveAccent(for status: ReserveRangeStatus?) -> Color {
        switch status {
        case .critical: Color.red
        case .refuelSoon, .ok, .none: Color.orange
        }
    }

    private func reserveStatusCaption(_ estimate: ReserveRangeEstimate) -> String {
        switch estimate.status {
        case .ok:
            if let until = estimate.kmUntilSuggested {
                return "Comfortable buffer — plan a fill within ~\(Format.km(until))."
            }
            return "Plan a fill before you burn the last of reserve."
        case .refuelSoon:
            return "Past the safe buffer — refuel soon so you don’t get stranded."
        case .critical:
            return "Reserve is nearly empty — find a pump now."
        }
    }

    private func fillLine(_ fill: Refuel) -> String {
        var parts = [Format.litres(fill.litres), String(format: "₹%.2f/L", fill.ratePerLitre)]
        if let odo = fill.odoKm { parts.append(Format.km(odo)) }
        if fill.fullTank { parts.append("Full") }
        if let brand = fill.fuelBrand, let known = FuelBrand(rawValue: brand) { parts.append(known.short) }
        return parts.joined(separator: " · ")
    }

    private func tripLine(_ trip: Trip) -> String {
        var parts = [Format.dateLabel(trip.tripDate)]
        if let start = trip.startOdoKm, let end = trip.endOdoKm, end > start {
            parts.append(Format.km(end - start))
        } else if let end = trip.endOdoKm {
            parts.append(Format.km(end))
        }
        return parts.joined(separator: " · ")
    }
}

private struct MarkReserveSheet: View {
    @Environment(\.dismiss) private var dismiss
    let vehicle: Vehicle
    let initialOdo: Double?
    let save: (Double) -> Void
    @State private var odo = ""

    var body: some View {
        Form {
            Section {
                Text("Record the odometer when you flip the fuel tap to reserve. OdoLog estimates how far reserve will take you and suggests a refuel odo before empty.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                TextField("Odometer (km)", text: $odo)
                    .keyboardType(.decimalPad)
            }
        }
        .navigationTitle("Switched to reserve")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    if let value = Double(odo.replacingOccurrences(of: ",", with: "")), value > 0 {
                        save(value)
                        dismiss()
                    }
                }
            }
        }
        .onAppear { if let initialOdo { odo = String(Int(initialOdo.rounded())) } }
    }
}
