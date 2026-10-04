import Foundation
import Observation
import SwiftData
import Supabase
import UIKit
import UniformTypeIdentifiers

struct DataResetOptions: Equatable {
    var fuelFills = false
    var maintenance = false
    var trips = false
    var reserveHistory = false
    var vehicles = false
    var appSettings = false
    var profilePhoto = false

    var hasSelection: Bool {
        fuelFills || maintenance || trips || reserveHistory || vehicles || appSettings || profilePhoto
    }

    var deletesFuelFills: Bool { fuelFills || vehicles }
    var deletesMaintenance: Bool { maintenance || vehicles }
    var deletesTrips: Bool { trips || vehicles }
    var deletesReserve: Bool { reserveHistory || vehicles }

    var summaryLabels: [String] {
        var labels: [String] = []
        if vehicles { labels.append("vehicles") }
        if deletesFuelFills { labels.append("fuel fills") }
        if deletesMaintenance { labels.append("maintenance") }
        if deletesTrips { labels.append("trips & tolls") }
        if deletesReserve { labels.append("reserve history") }
        if appSettings { labels.append("app settings") }
        if profilePhoto { labels.append("profile photo") }
        return labels
    }
}

@Observable
@MainActor
final class OdoLogStore {
    static let reserveAutoClearAmountInr = 100.0
    private(set) var isSignedIn = false
    private(set) var userId: UUID?
    private(set) var displayName: String?
    private(set) var email: String?
    private(set) var defaultCity = "delhi"

    private(set) var vehicles: [Vehicle] = []
    private(set) var recentRefuels: [RefuelWithVehicle] = []
    private(set) var allRefuels: [Refuel] = []
    private(set) var allMaintenance: [MaintenanceLog] = []
    private(set) var allTrips: [Trip] = []
    private(set) var stats = DashboardStats(spend: 0, litres: 0, count: 0)
    private(set) var reserveRevision = 0
    /// Precomputed on load — Garage/detail must not rescan all fills on every frame.
    private(set) var spendByVehicleId: [UUID: Double] = [:]
    private(set) var lastOdoByVehicleId: [UUID: Double] = [:]

    var isLoading = false
    var errorMessage: String?

    private var modelContext: ModelContext?
    private var listenTask: Task<Void, Never>?
    private var didMergeGuestThisSession = false
    private var hasCompletedInitialLoad = false
    var statusMessage: String?

    func attach(modelContext: ModelContext) {
        self.modelContext = modelContext
        NetworkMonitor.shared.onSatisfied = { [weak self] in
            Task { [weak self] in
                await self?.refresh(reportError: false)
            }
        }
        guard listenTask == nil else { return }
        listenTask = Task { [weak self] in
            guard let self else { return }
            for await (event, session) in SupabaseManager.client.auth.authStateChanges {
                // Ignore token refreshes — they were forcing full data reloads and freezing the UI.
                if event == .tokenRefreshed { continue }
                await self.apply(session: session)
            }
        }
    }

    func apply(session: Session?) async {
        let previousUserId = userId
        isSignedIn = session != nil
        userId = session?.user.id
        email = session?.user.email
        if let meta = session?.user.userMetadata["display_name"] {
            displayName = meta.stringValue
        } else {
            displayName = session?.user.email?.split(separator: "@").first.map(String.init)
        }

        if let userId, previousUserId == nil, !didMergeGuestThisSession {
            didMergeGuestThisSession = true
            if let summary = try? await mergeLocalGuestData(into: userId), !summary.isEmpty {
                statusMessage = summary
            }
        }
        if session == nil {
            didMergeGuestThisSession = false
        }

        let userChanged = previousUserId != userId
        let willRefresh = userChanged || !hasCompletedInitialLoad
        if willRefresh {
            await refresh()
            hasCompletedInitialLoad = true
        }
    }

    func refresh() async {
        await refresh(reportError: false)
    }

    /// Loads on-device data first. Signed-in accounts then flush pending ops and pull when online.
    func refresh(reportError: Bool) async {
        guard !isLoading else { return }
        isLoading = true
        if reportError { errorMessage = nil }
        defer { isLoading = false }
        var failures: [String] = []
        do {
            try refreshLocal(accountId: userId)
        } catch {
            if !RefreshError.isCancellation(error) {
                failures.append(error.localizedDescription)
            }
        }
        guard let userId, NetworkMonitor.shared.isOnline else {
            if reportError { errorMessage = failures.first }
            return
        }
        guard SupabaseManager.isConfigured else {
            if reportError { errorMessage = OdoLogError.missingSecrets.localizedDescription }
            return
        }
        do {
            try await flushPendingOps()
        } catch {
            if !RefreshError.isCancellation(error) {
                failures.append(error.localizedDescription)
            }
        }
        do {
            try await refreshCloud(userId: userId)
            try replaceCloudCache(userId: userId)
        } catch {
            if !RefreshError.isCancellation(error) {
                failures.append(error.localizedDescription)
            }
        }
        if reportError {
            errorMessage = failures.first
        }
    }

    /// Pull the latest vehicles, fills, service, and trips from odolog.online.
    @discardableResult
    func pullFromCloud() async throws -> String {
        guard isSignedIn else { throw OdoLogError.notSignedIn }
        guard SupabaseManager.isConfigured else { throw OdoLogError.missingSecrets }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        await refresh(reportError: true)
        return "Pulled \(vehicles.count) vehicle\(vehicles.count == 1 ? "" : "s") · \(allRefuels.count) fill\(allRefuels.count == 1 ? "" : "s") · \(allMaintenance.count) service log\(allMaintenance.count == 1 ? "" : "s") from the cloud."
    }

    /// Import CSV or JSON pasted from the clipboard (no Files picker).
    func importFromClipboard(replaceVehicleLogs: Bool) async throws -> String {
        let board = UIPasteboard.general
        let data: Data
        let filename: String?
        if let string = board.string?.trimmingCharacters(in: .whitespacesAndNewlines), !string.isEmpty {
            guard let encoded = string.data(using: .utf8) else { throw OdoLogError.emptyClipboard }
            data = encoded
            filename = looksLikeCSV(data) ? "clipboard.csv" : "clipboard.json"
        } else if let raw = board.data(forPasteboardType: UTType.utf8PlainText.identifier) ?? board.data(forPasteboardType: UTType.plainText.identifier),
                  !raw.isEmpty {
            data = raw
            filename = looksLikeCSV(data) ? "clipboard.csv" : "clipboard.json"
        } else {
            throw OdoLogError.emptyClipboard
        }
        return try await importFile(data: data, filename: filename, replaceVehicleLogs: replaceVehicleLogs)
    }

    /// Upload any on-device guest SwiftData logs into the signed-in cloud account, then clear local copies.
    @discardableResult
    func mergeLocalGuestData(into userId: UUID) async throws -> String {
        guard let modelContext else { return "" }
        let localVehicles = try modelContext.fetch(FetchDescriptor<LocalVehicle>()).filter { $0.accountId == nil }
        let localRefuels = try modelContext.fetch(FetchDescriptor<LocalRefuel>()).filter { $0.accountId == nil }
        let localMaint = try modelContext.fetch(FetchDescriptor<LocalMaintenance>()).filter { $0.accountId == nil }
        let localTrips = try modelContext.fetch(FetchDescriptor<LocalTrip>()).filter { $0.accountId == nil }
        guard !localVehicles.isEmpty || !localRefuels.isEmpty || !localMaint.isEmpty || !localTrips.isEmpty else {
            return ""
        }

        let cloudVehicles: [Vehicle] = try await SupabaseManager.client
            .from("vehicles").select().execute().value
        var byName: [String: UUID] = [:]
        for vehicle in cloudVehicles {
            byName[vehicle.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()] = vehicle.id
        }

        var idMap: [UUID: UUID] = [:]
        var created = 0
        for local in localVehicles {
            let key = local.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if let existing = byName[key] {
                idMap[local.id] = existing
                migrateReserveKey(from: local.id, to: existing)
                continue
            }
            let createdVehicle: Vehicle = try await SupabaseManager.client
                .from("vehicles")
                .insert(
                    VehicleInsert(
                        id: local.id,
                        name: local.name,
                        fuel_type: local.fuelTypeRaw,
                        icon: local.iconRaw,
                        make: local.make,
                        model_year: local.modelYear,
                        reg_number: local.regNumber,
                        is_guest: local.isGuest,
                        owner_name: local.ownerName,
                        has_reserve: local.hasReserve,
                        reserve_litres: local.reserveLitres,
                        user_id: userId
                    )
                )
                .select()
                .single()
                .execute()
                .value
            idMap[local.id] = createdVehicle.id
            byName[key] = createdVehicle.id
            migrateReserveKey(from: local.id, to: createdVehicle.id)
            created += 1
        }

        // Orphan logs whose vehicle is missing still need a destination — skip them.
        var refuelBatch: [RefuelInsert] = []
        for row in localRefuels {
            guard let vehicleId = idMap[row.vehicleId] else { continue }
            refuelBatch.append(
                RefuelInsert(
                    id: row.id,
                    vehicle_id: vehicleId,
                    user_id: userId,
                    refuel_date: row.refuelDate,
                    amount_inr: row.amountInr,
                    rate_per_litre: row.ratePerLitre,
                    litres: row.litres,
                    odo_km: row.odoKm,
                    full_tank: row.fullTank,
                    notes: row.notes,
                    fuel_subtype: row.fuelSubtypeRaw,
                    fuel_brand: row.fuelBrand,
                    tank_state: row.tankStateRaw
                )
            )
        }
        if !refuelBatch.isEmpty {
            try await SupabaseManager.client.from("refuels").insert(refuelBatch).execute()
        }

        for row in localMaint {
            guard let vehicleId = idMap[row.vehicleId] else { continue }
            try await SupabaseManager.client
                .from("maintenance_logs")
                .insert(
                    MaintenanceInsert(
                        id: row.id,
                        vehicle_id: vehicleId,
                        user_id: userId,
                        service_date: row.serviceDate,
                        service_type: row.serviceType,
                        odo_km: row.odoKm,
                        cost_inr: row.costInr,
                        notes: row.notes,
                        next_service_odo_km: row.nextServiceOdoKm,
                        next_service_date: row.nextServiceDate
                    )
                )
                .execute()
        }

        for row in localTrips {
            guard let vehicleId = idMap[row.vehicleId] else { continue }
            try await SupabaseManager.client
                .from("trips")
                .insert(
                    TripInsert(
                        id: row.id,
                        vehicle_id: vehicleId,
                        user_id: userId,
                        start_odo_km: row.startOdoKm,
                        end_odo_km: row.endOdoKm,
                        purpose: row.purpose,
                        tolls_inr: row.tollsInr,
                        notes: row.notes,
                        trip_date: row.tripDate
                    )
                )
                .execute()
        }

        for row in localRefuels { modelContext.delete(row) }
        for row in localMaint { modelContext.delete(row) }
        for row in localTrips { modelContext.delete(row) }
        for row in localVehicles { modelContext.delete(row) }
        try modelContext.save()

        return "Merged guest data: \(created) new vehicle\(created == 1 ? "" : "s"), \(refuelBatch.count) fill\(refuelBatch.count == 1 ? "" : "s") uploaded to your account."
    }

