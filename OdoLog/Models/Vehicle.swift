import Foundation

enum FuelType: String, Codable, CaseIterable, Identifiable {
    case petrol, diesel, cng, electric
    var id: String { rawValue }

    var title: String {
        switch self {
        case .petrol: "Petrol"
        case .diesel: "Diesel"
        case .cng: "CNG"
        case .electric: "Electric"
        }
    }

    var isFuelable: Bool { self != .electric }

    var fallbackKmpl: Double {
        switch self {
        case .petrol: 18
        case .diesel: 22
        case .cng: 25
        case .electric: 0
        }
    }
}

nonisolated enum VehicleIconKind: String, Codable, CaseIterable, Identifiable {
    case car, bike, scooter
    var id: String { rawValue }

    var title: String {
        switch self {
        case .car: "Car"
        case .bike: "Motorbike"
        case .scooter: "Petrol scooter"
        }
    }

    var systemImage: String {
        switch self {
        case .car: "car.fill"
        case .bike: "motorcycle"
        case .scooter: "motorcycle"
        }
    }

    /// Carbureted motorbikes often have a reserve fuel tap. Scooters and most FI bikes do not.
    var supportsReserveTap: Bool {
        self == .bike
    }

    static func normalize(_ raw: String?) -> VehicleIconKind {
        VehicleIconKind(rawValue: raw ?? "") ?? .car
    }
}

enum FuelSubtype: String, Codable, CaseIterable, Identifiable {
    case normal, e20, xp95, xp100
    var id: String { rawValue }
    var title: String {
        switch self {
        case .normal: "Regular"
        case .e20: "E20"
        case .xp95: "XP95"
        case .xp100: "XP100"
        }
    }
}

enum FuelBrand: String, Codable, CaseIterable, Identifiable {
    case iocl, bpcl, hpcl, nayara, jiobp, shell, other
    var id: String { rawValue }
    var title: String {
        switch self {
        case .iocl: "Indian Oil"
        case .bpcl: "Bharat Petroleum"
        case .hpcl: "Hindustan Petroleum"
        case .nayara: "Nayara"
        case .jiobp: "Jio-bp"
        case .shell: "Shell"
        case .other: "Other"
        }
    }
    var short: String {
        switch self {
        case .iocl: "IOCL"
        case .bpcl: "BPCL"
        case .hpcl: "HPCL"
        case .nayara: "Nayara"
        case .jiobp: "Jio-bp"
        case .shell: "Shell"
        case .other: "Other"
        }
    }
}

enum TankState: String, Codable, CaseIterable, Identifiable {
    case main, reserve
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

nonisolated struct Vehicle: Identifiable, Hashable, Codable, Sendable {
    var id: UUID
    var name: String
    var fuelType: FuelType
    var icon: VehicleIconKind
    var make: String?
    var modelYear: Int?
    var regNumber: String?
    var isGuest: Bool
    var ownerName: String?
    var hasReserve: Bool
    var reserveLitres: Double?
    var claimedMileageKmpl: Double?
    var createdAt: Date

    var displayName: String {
        if let make, !make.isEmpty { return "\(make) \(name)" }
        return name
    }

    enum CodingKeys: String, CodingKey {
        case id, name, make, icon
        case fuelType = "fuel_type"
        case modelYear = "model_year"
        case regNumber = "reg_number"
        case isGuest = "is_guest"
        case ownerName = "owner_name"
        case hasReserve = "has_reserve"
        case reserveLitres = "reserve_litres"
        case claimedMileageKmpl = "claimed_mileage_kmpl"
        case createdAt = "created_at"
    }

    init(
        id: UUID = UUID(),
        name: String,
        fuelType: FuelType,
        icon: VehicleIconKind,
        make: String? = nil,
        modelYear: Int? = nil,
        regNumber: String? = nil,
        isGuest: Bool = false,
        ownerName: String? = nil,
        hasReserve: Bool = false,
        reserveLitres: Double? = nil,
        claimedMileageKmpl: Double? = nil,
        createdAt: Date = .now
    ) {
        self.id = id
        self.name = name
        self.fuelType = fuelType
        self.icon = icon
        self.make = make
        self.modelYear = modelYear
        self.regNumber = regNumber
        self.isGuest = isGuest
        self.ownerName = ownerName
        self.hasReserve = hasReserve
        self.reserveLitres = reserveLitres
        self.claimedMileageKmpl = claimedMileageKmpl
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        fuelType = try c.decode(FuelType.self, forKey: .fuelType)
        icon = VehicleIconKind.normalize(try c.decodeIfPresent(String.self, forKey: .icon))
        make = try c.decodeIfPresent(String.self, forKey: .make)
        modelYear = try c.decodeIfPresent(Int.self, forKey: .modelYear)
        regNumber = try c.decodeIfPresent(String.self, forKey: .regNumber)
        isGuest = try c.decodeIfPresent(Bool.self, forKey: .isGuest) ?? false
        ownerName = try c.decodeIfPresent(String.self, forKey: .ownerName)
        hasReserve = try c.decodeIfPresent(Bool.self, forKey: .hasReserve) ?? false
        reserveLitres = try c.decodeIfPresent(Double.self, forKey: .reserveLitres)
        claimedMileageKmpl = try c.decodeIfPresent(Double.self, forKey: .claimedMileageKmpl)
        createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt) ?? .now
    }