    private func migrateReserveKey(from oldId: UUID, to newId: UUID) {
        let oldKey = "odolog.reserve.\(oldId.uuidString)"
        let value = UserDefaults.standard.double(forKey: oldKey)
        guard value > 0 else { return }
        UserDefaults.standard.set(value, forKey: "odolog.reserve.\(newId.uuidString)")
        UserDefaults.standard.removeObject(forKey: oldKey)
    }

    func exportCSVData() -> Data {
        let header = "vehicle,date,amount_inr,rate_per_litre,litres,odo_km,full_tank,notes\n"
        let nameById = Dictionary(uniqueKeysWithValues: vehicles.map { ($0.id, $0.name) })
        let rows = allRefuels.sorted {
            if $0.refuelDate != $1.refuelDate { return $0.refuelDate > $1.refuelDate }
            return $0.createdAt > $1.createdAt
        }.map { r -> String in
            let vehicle = csvEscape(nameById[r.vehicleId] ?? r.vehicleId.uuidString)
            let odo = r.odoKm.map { String($0) } ?? ""
            let notes = csvEscape(r.notes ?? "")
            return [
                vehicle,
                r.refuelDate,
                String(r.amountInr),
                String(r.ratePerLitre),
                String(r.litres),
                odo,
                r.fullTank ? "yes" : "no",
                notes,
            ].joined(separator: ",")
        }
        return (header + rows.joined(separator: "\n") + (rows.isEmpty ? "" : "\n")).data(using: .utf8) ?? Data()
    }

    private func csvEscape(_ value: String) -> String {
        if value.contains(",") || value.contains("\"") || value.contains("\n") {
            return "\"" + value.replacingOccurrences(of: "\"", with: "\"\"") + "\""
        }
        return value
    }

    func handleIncomingFile(url: URL, replaceVehicleLogs: Bool) async throws -> String {
        let data = try CSVRefuelImport.readFileData(from: url)
        return try await importFile(
            data: data,
            filename: url.lastPathComponent,
            replaceVehicleLogs: replaceVehicleLogs
        )
    }

    func deleteTrip(_ id: UUID) async throws {
        try deleteLocalTrip(id: id)
        try refreshLocal(accountId: userId)
        await pushOrEnqueue(.deleteTrip(id))
    }

    func signIn(email: String, password: String) async throws {
        _ = try await SupabaseManager.client.auth.signIn(email: email, password: password)
    }

    func signInWithGoogle() async throws {
        _ = try await SupabaseManager.client.auth.signInWithOAuth(
            provider: .google,
            redirectTo: AuthCallback.redirectURL
        )
    }

    func handleAuthURL(_ url: URL) async {
        do {
            _ = try await SupabaseManager.client.auth.session(from: url)
        } catch {
            if !RefreshError.isCancellation(error) {
                errorMessage = error.localizedDescription
            }
        }
    }

    func signUp(email: String, password: String, name: String) async throws {
        let response = try await SupabaseManager.client.auth.signUp(
            email: email,
            password: password,
            data: ["display_name": .string(name.isEmpty ? String(email.split(separator: "@").first ?? "User") : name)]
        )
        if response.session == nil {
            throw OdoLogError.confirmEmail
        }
    }

    func signOut() async throws {
        try await SupabaseManager.client.auth.signOut()
    }

    /// Deletes the selected data types. Signed-in accounts are wiped in the cloud; guests wipe this iPhone only.
    @discardableResult
    func resetData(_ options: DataResetOptions, settings: AppSettings) async throws -> String {
        guard options.hasSelection else { return "Nothing selected." }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        if isSignedIn {
            guard let userId else { throw OdoLogError.notSignedIn }
            try wipeLocalCache(accountId: userId, options: options)
            if NetworkMonitor.shared.isOnline, SupabaseManager.isConfigured {
                if options.deletesFuelFills {
                    try await SupabaseManager.client.from("refuels").delete().eq("user_id", value: userId).execute()
                }
                if options.deletesMaintenance {
                    try await SupabaseManager.client.from("maintenance_logs").delete().eq("user_id", value: userId).execute()
                }
                if options.deletesTrips {
                    try await SupabaseManager.client.from("trips").delete().eq("user_id", value: userId).execute()
                }
                if options.vehicles {
                    try await SupabaseManager.client.from("vehicles").delete().eq("user_id", value: userId).execute()
                }
            } else {
                if options.vehicles {
                    for vehicle in vehicles { PendingSyncQueue.enqueue(.deleteVehicle(vehicle.id)) }
                } else if options.deletesFuelFills {
                    for vehicle in vehicles { PendingSyncQueue.enqueue(.deleteRefuelsForVehicle(vehicle.id)) }
                }
                if options.deletesMaintenance {
                    for log in allMaintenance { PendingSyncQueue.enqueue(.deleteMaintenance(log.id)) }
                }
                if options.deletesTrips {
                    for trip in allTrips { PendingSyncQueue.enqueue(.deleteTrip(trip.id)) }
                }
            }
        } else {
            guard let modelContext else { throw OdoLogError.notFound }
            if options.deletesFuelFills {
                for row in try modelContext.fetch(FetchDescriptor<LocalRefuel>()).filter({ $0.accountId == nil }) { modelContext.delete(row) }
            }
            if options.deletesMaintenance {
                for row in try modelContext.fetch(FetchDescriptor<LocalMaintenance>()).filter({ $0.accountId == nil }) { modelContext.delete(row) }
            }
            if options.deletesTrips {
                for row in try modelContext.fetch(FetchDescriptor<LocalTrip>()).filter({ $0.accountId == nil }) { modelContext.delete(row) }
            }
            if options.vehicles {
                for row in try modelContext.fetch(FetchDescriptor<LocalVehicle>()).filter({ $0.accountId == nil }) { modelContext.delete(row) }
            }
            try modelContext.save()
        }

        if options.deletesReserve {
            clearAllReserveStorage()
        }

        if options.profilePhoto {
            ProfilePhoto.remove()
            settings.notePhotoChange()
            if !isSignedIn {
                UserDefaults.standard.removeObject(forKey: "odolog.localDisplayName")
                displayName = nil
            }
        }

        if options.appSettings {
            settings.resetToDefaults()
        }

        await refresh()
        let labels = options.summaryLabels.joined(separator: ", ")
        let scope = isSignedIn ? "your OdoLog account" : "this iPhone"
        return "Deleted \(labels) from \(scope)."
    }

    private func clearAllReserveStorage() {
        UserDefaults.standard.removeObject(forKey: Self.reserveEventsKey)
        for key in UserDefaults.standard.dictionaryRepresentation().keys where key.hasPrefix("odolog.reserve.") {
            UserDefaults.standard.removeObject(forKey: key)
        }
    }

    func saveProfile(name: String, city: String) async throws {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedCity = city.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if let userId, NetworkMonitor.shared.isOnline {
            _ = try? await SupabaseManager.client
                .from("profiles")
                .update(["display_name": trimmedName, "default_city": trimmedCity])
                .eq("id", value: userId)
                .execute()
        } else if userId == nil {
            UserDefaults.standard.set(trimmedName, forKey: "odolog.localDisplayName")
            UserDefaults.standard.set(trimmedCity, forKey: "odolog.localCity")
        }
        displayName = trimmedName.isEmpty ? displayName : trimmedName
        defaultCity = trimmedCity.isEmpty ? defaultCity : trimmedCity
    }

    func updateVehicle(
        _ id: UUID,
        name: String,
        fuelType: FuelType,
        icon: VehicleIconKind,
        make: String?,
        modelYear: Int?,
        regNumber: String?,
        isGuest: Bool,
        ownerName: String?,
        hasReserve: Bool,
        reserveLitres: Double?,
        claimedMileageKmpl: Double? = nil
    ) async throws {
        let trimmedMake = make.flatMap { $0.isEmpty ? nil : $0 }
        let trimmedReg = regNumber.flatMap { $0.isEmpty ? nil : $0 }
        let trimmedOwner = ownerName.flatMap { $0.isEmpty ? nil : $0 }
        let reserveEnabled = icon.supportsReserveTap && hasReserve
        let litres = reserveEnabled ? reserveLitres : nil
        persistClaimedMileage(claimedMileageKmpl, for: id)
        let vehicle = Vehicle(
            id: id,
            name: name,
            fuelType: fuelType,
            icon: icon,
            make: trimmedMake,
            modelYear: modelYear,
            regNumber: trimmedReg,
            isGuest: isGuest,
            ownerName: trimmedOwner,
            hasReserve: reserveEnabled,
            reserveLitres: litres,
            claimedMileageKmpl: claimedMileageKmpl,
            createdAt: self.vehicle(id: id)?.createdAt ?? .now
        )
        try upsertLocalVehicle(vehicle)
        try refreshLocal(accountId: userId)
        await pushOrEnqueue(.upsertVehicle(vehicle))
        if !reserveEnabled, reserveOdo(for: id) != nil {
            clearReserve(for: id, at: lastOdo(for: id), note: "Reserve tap disabled")
        }
    }

    @discardableResult
    func addVehicle(
        name: String,
        fuelType: FuelType,
        icon: VehicleIconKind,
        make: String?,
        modelYear: Int?,
        regNumber: String?,
        isGuest: Bool,
        ownerName: String?,
        hasReserve: Bool,
        reserveLitres: Double?,
        claimedMileageKmpl: Double? = nil
    ) async throws -> Vehicle {
        let trimmedMake = make.flatMap { $0.isEmpty ? nil : $0 }
        let trimmedReg = regNumber.flatMap { $0.isEmpty ? nil : $0 }
        let trimmedOwner = ownerName.flatMap { $0.isEmpty ? nil : $0 }
        let vehicle = Vehicle(
            name: name,
            fuelType: fuelType,
            icon: icon,
            make: trimmedMake,
            modelYear: modelYear,
            regNumber: trimmedReg,
            isGuest: isGuest,
            ownerName: trimmedOwner,
            hasReserve: hasReserve,
            reserveLitres: reserveLitres,
            claimedMileageKmpl: claimedMileageKmpl
        )
        try upsertLocalVehicle(vehicle)
        persistClaimedMileage(claimedMileageKmpl, for: vehicle.id)
        try refreshLocal(accountId: userId)
        await pushOrEnqueue(.upsertVehicle(vehicle))
        return vehicle
    }

    func addRefuel(
        vehicleId: UUID,
        date: Date,
        amount: Double,
        rate: Double,
        litres: Double,
        odoKm: Double?,
        fullTank: Bool,
        notes: String?,
        fuelSubtype: FuelSubtype?,
        fuelBrand: FuelBrand?,
        tankState: TankState?
    ) async throws {
        guard let odoKm, odoKm > 0 else { throw OdoLogError.odoRequired }
        if Self.strictOdoEnabled, let last = lastOdo(for: vehicleId, excluding: nil), odoKm <= last {
            throw OdoLogError.odoTooLow(last: last)
        }
        let ymd = Format.ymd(date)
        let trimmedNotes = notes.flatMap { $0.isEmpty ? nil : $0 }
        let refuel = Refuel(
            vehicleId: vehicleId,
            refuelDate: ymd,
            amountInr: amount,
            ratePerLitre: rate,
            litres: litres,
            odoKm: odoKm,
            fullTank: fullTank,
            notes: trimmedNotes,
            fuelSubtype: fuelSubtype,
            fuelBrand: fuelBrand?.rawValue,
            tankState: tankState
        )
        try upsertLocalRefuel(refuel)
        try refreshLocal(accountId: userId)
        if tankState == .reserve,
           vehicle(id: vehicleId)?.icon == .bike,
           reserveOdo(for: vehicleId) == nil {
            markReserve(for: vehicleId, at: odoKm, date: date, note: "Reserve recorded with refuel")
        }
        if Self.shouldClearReserve(amount: amount, rate: rate, litres: litres),
           vehicle(id: vehicleId)?.icon == .bike,
           reserveOdo(for: vehicleId) != nil {
            clearReserve(for: vehicleId, at: odoKm, date: date, note: "Cleared on refuel")
        }
        await pushOrEnqueue(.upsertRefuel(refuel))
    }

    func updateRefuel(
        _ id: UUID,
        vehicleId: UUID,
        date: Date,
        amount: Double,
        rate: Double,
        litres: Double,
        odoKm: Double?,
        fullTank: Bool,
        notes: String?,
        fuelSubtype: FuelSubtype?,
        fuelBrand: FuelBrand?,
        tankState: TankState?
    ) async throws {
        guard let odoKm, odoKm > 0 else { throw OdoLogError.odoRequired }
        if Self.strictOdoEnabled, let last = lastOdo(for: vehicleId, excluding: id), odoKm <= last {
            throw OdoLogError.odoTooLow(last: last)
        }
        let ymd = Format.ymd(date)
        let trimmedNotes = notes.flatMap { $0.isEmpty ? nil : $0 }
        let existing = allRefuels.first { $0.id == id }
        let wasNewestRefuel = refuels(for: vehicleId).first?.id == id
        let refuel = Refuel(
            id: id,
            vehicleId: vehicleId,
            refuelDate: ymd,
            amountInr: amount,
            ratePerLitre: rate,
            litres: litres,
            odoKm: odoKm,
            fullTank: fullTank,
            notes: trimmedNotes,
            fuelSubtype: fuelSubtype,
            fuelBrand: fuelBrand?.rawValue,
            tankState: tankState,
            createdAt: existing?.createdAt ?? .now
        )
        try upsertLocalRefuel(refuel)
        if existing != nil {
            markMileageRefuelEdited(id)
        }
        try refreshLocal(accountId: userId)
        if wasNewestRefuel,
           Self.shouldClearReserve(amount: amount, rate: rate, litres: litres),
           vehicle(id: vehicleId)?.icon == .bike,
           reserveOdo(for: vehicleId) != nil {
            clearReserve(for: vehicleId, at: odoKm, date: date, note: "Cleared on edited refuel")
        }
        await pushOrEnqueue(.upsertRefuel(refuel))
    }

    private static func shouldClearReserve(amount: Double, rate: Double, litres: Double) -> Bool {
        if amount > 0 {
            return amount >= reserveAutoClearAmountInr
        }
        if litres > 0, rate > 0 {
            return litres * rate >= reserveAutoClearAmountInr
        }
        return litres > 0
    }

    func deleteRefuel(_ id: UUID) async throws {
        if let refuel = allRefuels.first(where: { $0.id == id }) {
            recordMileageChainBreak(for: refuel)
        }
        try deleteLocalRefuel(id: id)
        try refreshLocal(accountId: userId)
        await pushOrEnqueue(.deleteRefuel(id))
    }

    func addMaintenance(
        vehicleId: UUID,
        date: Date,
        serviceType: String,
        odoKm: Double?,
        costInr: Double?,
        notes: String?,
        nextServiceOdo: Double?,
        nextServiceDate: Date?
    ) async throws {
        let ymd = Format.ymd(date)
        let type = serviceType.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedNotes = notes.flatMap { $0.isEmpty ? nil : $0 }
        let nextYmd = nextServiceDate.map(Format.ymd)
        let log = MaintenanceLog(
            vehicleId: vehicleId,
            serviceDate: ymd,
            serviceType: type,
            odoKm: odoKm,
            costInr: costInr,
            notes: trimmedNotes,
            nextServiceOdoKm: nextServiceOdo,
            nextServiceDate: nextYmd
        )
        try upsertLocalMaintenance(log)
        try refreshLocal(accountId: userId)
        await pushOrEnqueue(.upsertMaintenance(log))
    }

    func updateMaintenance(
        _ id: UUID,
        date: Date,
        serviceType: String,
        odoKm: Double?,
        costInr: Double?,
        notes: String?,
        nextServiceOdo: Double?,
        nextServiceDate: Date?
    ) async throws {
        let ymd = Format.ymd(date)
        let type = serviceType.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedNotes = notes.flatMap { $0.isEmpty ? nil : $0 }
        let nextYmd = nextServiceDate.map(Format.ymd)
        let existing = allMaintenance.first { $0.id == id }
        let log = MaintenanceLog(
            id: id,
            vehicleId: existing?.vehicleId ?? UUID(),
            serviceDate: ymd,
            serviceType: type,
            odoKm: odoKm,
            costInr: costInr,
            notes: trimmedNotes,
            nextServiceOdoKm: nextServiceOdo,
            nextServiceDate: nextYmd,
            createdAt: existing?.createdAt ?? .now
        )
        try upsertLocalMaintenance(log)
        try refreshLocal(accountId: userId)
        await pushOrEnqueue(.upsertMaintenance(log))
    }

    func deleteMaintenance(_ id: UUID) async throws {
        try deleteLocalMaintenance(id: id)
        try refreshLocal(accountId: userId)
        await pushOrEnqueue(.deleteMaintenance(id))
    }

    func addTrip(
        vehicleId: UUID,
        date: Date,
        purpose: String?,
        notes: String?,
        startOdo: Double?,
        endOdo: Double?,
        tolls: Double?
    ) async throws {
        let ymd = Format.ymd(date)
        let trimmedPurpose = purpose.flatMap { $0.isEmpty ? nil : $0 }
        let trimmedNotes = notes.flatMap { $0.isEmpty ? nil : $0 }
        let trip = Trip(
            vehicleId: vehicleId,
            startOdoKm: startOdo,
            endOdoKm: endOdo,
            purpose: trimmedPurpose,
            tollsInr: tolls,
            notes: trimmedNotes,
            tripDate: ymd
        )
        try upsertLocalTrip(trip)
        try refreshLocal(accountId: userId)
        await pushOrEnqueue(.upsertTrip(trip))
    }

    func deleteVehicle(_ id: UUID) async throws {
        guard let modelContext else { throw OdoLogError.notFound }
        try deleteLocalVehicle(id: id, context: modelContext)
        try refreshLocal(accountId: userId)
        await pushOrEnqueue(.deleteVehicle(id))
    }

    func lastOdo(for vehicleId: UUID, excluding id: UUID? = nil) -> Double? {
        if let id {
            return allRefuels
                .filter { $0.vehicleId == vehicleId && $0.id != id }
                .compactMap(\.odoKm)
                .max()
        }
        return lastOdoByVehicleId[vehicleId]
    }

    func refuels(for vehicleId: UUID) -> [Refuel] {
        LogFuelPerformance.measure("RefuelsForVehicle") {
            allRefuels
                .filter { $0.vehicleId == vehicleId }
                .sorted {
                    if $0.refuelDate != $1.refuelDate { return $0.refuelDate > $1.refuelDate }
                    return $0.createdAt > $1.createdAt
                }
        }
    }

    func maintenance(for vehicleId: UUID) -> [MaintenanceLog] {
        allMaintenance
            .filter { $0.vehicleId == vehicleId }
            .sorted { $0.serviceDate > $1.serviceDate }
    }

    func trips(for vehicleId: UUID) -> [Trip] {
        allTrips.filter { $0.vehicleId == vehicleId }.sorted { $0.tripDate > $1.tripDate }
    }