    /// User-entered claim, then catalog, never a generic fuel-type fallback.
    var resolvedClaimedKmpl: Double? {
        if let claimedMileageKmpl, claimedMileageKmpl > 0 { return claimedMileageKmpl }
        return VehicleCatalog.claimedMileage(make: make, model: name)
    }

    var resolvedReserveLitres: Double? {
        VehicleCatalog.reserveLitres(make: make, model: name)
            ?? reserveLitres.flatMap { $0 > 0 ? $0 : nil }
    }
}

struct VehicleInsert: Encodable, Sendable {
    var id: UUID
    var name: String
    var fuel_type: String
    var icon: String
    var make: String?
    var model_year: Int?
    var reg_number: String?
    var is_guest: Bool
    var owner_name: String?
    var has_reserve: Bool
    var reserve_litres: Double?
    var user_id: UUID
}

struct VehicleUpdate: Encodable, Sendable {
    var name: String
    var fuel_type: String
    var icon: String
    var make: String?
    var model_year: Int?
    var reg_number: String?
    var is_guest: Bool
    var owner_name: String?
    var has_reserve: Bool
    var reserve_litres: Double?
}

enum ReserveAction: String, Codable, Sendable, CaseIterable {
    case entered
    case cleared

    var title: String {
        switch self {
        case .entered: "Switched to reserve"
        case .cleared: "Cleared reserve"
        }
    }
}

struct ReserveEvent: Identifiable, Hashable, Codable, Sendable {
    var id: UUID
    var vehicleId: UUID
    var action: ReserveAction
    var odoKm: Double
    var eventDate: String
    var note: String?
    var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, action, note
        case vehicleId = "vehicle_id"
        case odoKm = "odo_km"
        case eventDate = "event_date"
        case createdAt = "created_at"
    }

    init(
        id: UUID = UUID(),
        vehicleId: UUID,
        action: ReserveAction,
        odoKm: Double,
        eventDate: String = Format.ymd(.now),
        note: String? = nil,
        createdAt: Date = .now
    ) {
        self.id = id
        self.vehicleId = vehicleId
        self.action = action
        self.odoKm = odoKm
        self.eventDate = eventDate
        self.note = note
        self.createdAt = createdAt
    }
}

struct Refuel: Identifiable, Hashable, Codable, Sendable {
    var id: UUID
    var vehicleId: UUID
    var refuelDate: String
    var amountInr: Double
    var ratePerLitre: Double
    var litres: Double
    var odoKm: Double?
    var fullTank: Bool
    var notes: String?
    var fuelSubtype: FuelSubtype?
    var fuelBrand: String?
    var tankState: TankState?
    var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, litres, notes
        case vehicleId = "vehicle_id"
        case refuelDate = "refuel_date"
        case amountInr = "amount_inr"
        case ratePerLitre = "rate_per_litre"
        case odoKm = "odo_km"
        case fullTank = "full_tank"
        case fuelSubtype = "fuel_subtype"
        case fuelBrand = "fuel_brand"
        case tankState = "tank_state"
        case createdAt = "created_at"
    }

    init(
        id: UUID = UUID(),
        vehicleId: UUID,
        refuelDate: String,
        amountInr: Double,
        ratePerLitre: Double,
        litres: Double,
        odoKm: Double?,
        fullTank: Bool,
        notes: String? = nil,
        fuelSubtype: FuelSubtype? = nil,
        fuelBrand: String? = nil,
        tankState: TankState? = nil,
        createdAt: Date = .now
    ) {
        self.id = id
        self.vehicleId = vehicleId
        self.refuelDate = refuelDate
        self.amountInr = amountInr
        self.ratePerLitre = ratePerLitre
        self.litres = litres
        self.odoKm = odoKm
        self.fullTank = fullTank
        self.notes = notes
        self.fuelSubtype = fuelSubtype
        self.fuelBrand = fuelBrand
        self.tankState = tankState
        self.createdAt = createdAt
    }
}