    func spend(for vehicleId: UUID) -> Double {
        spendByVehicleId[vehicleId] ?? 0
    }

    func maintenanceCost(for vehicleId: UUID) -> Double {
        allMaintenance.filter { $0.vehicleId == vehicleId }.reduce(0) { $0 + ($1.costInr ?? 0) }
    }

    func tollCost(for vehicleId: UUID) -> Double {
        allTrips.filter { $0.vehicleId == vehicleId }.reduce(0) { $0 + ($1.tollsInr ?? 0) }
    }

    func totalCost(for vehicleId: UUID) -> Double {
        spend(for: vehicleId) + maintenanceCost(for: vehicleId) + tollCost(for: vehicleId)
    }

    func distance(for vehicleId: UUID) -> Double? {
        let readings = refuels(for: vehicleId).compactMap(\.odoKm)
        guard let first = readings.min(), let last = readings.max(), last > first else { return nil }
        return last - first
    }

    func costPerKm(for vehicleId: UUID) -> Double? {
        guard let distance = distance(for: vehicleId), distance > 0 else { return nil }
        return totalCost(for: vehicleId) / distance
    }

    func reserveOdo(for vehicleId: UUID) -> Double? {
        _ = reserveRevision
        let value = UserDefaults.standard.double(forKey: "odolog.reserve.\(vehicleId.uuidString)")
        return value > 0 ? value : nil
    }

    func reserveEvents(for vehicleId: UUID) -> [ReserveEvent] {
        loadReserveEvents()
            .filter { $0.vehicleId == vehicleId }
            .sorted {
                if $0.eventDate != $1.eventDate { return $0.eventDate > $1.eventDate }
                return $0.createdAt > $1.createdAt
            }
    }

    func markReserve(for vehicleId: UUID, at odo: Double, date: Date = .now, note: String? = nil) {
        UserDefaults.standard.set(odo, forKey: "odolog.reserve.\(vehicleId.uuidString)")
        reserveRevision += 1
        appendReserveEvent(
            ReserveEvent(
                vehicleId: vehicleId,
                action: .entered,
                odoKm: odo,
                eventDate: Format.ymd(date),
                note: note
            )
        )
    }

    func validateReserveOdometer(_ odo: Double, for vehicleId: UUID) throws {
        guard odo > 0 else { throw OdoLogError.odoRequired }
        if let last = lastOdo(for: vehicleId),
           odo < last || (Self.strictOdoEnabled && odo <= last) {
            throw OdoLogError.odoTooLow(last: last)
        }
    }

    func clearReserve(for vehicleId: UUID, at odo: Double? = nil, date: Date = .now, note: String? = nil) {
        let previous = reserveOdo(for: vehicleId)
        UserDefaults.standard.removeObject(forKey: "odolog.reserve.\(vehicleId.uuidString)")
        reserveRevision += 1
        guard previous != nil else { return }
        let resolvedOdo = odo ?? previous ?? lastOdo(for: vehicleId) ?? 0
        guard resolvedOdo > 0 else { return }
        appendReserveEvent(
            ReserveEvent(
                vehicleId: vehicleId,
                action: .cleared,
                odoKm: resolvedOdo,
                eventDate: Format.ymd(date),
                note: note
            )
        )
    }

    func clearReserveWithoutRefuel(for vehicleId: UUID, at odo: Double? = nil, date: Date = .now) {
        guard reserveOdo(for: vehicleId) != nil else { return }
        clearReserve(for: vehicleId, at: odo, date: date, note: "Reserve cleared without a refuel")
        recordMileageChainBreak(
            vehicleId: vehicleId,
            date: Format.ymd(date),
            createdAt: .now,
            reason: .reserveClearedWithoutRefuel
        )
    }

    private func appendReserveEvent(_ event: ReserveEvent) {
        var all = loadReserveEvents()
        all.append(event)
        if let data = try? JSONEncoder().encode(all) {
            UserDefaults.standard.set(data, forKey: Self.reserveEventsKey)
        }
    }

    private func loadReserveEvents() -> [ReserveEvent] {
        LogFuelPerformance.measure("ReserveEventLoad") {
            guard let data = UserDefaults.standard.data(forKey: Self.reserveEventsKey),
                  let events = try? JSONDecoder().decode([ReserveEvent].self, from: data) else { return [] }
            return events
        }
    }

    private static let reserveEventsKey = "odolog.reserve.events"

    /// Short label for garage / reminders when service is due soon or overdue.
    func serviceDueSummary(for vehicleId: UUID) -> String? {
        let logs = maintenance(for: vehicleId)
        guard let latest = logs.first(where: {
            $0.nextServiceDate != nil || ($0.nextServiceOdoKm ?? 0) > 0
        }) else { return nil }

        if let ymd = latest.nextServiceDate, let due = Format.date(fromYMD: ymd) {
            let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: .now), to: Calendar.current.startOfDay(for: due)).day ?? 999
            if days < 0 { return "Service overdue" }
            if days == 0 { return "Service due today" }
            if days <= 14 { return "Service in \(days)d" }
        }
        if let nextOdo = latest.nextServiceOdoKm, nextOdo > 0, let last = lastOdo(for: vehicleId) {
            let remaining = nextOdo - last
            if remaining <= 0 { return "Service overdue" }
            if remaining <= 200 { return "Service in \(Format.km(remaining))" }
        }
        return nil
    }

    func deleteRefuels(for vehicleId: UUID) async throws {
        try deleteLocalRefuels(for: vehicleId)
        try refreshLocal(accountId: userId)
        await pushOrEnqueue(.deleteRefuelsForVehicle(vehicleId))
    }

    func litres(for vehicleId: UUID) -> Double {
        allRefuels.filter { $0.vehicleId == vehicleId }.reduce(0) { $0 + $1.litres }
    }

    func recomputeMileageAndReserveState() {
        for vehicle in vehicles {
            _ = mileageResult(for: vehicle.id)
            _ = reserveRange(for: vehicle)
        }
        reserveRevision += 1
    }

    func kmpl(for vehicleId: UUID) -> Double? {
        mileageResult(for: vehicleId).kmpl
    }

    /// Home efficiency: three or more main-tank, fill-to-fill intervals for one vehicle.
    func homeEfficiencyKmpl(for vehicleId: UUID) -> Double? {
        let fills = refuels(for: vehicleId)
            .filter { $0.tankState != .reserve && ($0.odoKm ?? 0) > 0 && $0.litres > 0 }
            .sorted {
                if $0.refuelDate != $1.refuelDate { return $0.refuelDate < $1.refuelDate }
                return $0.createdAt < $1.createdAt
            }
        guard fills.count >= 4 else { return nil }

        var distance = 0.0
        var litres = 0.0
        var intervals = 0
        for index in 1..<fills.count {
            let previousOdo = fills[index - 1].odoKm ?? 0
            let currentOdo = fills[index].odoKm ?? 0
            let delta = currentOdo - previousOdo
            guard delta > 0 else { continue }
            distance += delta
            litres += fills[index].litres
            intervals += 1
        }
        guard intervals >= 3, distance > 0, litres > 0 else { return nil }
        return distance / litres
    }

    func mileagePoints(for vehicleId: UUID) -> [(date: String, value: Double)] {
        mileageResult(for: vehicleId).validSegments.map { (Format.shortDate($0.date), $0.kmpl) }
    }

    /// Canonical km/L segments from the pure calculator.
    func mileageSegments(for vehicleId: UUID) -> [(date: String, km: Double, litres: Double, kmpl: Double)] {
        mileageResult(for: vehicleId).validSegments.map { ($0.date, $0.km, $0.litres, $0.kmpl) }
    }

    func mileageResult(for vehicleId: UUID) -> MileageCalculator.Result {
        LogFuelPerformance.measure("MileageResult") {
        guard let vehicle = vehicle(id: vehicleId) else {
            return MileageCalculator.Result(kmpl: nil, validSegments: [], droppedSegments: [])
        }
        let edited = Set(UserDefaults.standard.stringArray(forKey: Self.mileageEditedRefuelsKey) ?? [])
        let fills = refuels(for: vehicleId).map {
            MileageCalculator.Fill(
                id: $0.id,
                date: $0.refuelDate,
                createdAt: $0.createdAt,
                odoKm: $0.odoKm,
                litres: $0.litres,
                amount: $0.amountInr,
                rate: $0.ratePerLitre,
                isFull: $0.fullTank,
                wasEdited: edited.contains($0.id.uuidString)
            )
        }
        let points = reserveEvents(for: vehicleId)
            .filter { $0.action == .entered }
            .map {
                MileageCalculator.ReservePoint(
                    id: $0.id,
                    date: $0.eventDate,
                    createdAt: $0.createdAt,
                    odoKm: $0.odoKm
                )
            }
        let breaks = mileageChainBreaks()
            .filter { $0.vehicleId == vehicleId }
            .map {
                MileageCalculator.ChainBreak(
                    moment: MileageCalculator.Moment(date: $0.date, createdAt: $0.createdAt),
                    reason: $0.reason == MileageChainBreakReason.reserveClearedWithoutRefuel.rawValue
                        ? .reserveClearedWithoutRefuel
                        : .editedOrDeletedLog
                )
            }
        let mode: MileageCalculator.Mode =
            vehicle.icon.supportsReserveTap && vehicle.hasReserve ? .reserve : .fullFill
        return MileageCalculator.calculate(.init(
            mode: mode,
            claimedKmpl: vehicle.resolvedClaimedKmpl,
            fills: fills,
            reservePoints: points,
            chainBreaks: breaks
        ))
        }
    }

#if DEBUG
    struct DebugMileageComparison: Identifiable {
        let id: UUID
        let vehicleName: String
        let oldKmpl: Double?
        let newKmpl: Double?
        let droppedSegments: [MileageCalculator.DroppedSegment]

        var difference: Double? {
            guard let oldKmpl, let newKmpl else { return nil }
            return newKmpl - oldKmpl
        }
    }

    func debugMileageComparisons() -> [DebugMileageComparison] {
        vehicles.map { vehicle in
            let oldSegments = debugLegacyMileageSegments(for: vehicle.id)
            let minimum = vehicle.icon.supportsReserveTap
                && vehicle.hasReserve
                && !debugLegacyReserveLedgerSegments(for: vehicle).isEmpty ? 2 : 3
            let oldKmpl: Double? = {
                guard oldSegments.count >= minimum else { return nil }
                let km = oldSegments.reduce(0) { $0 + $1.km }
                let litres = oldSegments.reduce(0) { $0 + $1.litres }
                return km > 0 && litres > 0 ? km / litres : nil
            }()
            let newResult = mileageResult(for: vehicle.id)
            return DebugMileageComparison(
                id: vehicle.id,
                vehicleName: vehicle.displayName,
                oldKmpl: oldKmpl,
                newKmpl: newResult.kmpl,
                droppedSegments: newResult.droppedSegments
            )
        }
    }

    private func debugLegacyMileageSegments(for vehicleId: UUID) -> [(date: String, km: Double, litres: Double, kmpl: Double)] {
        if let vehicle = vehicle(id: vehicleId), vehicle.icon.supportsReserveTap, vehicle.hasReserve {
            let ledger = debugLegacyReserveLedgerSegments(for: vehicle)
            if !ledger.isEmpty { return ledger }
        }
        return debugLegacyWindowedFillSegments(for: vehicleId)
    }

    private func debugLegacyReserveLedgerSegments(for vehicle: Vehicle) -> [(date: String, km: Double, litres: Double, kmpl: Double)] {
        guard let reserveLitres = vehicle.reserveLitres, reserveLitres > 0 else { return [] }
        let entered = reserveEvents(for: vehicle.id).filter { $0.action == .entered }.sorted {
            $0.eventDate == $1.eventDate ? $0.odoKm < $1.odoKm : $0.eventDate < $1.eventDate
        }
        let fills = refuels(for: vehicle.id).filter { ($0.odoKm ?? 0) > 0 }.sorted {
            if $0.refuelDate != $1.refuelDate { return $0.refuelDate < $1.refuelDate }
            if $0.createdAt != $1.createdAt { return $0.createdAt < $1.createdAt }
            return ($0.odoKm ?? 0) < ($1.odoKm ?? 0)
        }
        let segments = entered.compactMap { event -> (date: String, km: Double, litres: Double, kmpl: Double)? in
            guard let fill = fills.first(where: { ($0.odoKm ?? 0) > event.odoKm }) else { return nil }
            let km = (fill.odoKm ?? 0) - event.odoKm
            guard km > 0 else { return nil }
            return (fill.refuelDate, km, reserveLitres, km / reserveLitres)
        }
        return Array(segments.suffix(8))
    }

    private func debugLegacyWindowedFillSegments(for vehicleId: UUID) -> [(date: String, km: Double, litres: Double, kmpl: Double)] {
        let ordered = refuels(for: vehicleId).sorted {
            if $0.refuelDate != $1.refuelDate { return $0.refuelDate < $1.refuelDate }
            if $0.createdAt != $1.createdAt { return $0.createdAt < $1.createdAt }
            return ($0.odoKm ?? 0) < ($1.odoKm ?? 0)
        }
        let withOdo = ordered.filter { ($0.odoKm ?? 0) > 0 }
        guard withOdo.count >= 2 else { return [] }
        let indexById = Dictionary(uniqueKeysWithValues: ordered.enumerated().map { ($0.element.id, $0.offset) })
        var segments: [(date: String, km: Double, litres: Double, kmpl: Double)] = []
        for index in 1..<withOdo.count {
            let previous = withOdo[index - 1]
            let current = withOdo[index]
            let km = (current.odoKm ?? 0) - (previous.odoKm ?? 0)
            guard km > 0,
                  let start = indexById[previous.id],
                  let end = indexById[current.id],
                  end > start else { continue }
            var litres = ordered[(start + 1)...end].reduce(0) { $0 + $1.litres }
            if litres <= 0 { litres = previous.litres }
            if litres <= 0 { litres = current.litres }
            guard litres > 0 else { continue }
            segments.append((current.refuelDate, km, litres, km / litres))
        }
        return Array(segments.suffix(8))
    }