struct RefuelUpdate: Encodable, Sendable {
    var refuel_date: String
    var amount_inr: Double
    var rate_per_litre: Double
    var litres: Double
    var odo_km: Double?
    var full_tank: Bool
    var notes: String?
    var fuel_subtype: String?
    var fuel_brand: String?
    var tank_state: String?
}

struct RefuelInsert: Encodable, Sendable {
    var id: UUID
    var vehicle_id: UUID
    var user_id: UUID
    var refuel_date: String
    var amount_inr: Double
    var rate_per_litre: Double
    var litres: Double
    var odo_km: Double?
    var full_tank: Bool
    var notes: String?
    var fuel_subtype: String?
    var fuel_brand: String?
    var tank_state: String?
}

struct RefuelWithVehicle: Identifiable, Hashable, Sendable {
    var refuel: Refuel
    var vehicleName: String
    var vehicleIcon: VehicleIconKind
    var vehicleId: UUID
    var id: UUID { refuel.id }
}

struct MaintenanceLog: Identifiable, Hashable, Codable, Sendable {
    var id: UUID
    var vehicleId: UUID
    var serviceDate: String
    var serviceType: String
    var odoKm: Double?
    var costInr: Double?
    var notes: String?
    var nextServiceOdoKm: Double?
    var nextServiceDate: String?
    var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, notes
        case vehicleId = "vehicle_id"
        case serviceDate = "service_date"
        case serviceType = "service_type"
        case odoKm = "odo_km"
        case costInr = "cost_inr"
        case nextServiceOdoKm = "next_service_odo_km"
        case nextServiceDate = "next_service_date"
        case createdAt = "created_at"
    }

    init(
        id: UUID = UUID(),
        vehicleId: UUID,
        serviceDate: String,
        serviceType: String,
        odoKm: Double?,
        costInr: Double?,
        notes: String?,
        nextServiceOdoKm: Double?,
        nextServiceDate: String?,
        createdAt: Date = .now
    ) {
        self.id = id
        self.vehicleId = vehicleId
        self.serviceDate = serviceDate
        self.serviceType = serviceType
        self.odoKm = odoKm
        self.costInr = costInr
        self.notes = notes
        self.nextServiceOdoKm = nextServiceOdoKm
        self.nextServiceDate = nextServiceDate
        self.createdAt = createdAt
    }
}

struct MaintenanceUpdate: Encodable, Sendable {
    var service_date: String
    var service_type: String
    var odo_km: Double?
    var cost_inr: Double?
    var notes: String?
    var next_service_odo_km: Double?
    var next_service_date: String?
}

struct MaintenanceInsert: Encodable, Sendable {
    var id: UUID
    var vehicle_id: UUID
    var user_id: UUID
    var service_date: String
    var service_type: String
    var odo_km: Double?
    var cost_inr: Double?
    var notes: String?
    var next_service_odo_km: Double?
    var next_service_date: String?
}

struct Trip: Identifiable, Hashable, Codable, Sendable {
    var id: UUID
    var vehicleId: UUID
    var startOdoKm: Double?
    var endOdoKm: Double?
    var purpose: String?
    var tollsInr: Double?
    var notes: String?
    var tripDate: String
    var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, purpose, notes
        case vehicleId = "vehicle_id"
        case startOdoKm = "start_odo_km"
        case endOdoKm = "end_odo_km"
        case tollsInr = "tolls_inr"
        case tripDate = "trip_date"
        case createdAt = "created_at"
    }

    init(
        id: UUID = UUID(),
        vehicleId: UUID,
        startOdoKm: Double?,
        endOdoKm: Double?,
        purpose: String?,
        tollsInr: Double?,
        notes: String?,
        tripDate: String,
        createdAt: Date = .now
    ) {
        self.id = id
        self.vehicleId = vehicleId
        self.startOdoKm = startOdoKm
        self.endOdoKm = endOdoKm
        self.purpose = purpose
        self.tollsInr = tollsInr
        self.notes = notes
        self.tripDate = tripDate
        self.createdAt = createdAt
    }
}

struct TripInsert: Encodable, Sendable {
    var id: UUID
    var vehicle_id: UUID
    var user_id: UUID
    var start_odo_km: Double?
    var end_odo_km: Double?
    var purpose: String?
    var tolls_inr: Double?
    var notes: String?
    var trip_date: String
}