#endif

    /// Prefer measured km/L; otherwise claimed / fuel-type fallback. Avoids extra work when only a rough figure is needed.
    func effectiveKmpl(for vehicle: Vehicle) -> Double? {
        if let measured = kmpl(for: vehicle.id) { return measured }
        let claimed = vehicle.resolvedClaimedKmpl ?? vehicle.fuelType.fallbackKmpl
        return claimed > 0 ? claimed : nil
    }

    func range(for vehicle: Vehicle) -> RangeEstimate? {
        guard vehicle.fuelType.isFuelable else { return nil }
        let fills = refuels(for: vehicle.id)
        let kmPerL = kmpl(for: vehicle.id)
        let claimed = vehicle.resolvedClaimedKmpl ?? vehicle.fuelType.fallbackKmpl
        let used = kmPerL ?? (claimed > 0 ? claimed : nil)
        guard let used, used > 0 else { return nil }
        let withOdo = fills.filter { ($0.odoKm ?? 0) > 0 && $0.litres > 0 }.sorted {
            if $0.refuelDate != $1.refuelDate { return $0.refuelDate < $1.refuelDate }
            return $0.createdAt < $1.createdAt
        }
        let lastFill = withOdo.last
        guard let last = lastFill, let lastOdo = last.odoKm else { return nil }
        let tankKm = last.litres * used
        let latest = self.lastOdo(for: vehicle.id) ?? lastOdo
        let driven = max(0, latest - lastOdo)
        let kmLeft = max(0, tankKm - driven)
        let usable = tankKm * 0.9
        let nextOdo = floor((lastOdo + usable) / 10) * 10
        return RangeEstimate(
            fullRangeKm: tankKm,
            nextOdo: nextOdo,
            kmLeft: kmLeft,
            litresLeft: kmLeft / used,
            kmPerL: used,
            estimated: kmPerL == nil
        )
    }

    /// How far the fixed reserve tank will take you, and when to refuel before empty.
    func reserveRange(for vehicle: Vehicle) -> ReserveRangeEstimate? {
        guard vehicle.hasReserve,
              vehicle.icon.supportsReserveTap,
              let litres = vehicle.resolvedReserveLitres,
              litres > 0 else { return nil }
        let measured = kmpl(for: vehicle.id)
        let claimed = vehicle.resolvedClaimedKmpl ?? vehicle.fuelType.fallbackKmpl
        let used = measured ?? (claimed > 0 ? claimed : nil)
        guard let used, used > 0 else { return nil }

        let reserveRangeKm = litres * used
        let marked = reserveOdo(for: vehicle.id)

        guard let marked else {
            return ReserveRangeEstimate(
                reserveLitres: litres,
                reserveRangeKm: reserveRangeKm,
                markedOdo: nil,
                emptyOdo: nil,
                suggestedRefuelOdo: nil,
                kmLeft: nil,
                kmUntilSuggested: nil,
                kmPerL: used,
                estimated: measured == nil,
                status: .ok
            )
        }

        let emptyOdo = marked + reserveRangeKm
        let suggestedRaw = marked + reserveRangeKm * 0.75
        let suggestedRefuelOdo = floor(suggestedRaw / 10) * 10
        let current = max(lastOdo(for: vehicle.id) ?? marked, marked)
        let kmLeft = max(0, emptyOdo - current)
        let kmUntilSuggested = max(0, suggestedRefuelOdo - current)

        let status: ReserveRangeStatus
        if kmLeft <= reserveRangeKm * 0.10 || current >= emptyOdo {
            status = .critical
        } else if current >= suggestedRefuelOdo || kmUntilSuggested <= 0 {
            status = .refuelSoon
        } else {
            status = .ok
        }

        return ReserveRangeEstimate(
            reserveLitres: litres,
            reserveRangeKm: reserveRangeKm,
            markedOdo: marked,
            emptyOdo: emptyOdo,
            suggestedRefuelOdo: suggestedRefuelOdo,
            kmLeft: kmLeft,
            kmUntilSuggested: kmUntilSuggested,
            kmPerL: used,
            estimated: measured == nil,
            status: status
        )
    }

    /// First vehicle currently on reserve that has a usable estimate (featured preferred).
    func activeReserveInsight() -> (vehicle: Vehicle, estimate: ReserveRangeEstimate)? {
        var seen = Set<UUID>()
        var ordered: [Vehicle] = []
        if let featured { ordered.append(featured) }
        ordered.append(contentsOf: vehicles)
        for vehicle in ordered {
            guard seen.insert(vehicle.id).inserted else { continue }
            guard let estimate = reserveRange(for: vehicle), estimate.isActive else { continue }
            return (vehicle, estimate)
        }
        return nil
    }

    func backupData() -> Data {
        let backup = OdoLogBackup(vehicles: vehicles, refuels: allRefuels, maintenance: allMaintenance, trips: allTrips)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return (try? encoder.encode(backup)) ?? Data()
    }

    func importFile(data: Data, filename: String?, replaceVehicleLogs: Bool = false) async throws -> String {
        let name = (filename ?? "").lowercased()
        if name.hasSuffix(".csv") || looksLikeCSV(data) {
            let result = try await importCSVRefuels(data, options: CSVImportOptions(replaceVehicleLogs: replaceVehicleLogs))
            var parts = ["Imported \(result.imported) refuel\(result.imported == 1 ? "" : "s")"]
            if result.duplicates > 0 {
                parts.append("\(result.duplicates) duplicate\(result.duplicates == 1 ? "" : "s") skipped")
            }
            if result.replacedVehicles > 0 {
                parts.append("replaced logs on \(result.replacedVehicles) vehicle\(result.replacedVehicles == 1 ? "" : "s")")
            }
            if result.vehiclesCreated > 0 {
                parts.append("created \(result.vehiclesCreated) vehicle\(result.vehiclesCreated == 1 ? "" : "s")")
            }
            if result.skipped > 0 {
                parts.append("\(result.skipped) invalid skipped")
            }
            return parts.joined(separator: " · ")
        }
        try await importBackup(data)
        return "Backup imported."
    }

    func importCSVRefuels(_ data: Data, options: CSVImportOptions = CSVImportOptions()) async throws -> CSVImportResult {
        let rows = try CSVRefuelImport.parse(data)
        var byName: [String: UUID] = [:]
        for vehicle in vehicles {
            byName[vehicle.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()] = vehicle.id
        }

        var created = 0
        for name in Set(rows.map(\.vehicleName)) {
            let key = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if byName[key] != nil { continue }
            let profile = CSVRefuelImport.guessProfile(for: name)
            let vehicle = try await addVehicle(
                name: name,
                fuelType: profile.fuel,
                icon: profile.icon,
                make: nil,
                modelYear: nil,
                regNumber: nil,
                isGuest: false,
                ownerName: nil,
                hasReserve: false,
                reserveLitres: nil
            )
            byName[key] = vehicle.id
            created += 1
        }

        var replacedVehicles = 0
        if options.replaceVehicleLogs {
            var touched = Set<UUID>()
            for row in rows {
                let key = row.vehicleName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                guard let vehicleId = byName[key], !touched.contains(vehicleId) else { continue }
                touched.insert(vehicleId)
                try await deleteRefuels(for: vehicleId)
                replacedVehicles += 1
            }
            for vehicle in vehicles {
                byName[vehicle.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()] = vehicle.id
            }
        }

        var existingFingerprints = Set(
            allRefuels.compactMap { refuel -> String? in
                guard let odo = refuel.odoKm else { return nil }
                return [
                    refuel.vehicleId.uuidString,
                    refuel.refuelDate,
                    String(format: "%.2f", refuel.amountInr),
                    String(format: "%.3f", refuel.litres),
                    String(format: "%.1f", odo),
                    refuel.fullTank ? "1" : "0",
                ].joined(separator: "|")
            }
        )

        var imported = 0
        var skipped = 0
        var duplicates = 0
        var batchFingerprints = Set<String>()

        for row in rows {
            let key = row.vehicleName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard let vehicleId = byName[key] else {
                skipped += 1
                continue
            }
            let fingerprint = row.fingerprint(vehicleId: vehicleId)
            if existingFingerprints.contains(fingerprint) || batchFingerprints.contains(fingerprint) {
                duplicates += 1
                continue
            }
            batchFingerprints.insert(fingerprint)
            existingFingerprints.insert(fingerprint)

            let refuel = Refuel(
                vehicleId: vehicleId,
                refuelDate: row.refuelDate,
                amountInr: row.amountInr,
                ratePerLitre: row.ratePerLitre,
                litres: row.litres,
                odoKm: row.odoKm,
                fullTank: row.fullTank,
                notes: row.notes
            )
            try upsertLocalRefuel(refuel)
            await pushOrEnqueue(.upsertRefuel(refuel))
            imported += 1
        }

        try refreshLocal(accountId: userId)
        return CSVImportResult(
            imported: imported,
            skipped: skipped,
            duplicates: duplicates,
            vehiclesCreated: created,
            replacedVehicles: replacedVehicles
        )
    }

    func importBackup(_ data: Data) async throws {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let backup = try decoder.decode(OdoLogBackup.self, from: data)
        guard backup.version == 1 else { throw OdoLogError.unsupportedBackup }
        var vehicleIds: [UUID: UUID] = [:]
        for vehicle in backup.vehicles {
            let imported = try await addVehicle(name: vehicle.name, fuelType: vehicle.fuelType, icon: vehicle.icon, make: vehicle.make, modelYear: vehicle.modelYear, regNumber: vehicle.regNumber, isGuest: vehicle.isGuest, ownerName: vehicle.ownerName, hasReserve: vehicle.hasReserve, reserveLitres: vehicle.reserveLitres)
            vehicleIds[vehicle.id] = imported.id
        }
        for refuel in backup.refuels {
            guard let vehicleId = vehicleIds[refuel.vehicleId] else { continue }
            try await insertImportedRefuel(
                vehicleId: vehicleId,
                date: ymdDate(refuel.refuelDate) ?? .now,
                amount: refuel.amountInr,
                rate: refuel.ratePerLitre,
                litres: refuel.litres,
                odoKm: refuel.odoKm,
                fullTank: refuel.fullTank,
                notes: refuel.notes,
                fuelSubtype: refuel.fuelSubtype,
                fuelBrand: refuel.fuelBrand.flatMap(FuelBrand.init(rawValue:)),
                tankState: refuel.tankState
            )
        }
        for log in backup.maintenance {
            guard let vehicleId = vehicleIds[log.vehicleId] else { continue }
            try await addMaintenance(vehicleId: vehicleId, date: ymdDate(log.serviceDate) ?? .now, serviceType: log.serviceType, odoKm: log.odoKm, costInr: log.costInr, notes: log.notes, nextServiceOdo: log.nextServiceOdoKm, nextServiceDate: log.nextServiceDate.flatMap(ymdDate))
        }
        for trip in backup.trips {
            guard let vehicleId = vehicleIds[trip.vehicleId] else { continue }
            try await addTrip(vehicleId: vehicleId, date: ymdDate(trip.tripDate) ?? .now, purpose: trip.purpose, notes: trip.notes, startOdo: trip.startOdoKm, endOdo: trip.endOdoKm, tolls: trip.tollsInr)
        }
        await refresh()
    }

    /// Backup / CSV inserts skip the live “odo must rise” check so historical rows can land.
    private func insertImportedRefuel(
        vehicleId: UUID,
        date: Date,
        amount: Double,
        rate: Double,
        litres: Double,
        odoKm: Double?,
        fullTank: Bool,
        notes: String?,
        fuelSubtype: FuelSubtype?,
        fuelBrand: FuelBrand?,
        tankState: TankState?
    ) async throws {
        guard let odoKm, odoKm > 0 else { throw OdoLogError.odoRequired }
        let ymd = Format.ymd(date)
        let trimmedNotes = notes.flatMap { $0.isEmpty ? nil : $0 }
        let refuel = Refuel(
            vehicleId: vehicleId,
            refuelDate: ymd,
            amountInr: amount,
            ratePerLitre: rate,
            litres: litres,
            odoKm: odoKm,
            fullTank: fullTank,
            notes: trimmedNotes,
            fuelSubtype: fuelSubtype,
            fuelBrand: fuelBrand?.rawValue,
            tankState: tankState
        )
        try upsertLocalRefuel(refuel)
        try refreshLocal(accountId: userId)
        await pushOrEnqueue(.upsertRefuel(refuel))
    }

    private func looksLikeCSV(_ data: Data) -> Bool {
        guard let text = String(data: data.prefix(400), encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
              !text.hasPrefix("{") else { return false }
        let first = text.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
        let lower = first.lowercased()
        return lower.contains("amount_inr") || lower.contains("rate_per_litre") || (lower.contains("vehicle") && lower.contains("date"))
    }

    func spend(in range: SpendRange) -> Double {
        let cal = Calendar(identifier: .gregorian)
        let now = Date()
        return allRefuels.reduce(0) { sum, r in
            guard let date = ymdDate(r.refuelDate) else { return sum + (range == .all ? r.amountInr : 0) }
            switch range {
            case .all: return sum + r.amountInr
            case .year: return cal.component(.year, from: date) == cal.component(.year, from: now) ? sum + r.amountInr : sum
            case .month:
                return cal.isDate(date, equalTo: now, toGranularity: .month) ? sum + r.amountInr : sum
            case .last30:
                return date >= now.addingTimeInterval(-30 * 24 * 3600) ? sum + r.amountInr : sum
            }
        }
    }

    func fuelStats(in range: SpendRange) -> DashboardStats {
        let calendar = Calendar(identifier: .gregorian)
        let now = Date()
        let fills = allRefuels.filter { refuel in
            guard range != .all else { return true }
            guard let date = ymdDate(refuel.refuelDate) else { return false }
            switch range {
            case .all:
                return true
            case .year:
                return calendar.component(.year, from: date) == calendar.component(.year, from: now)
            case .month:
                return calendar.isDate(date, equalTo: now, toGranularity: .month)
            case .last30:
                return date >= now.addingTimeInterval(-30 * 24 * 3600)
            }
        }
        return DashboardStats(
            spend: fills.reduce(0) { $0 + $1.amountInr },
            litres: fills.reduce(0) { $0 + $1.litres },
            count: fills.count
        )
    }

    /// Fuel spend for the calendar month containing `date` (defaults to now).
    func spend(inCalendarMonthOf date: Date = .now) -> Double {
        let cal = Calendar(identifier: .gregorian)
        return allRefuels.reduce(0) { sum, r in
            guard let d = ymdDate(r.refuelDate), cal.isDate(d, equalTo: date, toGranularity: .month) else { return sum }
            return sum + r.amountInr
        }
    }

    func spendPreviousCalendarMonth(from date: Date = .now) -> Double {
        let cal = Calendar(identifier: .gregorian)
        guard let previous = cal.date(byAdding: .month, value: -1, to: date) else { return 0 }
        return spend(inCalendarMonthOf: previous)
    }

    /// Odo kilometres driven ending in the given calendar month (positive deltas whose later fill is in-month).
    func distanceDriven(inCalendarMonthOf date: Date = .now, vehicleId: UUID? = nil) -> Double {
        let cal = Calendar(identifier: .gregorian)
        let ids = vehicleId.map { [$0] } ?? vehicles.map(\.id)
        var total = 0.0
        for id in ids {
            let ordered = refuels(for: id)
                .filter { ($0.odoKm ?? 0) > 0 }
                .sorted {
                    if $0.refuelDate != $1.refuelDate { return $0.refuelDate < $1.refuelDate }
                    return $0.createdAt < $1.createdAt
                }
            guard ordered.count >= 2 else { continue }
            for i in 1..<ordered.count {
                let prev = ordered[i - 1]
                let cur = ordered[i]
                guard let curDate = ymdDate(cur.refuelDate),
                      cal.isDate(curDate, equalTo: date, toGranularity: .month) else { continue }
                let km = (cur.odoKm ?? 0) - (prev.odoKm ?? 0)
                if km > 0 { total += km }
            }
        }
        return total
    }

    func costPerKm(inCalendarMonthOf date: Date = .now, vehicleId: UUID? = nil) -> Double? {
        let km = distanceDriven(inCalendarMonthOf: date, vehicleId: vehicleId)
        guard km > 0 else { return nil }
        let fuel: Double = {
            if let vehicleId {
                let cal = Calendar(identifier: .gregorian)
                return allRefuels
                    .filter { $0.vehicleId == vehicleId }
                    .reduce(0) { sum, r in
                        guard let d = ymdDate(r.refuelDate), cal.isDate(d, equalTo: date, toGranularity: .month) else { return sum }
                        return sum + r.amountInr
                    }
            }
            return spend(inCalendarMonthOf: date)
        }()
        guard fuel > 0 else { return nil }
        return fuel / km
    }

    /// Soft copy for the Log tab: cost/km + how this month compares to last.
    func monthlySpendInsight(vehicleId: UUID? = nil) -> (costPerKm: Double?, line: String)? {
        let thisMonth = vehicleId.map { id in
            let cal = Calendar(identifier: .gregorian)
            return allRefuels.filter { $0.vehicleId == id }.reduce(0.0) { sum, r in
                guard let d = ymdDate(r.refuelDate), cal.isDate(d, equalTo: Date(), toGranularity: .month) else { return sum }
                return sum + r.amountInr
            }
        } ?? spend(in: .month)

        guard thisMonth > 0 || spendPreviousCalendarMonth() > 0 else { return nil }

        let lastMonth = spendPreviousCalendarMonth()
        let cpk = costPerKm(inCalendarMonthOf: .now, vehicleId: vehicleId)

        let line: String
        if lastMonth <= 0 {
            line = "\(Format.rupees(thisMonth)) on fuel this month so far"
        } else if thisMonth < lastMonth {
            let saved = lastMonth - thisMonth
            line = "You’re ahead of last month — \(Format.rupees(saved)) less so far"
        } else if thisMonth > lastMonth {
            let extra = thisMonth - lastMonth
            line = "\(Format.rupees(extra)) more than all of last month — still early is fine"
        } else {
            line = "Matching last month’s spend so far"
        }
        return (cpk, line)
    }

    /// Latest fill with odo for a vehicle (excluding an edit target).
    func previousOdoFill(for vehicleId: UUID, excluding id: UUID? = nil) -> Refuel? {
        refuels(for: vehicleId)
            .filter { $0.id != id && ($0.odoKm ?? 0) > 0 }
            .first
    }

    func firstRefuelDate() -> Date? {
        allRefuels.compactMap { ymdDate($0.refuelDate) }.min()
    }

    var fuelableVehicles: [Vehicle] { vehicles.filter(\.fuelType.isFuelable) }
    var lastAddedFuelable: Vehicle? {
        fuelableVehicles.max { $0.createdAt < $1.createdAt }
    }
    var lastLoggedVehicle: Vehicle? {
        for fill in allRefuels {
            if let vehicle = vehicle(id: fill.vehicleId), vehicle.fuelType.isFuelable {
                return vehicle
            }
        }
        return nil
    }
    var preferredLogVehicle: Vehicle? {
        if let lastLoggedVehicle { return lastLoggedVehicle }
        if let id = storedDefaultVehicleId, let vehicle = vehicle(id: id), vehicle.fuelType.isFuelable {
            return vehicle
        }
        return lastAddedFuelable
    }
    var featured: Vehicle? { preferredLogVehicle ?? lastAddedFuelable ?? vehicles.last }

    func vehicle(id: UUID) -> Vehicle? { vehicles.first { $0.id == id } }

    private var storedDefaultVehicleId: UUID? {
        UUID(uuidString: UserDefaults.standard.string(forKey: "odolog.defaultVehicleId") ?? "")
    }

    private static var strictOdoEnabled: Bool {
        if UserDefaults.standard.object(forKey: "odolog.strictOdoChecks") == nil { return true }
        return UserDefaults.standard.bool(forKey: "odolog.strictOdoChecks")
    }

    enum SpendRange { case all, year, month, last30 }

    private func ymdDate(_ ymd: String) -> Date? {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.date(from: ymd)
    }

    private func refreshCloud(userId: UUID) async throws {
        async let vehiclesTask: [Vehicle] = SupabaseManager.client
            .from("vehicles").select().order("created_at", ascending: true).execute().value
        async let refuelsTask: [Refuel] = SupabaseManager.client
            .from("refuels").select().order("refuel_date", ascending: false).order("created_at", ascending: false).execute().value
        async let maintTask: [MaintenanceLog] = SupabaseManager.client
            .from("maintenance_logs").select().order("service_date", ascending: false).execute().value
        async let tripsTask: [Trip] = SupabaseManager.client
            .from("trips").select().order("trip_date", ascending: false).execute().value
        if let maintenance = try? await maintTask { allMaintenance = maintenance }
        if let trips = try? await tripsTask { allTrips = trips }
        let vehicles = try await vehiclesTask
        let refuels = try await refuelsTask
        if let profile: UserProfile = try? await SupabaseManager.client
            .from("profiles").select("display_name, default_city").eq("id", value: userId).single().execute().value {
            if !profile.displayName.isEmpty { displayName = profile.displayName }
            if !profile.defaultCity.isEmpty { defaultCity = profile.defaultCity }
        }
        applyLoaded(vehicles: vehicles, refuels: refuels)
    }

    private func refreshLocal(accountId: UUID?) throws {
        try LogFuelPerformance.measure("SwiftDataFetches") {
        if accountId == nil {
            defaultCity = UserDefaults.standard.string(forKey: "odolog.localCity") ?? defaultCity
            if let localName = UserDefaults.standard.string(forKey: "odolog.localDisplayName"), !localName.isEmpty {
                displayName = localName
            }
        }
        guard let modelContext else {
            vehicles = []
            allRefuels = []
            recentRefuels = []
            allMaintenance = []
            allTrips = []
            spendByVehicleId = [:]
            lastOdoByVehicleId = [:]
            stats = DashboardStats(spend: 0, litres: 0, count: 0)
            return
        }
        let vehicleRows = try modelContext.fetch(FetchDescriptor<LocalVehicle>(sortBy: [SortDescriptor(\.createdAt, order: .forward)]))
            .filter { $0.accountId == accountId }
        let refuelRows = try modelContext.fetch(FetchDescriptor<LocalRefuel>()).filter { $0.accountId == accountId }
        allMaintenance = (try? modelContext.fetch(FetchDescriptor<LocalMaintenance>()).filter { $0.accountId == accountId }.map(\.asLog)) ?? []
        allTrips = (try? modelContext.fetch(FetchDescriptor<LocalTrip>()).filter { $0.accountId == accountId }.map(\.asTrip)) ?? []
        applyLoaded(vehicles: vehicleRows.map(\.asVehicle), refuels: refuelRows.map(\.asRefuel))
        }
    }

    private func replaceCloudCache(userId: UUID) throws {
        guard let modelContext else { return }
        for row in try modelContext.fetch(FetchDescriptor<LocalVehicle>()) where row.accountId == userId {
            modelContext.delete(row)
        }
        for row in try modelContext.fetch(FetchDescriptor<LocalRefuel>()) where row.accountId == userId {
            modelContext.delete(row)
        }
        for row in try modelContext.fetch(FetchDescriptor<LocalMaintenance>()) where row.accountId == userId {
            modelContext.delete(row)
        }
        for row in try modelContext.fetch(FetchDescriptor<LocalTrip>()) where row.accountId == userId {
            modelContext.delete(row)
        }
        for vehicle in vehicles {
            modelContext.insert(LocalVehicle(from: vehicle, accountId: userId))
        }
        for refuel in allRefuels {
            modelContext.insert(LocalRefuel(from: refuel, accountId: userId))
        }
        for log in allMaintenance {
            modelContext.insert(LocalMaintenance(from: log, accountId: userId))
        }
        for trip in allTrips {
            modelContext.insert(LocalTrip(from: trip, accountId: userId))
        }
        try modelContext.save()
    }

    private func wipeLocalCache(accountId: UUID, options: DataResetOptions) throws {
        guard let modelContext else { return }
        if options.deletesFuelFills {
            for row in try modelContext.fetch(FetchDescriptor<LocalRefuel>()) where row.accountId == accountId {
                modelContext.delete(row)
            }
        }
        if options.deletesMaintenance {
            for row in try modelContext.fetch(FetchDescriptor<LocalMaintenance>()) where row.accountId == accountId {
                modelContext.delete(row)
            }
        }
        if options.deletesTrips {
            for row in try modelContext.fetch(FetchDescriptor<LocalTrip>()) where row.accountId == accountId {
                modelContext.delete(row)
            }
        }
        if options.vehicles {
            for row in try modelContext.fetch(FetchDescriptor<LocalVehicle>()) where row.accountId == accountId {
                modelContext.delete(row)
            }
        }
        try modelContext.save()
    }

    private func upsertLocalVehicle(_ vehicle: Vehicle) throws {
        let context = try requireContext()
        let rows = try context.fetch(FetchDescriptor<LocalVehicle>())
        if let row = rows.first(where: { $0.id == vehicle.id }) {
            row.name = vehicle.name
            row.fuelTypeRaw = vehicle.fuelType.rawValue
            row.iconRaw = vehicle.icon.rawValue
            row.make = vehicle.make
            row.modelYear = vehicle.modelYear
            row.regNumber = vehicle.regNumber
            row.isGuest = vehicle.isGuest
            row.ownerName = vehicle.ownerName
            row.hasReserve = vehicle.hasReserve
            row.reserveLitres = vehicle.reserveLitres
            row.claimedMileageKmpl = vehicle.claimedMileageKmpl
            row.accountId = userId
        } else {
            context.insert(LocalVehicle(from: vehicle, accountId: userId))
        }
        try context.save()
    }

    private func upsertLocalRefuel(_ refuel: Refuel) throws {
        let context = try requireContext()
        let rows = try context.fetch(FetchDescriptor<LocalRefuel>())
        if let row = rows.first(where: { $0.id == refuel.id }) {
            row.vehicleId = refuel.vehicleId
            row.refuelDate = refuel.refuelDate
            row.amountInr = refuel.amountInr
            row.ratePerLitre = refuel.ratePerLitre
            row.litres = refuel.litres
            row.odoKm = refuel.odoKm
            row.fullTank = refuel.fullTank
            row.notes = refuel.notes
            row.fuelSubtypeRaw = refuel.fuelSubtype?.rawValue
            row.fuelBrand = refuel.fuelBrand
            row.tankStateRaw = refuel.tankState?.rawValue
            row.accountId = userId
        } else {
            context.insert(LocalRefuel(from: refuel, accountId: userId))
        }
        try context.save()
    }

    private func upsertLocalMaintenance(_ log: MaintenanceLog) throws {
        let context = try requireContext()
        let rows = try context.fetch(FetchDescriptor<LocalMaintenance>())
        if let row = rows.first(where: { $0.id == log.id }) {
            row.vehicleId = log.vehicleId
            row.serviceDate = log.serviceDate
            row.serviceType = log.serviceType
            row.odoKm = log.odoKm
            row.costInr = log.costInr
            row.notes = log.notes
            row.nextServiceOdoKm = log.nextServiceOdoKm
            row.nextServiceDate = log.nextServiceDate
            row.accountId = userId
        } else {
            context.insert(LocalMaintenance(from: log, accountId: userId))
        }
        try context.save()
    }

    private func upsertLocalTrip(_ trip: Trip) throws {
        let context = try requireContext()
        let rows = try context.fetch(FetchDescriptor<LocalTrip>())
        if let row = rows.first(where: { $0.id == trip.id }) {
            row.vehicleId = trip.vehicleId
            row.startOdoKm = trip.startOdoKm
            row.endOdoKm = trip.endOdoKm
            row.purpose = trip.purpose
            row.tollsInr = trip.tollsInr
            row.notes = trip.notes
            row.tripDate = trip.tripDate
            row.accountId = userId
        } else {
            context.insert(LocalTrip(from: trip, accountId: userId))
        }
        try context.save()
    }

    private func deleteLocalRefuel(id: UUID) throws {
        let context = try requireContext()
        for row in try context.fetch(FetchDescriptor<LocalRefuel>()) where row.id == id {
            context.delete(row)
        }
        try context.save()
    }

    private func deleteLocalMaintenance(id: UUID) throws {
        let context = try requireContext()
        for row in try context.fetch(FetchDescriptor<LocalMaintenance>()) where row.id == id {
            context.delete(row)
        }
        try context.save()
    }

    private func deleteLocalTrip(id: UUID) throws {
        let context = try requireContext()
        for row in try context.fetch(FetchDescriptor<LocalTrip>()) where row.id == id {
            context.delete(row)
        }
        try context.save()
    }

    private func deleteLocalRefuels(for vehicleId: UUID) throws {
        let context = try requireContext()
        for row in try context.fetch(FetchDescriptor<LocalRefuel>()) where row.vehicleId == vehicleId {
            context.delete(row)
        }
        try context.save()
    }

    private func requireContext() throws -> ModelContext {
        guard let modelContext else { throw OdoLogError.notFound }
        return modelContext
    }

    private func pushOrEnqueue(_ op: PendingSyncOp) async {
        guard userId != nil else { return }
        guard NetworkMonitor.shared.isOnline else {
            PendingSyncQueue.enqueue(op)
            return
        }
        do {
            try await executePending(op)
        } catch {
            PendingSyncQueue.enqueue(op)
        }
    }

    private func flushPendingOps() async throws {
        guard userId != nil else { return }
        var remaining = PendingSyncQueue.load()
        while !remaining.isEmpty {
            let op = remaining[0]
            try await executePending(op)
            remaining.removeFirst()
            PendingSyncQueue.replace(remaining)
        }
    }

    private func executePending(_ op: PendingSyncOp) async throws {
        guard let userId else { return }
        let client = SupabaseManager.client
        switch op {
        case .upsertVehicle(let vehicle):
            try await client.from("vehicles").upsert(vehicle.asInsert(userId: userId)).execute()
        case .deleteVehicle(let id):
            try await client.from("vehicles").delete().eq("id", value: id).execute()
        case .upsertRefuel(let refuel):
            try await client.from("refuels").upsert(refuel.asInsert(userId: userId)).execute()
        case .deleteRefuel(let id):
            try await client.from("refuels").delete().eq("id", value: id).execute()
        case .deleteRefuelsForVehicle(let vehicleId):
            try await client.from("refuels").delete().eq("vehicle_id", value: vehicleId).execute()
        case .upsertMaintenance(let log):
            try await client.from("maintenance_logs").upsert(log.asInsert(userId: userId)).execute()
        case .deleteMaintenance(let id):
            try await client.from("maintenance_logs").delete().eq("id", value: id).execute()
        case .upsertTrip(let trip):
            try await client.from("trips").upsert(trip.asInsert(userId: userId)).execute()
        case .deleteTrip(let id):
            try await client.from("trips").delete().eq("id", value: id).execute()
        }
    }

    private func applyLoaded(vehicles: [Vehicle], refuels: [Refuel]) {
        let claimed = Self.claimedMileageMap()
        self.vehicles = vehicles.map { vehicle in
            var copy = vehicle
            if copy.claimedMileageKmpl == nil {
                copy.claimedMileageKmpl = claimed[vehicle.id.uuidString]
            }
            return copy
        }
        let sorted = refuels.sorted {
            if $0.refuelDate != $1.refuelDate { return $0.refuelDate > $1.refuelDate }
            return $0.createdAt > $1.createdAt
        }
        allRefuels = sorted

        var spendMap: [UUID: Double] = [:]
        var odoMap: [UUID: Double] = [:]
        spendMap.reserveCapacity(vehicles.count)
        odoMap.reserveCapacity(vehicles.count)
        for refuel in sorted {
            spendMap[refuel.vehicleId, default: 0] += refuel.amountInr
            if let odo = refuel.odoKm {
                odoMap[refuel.vehicleId] = max(odoMap[refuel.vehicleId] ?? 0, odo)
            }
        }
        spendByVehicleId = spendMap
        lastOdoByVehicleId = odoMap

        let byId = Dictionary(uniqueKeysWithValues: vehicles.map { ($0.id, $0) })
        recentRefuels = Array(sorted.prefix(8)).map { refuel in
            let vehicle = byId[refuel.vehicleId]
            return RefuelWithVehicle(
                refuel: refuel,
                vehicleName: vehicle?.displayName ?? "Unknown",
                vehicleIcon: vehicle?.icon ?? .car,
                vehicleId: refuel.vehicleId
            )
        }
        stats = DashboardStats(
            spend: sorted.reduce(0) { $0 + $1.amountInr },
            litres: sorted.reduce(0) { $0 + $1.litres },
            count: sorted.count
        )
    }

    private func deleteLocalVehicle(id: UUID, context: ModelContext) throws {
        for row in try context.fetch(FetchDescriptor<LocalRefuel>()) where row.vehicleId == id {
            context.delete(row)
        }
        for row in try context.fetch(FetchDescriptor<LocalMaintenance>()) where row.vehicleId == id {
            context.delete(row)
        }
        for row in try context.fetch(FetchDescriptor<LocalTrip>()) where row.vehicleId == id {
            context.delete(row)
        }
        for row in try context.fetch(FetchDescriptor<LocalVehicle>()) where row.id == id {
            context.delete(row)
        }
        try context.save()
    }

    private struct MileageChainBreakRecord: Codable {
        let vehicleId: UUID
        let date: String
        let createdAt: Date
        let reason: String?
    }

    private enum MileageChainBreakReason: String {
        case editedOrDeletedLog
        case reserveClearedWithoutRefuel
    }

    private static let mileageEditedRefuelsKey = "odolog.mileage.editedRefuels"
    private static let mileageChainBreaksKey = "odolog.mileage.chainBreaks"
    private static let claimedMileageKey = "odolog.claimedMileageKmpl"

    private func markMileageRefuelEdited(_ id: UUID) {
        var ids = Set(UserDefaults.standard.stringArray(forKey: Self.mileageEditedRefuelsKey) ?? [])
        ids.insert(id.uuidString)
        UserDefaults.standard.set(Array(ids), forKey: Self.mileageEditedRefuelsKey)
    }

    private func recordMileageChainBreak(for refuel: Refuel) {
        recordMileageChainBreak(
            vehicleId: refuel.vehicleId,
            date: refuel.refuelDate,
            createdAt: refuel.createdAt,
            reason: .editedOrDeletedLog
        )
    }

    private func recordMileageChainBreak(
        vehicleId: UUID,
        date: String,
        createdAt: Date,
        reason: MileageChainBreakReason
    ) {
        var records = mileageChainBreaks()
        records.append(.init(
            vehicleId: vehicleId,
            date: date,
            createdAt: createdAt,
            reason: reason.rawValue
        ))
        if let data = try? JSONEncoder().encode(records) {
            UserDefaults.standard.set(data, forKey: Self.mileageChainBreaksKey)
        }
    }

    private func mileageChainBreaks() -> [MileageChainBreakRecord] {
        guard let data = UserDefaults.standard.data(forKey: Self.mileageChainBreaksKey) else { return [] }
        return (try? JSONDecoder().decode([MileageChainBreakRecord].self, from: data)) ?? []
    }

    private static func claimedMileageMap() -> [String: Double] {
        let raw = UserDefaults.standard.dictionary(forKey: claimedMileageKey) ?? [:]
        var out: [String: Double] = [:]
        for (key, value) in raw {
            if let number = value as? NSNumber { out[key] = number.doubleValue }
            else if let number = value as? Double { out[key] = number }
        }
        return out
    }

    private func persistClaimedMileage(_ value: Double?, for id: UUID) {
        var map = Self.claimedMileageMap()
        if let value, value > 0 {
            map[id.uuidString] = value
        } else {
            map.removeValue(forKey: id.uuidString)
        }
        UserDefaults.standard.set(map, forKey: Self.claimedMileageKey)
    }
}

private extension AnyJSON {
    var stringValue: String? {
        switch self {
        case .string(let value): value
        default: nil
        }
    }
}