extension Vehicle {
    func asInsert(userId: UUID) -> VehicleInsert {
        VehicleInsert(
            id: id,
            name: name,
            fuel_type: fuelType.rawValue,
            icon: icon.rawValue,
            make: make,
            model_year: modelYear,
            reg_number: regNumber,
            is_guest: isGuest,
            owner_name: ownerName,
            has_reserve: hasReserve,
            reserve_litres: reserveLitres,
            user_id: userId
        )
    }
}

extension Refuel {
    func asInsert(userId: UUID) -> RefuelInsert {
        RefuelInsert(
            id: id,
            vehicle_id: vehicleId,
            user_id: userId,
            refuel_date: refuelDate,
            amount_inr: amountInr,
            rate_per_litre: ratePerLitre,
            litres: litres,
            odo_km: odoKm,
            full_tank: fullTank,
            notes: notes,
            fuel_subtype: fuelSubtype?.rawValue,
            fuel_brand: fuelBrand,
            tank_state: tankState?.rawValue
        )
    }
}

extension MaintenanceLog {
    func asInsert(userId: UUID) -> MaintenanceInsert {
        MaintenanceInsert(
            id: id,
            vehicle_id: vehicleId,
            user_id: userId,
            service_date: serviceDate,
            service_type: serviceType,
            odo_km: odoKm,
            cost_inr: costInr,
            notes: notes,
            next_service_odo_km: nextServiceOdoKm,
            next_service_date: nextServiceDate
        )
    }
}

extension Trip {
    func asInsert(userId: UUID) -> TripInsert {
        TripInsert(
            id: id,
            vehicle_id: vehicleId,
            user_id: userId,
            start_odo_km: startOdoKm,
            end_odo_km: endOdoKm,
            purpose: purpose,
            tolls_inr: tollsInr,
            notes: notes,
            trip_date: tripDate
        )
    }
}

struct UserProfile: Hashable, Codable, Sendable {
    var displayName: String
    var defaultCity: String

    enum CodingKeys: String, CodingKey {
        case displayName = "display_name"
        case defaultCity = "default_city"
    }
}

struct DashboardStats: Sendable {
    var spend: Double
    var litres: Double
    var count: Int
}

struct RangeEstimate: Sendable {
    var fullRangeKm: Double
    var nextOdo: Double
    var kmLeft: Double
    var litresLeft: Double
    var kmPerL: Double
    var estimated: Bool
}

enum ReserveRangeStatus: Sendable {
    case ok
    case refuelSoon
    case critical
}

struct ReserveRangeEstimate: Sendable {
    var reserveLitres: Double
    var reserveRangeKm: Double
    var markedOdo: Double?
    var emptyOdo: Double?
    var suggestedRefuelOdo: Double?
    var kmLeft: Double?
    var kmUntilSuggested: Double?
    var kmPerL: Double
    var estimated: Bool
    var status: ReserveRangeStatus
    /// True when the user has marked “on reserve” and we have a countdown.
    var isActive: Bool { markedOdo != nil }
}

enum OdoLogError: LocalizedError {
    case missingSecrets
    case notFound
    case odoRequired
    case odoTooLow(last: Double)
    case missingFuelValues
    case confirmEmail
    case unsupportedBackup
    case emptyImport
    case csvMissingDate
    case csvMissingVehicle
    case notSignedIn
    case emptyClipboard

    var errorDescription: String? {
        switch self {
        case .missingSecrets:
            "Supabase URL or anon key is missing. Copy Secrets.example.xcconfig to Secrets.xcconfig."
        case .notFound:
            "Vehicle not found."
        case .odoRequired:
            "Enter the odometer (km). Mileage is measured between two readings."
        case .odoTooLow(let last):
            "Odometer should be higher than the last logged reading (\(Format.km(last))). Edit that previous fill if the old number was wrong."
        case .missingFuelValues:
            "Enter at least two of amount, rate, and litres."
        case .confirmEmail:
            "Check your email to confirm the account, then sign in. You can also confirm on odolog.online."
        case .unsupportedBackup:
            "This backup is not an OdoLog backup that this version can import."
        case .emptyImport:
            "No valid refuel rows found in that file."
        case .csvMissingDate:
            "That CSV needs a date column (for example date or refuel_date)."
        case .csvMissingVehicle:
            "That CSV needs a vehicle column. Export from odolog.online Settings → Export refuels as CSV."
        case .notSignedIn:
            "Sign in with Google or email first to pull data from odolog.online."
        case .emptyClipboard:
            "Clipboard is empty. Copy a CSV or JSON backup, then try again."
        }
    }
}
