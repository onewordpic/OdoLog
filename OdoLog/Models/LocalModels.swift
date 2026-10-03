import Foundation
import SwiftData

@Model
final class LocalVehicle {
    var id: UUID
    var name: String
    var fuelTypeRaw: String
    var iconRaw: String
    var make: String?
    var modelYear: Int?
    var regNumber: String?
    var isGuest: Bool = false
    var ownerName: String?
    var hasReserve: Bool = false
    var reserveLitres: Double?
    var claimedMileageKmpl: Double?
    var createdAt: Date
    /// nil = guest garage; signed-in UUID = cloud cache for that account.
    var accountId: UUID?

    init(from vehicle: Vehicle, accountId: UUID? = nil) {
        id = vehicle.id
        name = vehicle.name
        fuelTypeRaw = vehicle.fuelType.rawValue
        iconRaw = vehicle.icon.rawValue
        make = vehicle.make
        modelYear = vehicle.modelYear
        regNumber = vehicle.regNumber
        isGuest = vehicle.isGuest
        ownerName = vehicle.ownerName
        hasReserve = vehicle.hasReserve
        reserveLitres = vehicle.reserveLitres
        claimedMileageKmpl = vehicle.claimedMileageKmpl
        createdAt = vehicle.createdAt
        self.accountId = accountId
    }

    var asVehicle: Vehicle {
        Vehicle(
            id: id,
            name: name,
            fuelType: FuelType(rawValue: fuelTypeRaw) ?? .petrol,
            icon: VehicleIconKind.normalize(iconRaw),
            make: make,
            modelYear: modelYear,
            regNumber: regNumber,
            isGuest: isGuest,
            ownerName: ownerName,
            hasReserve: hasReserve,
            reserveLitres: reserveLitres,
            claimedMileageKmpl: claimedMileageKmpl,
            createdAt: createdAt
        )
    }
}

@Model
final class LocalRefuel {
    var id: UUID
    var vehicleId: UUID
    var refuelDate: String
    var amountInr: Double
    var ratePerLitre: Double
    var litres: Double
    var odoKm: Double?
    var fullTank: Bool
    var notes: String?
    var fuelSubtypeRaw: String?
    var fuelBrand: String?
    var tankStateRaw: String?
    var createdAt: Date
    var accountId: UUID?

    init(from refuel: Refuel, accountId: UUID? = nil) {
        id = refuel.id
        vehicleId = refuel.vehicleId
        refuelDate = refuel.refuelDate
        amountInr = refuel.amountInr
        ratePerLitre = refuel.ratePerLitre
        litres = refuel.litres
        odoKm = refuel.odoKm
        fullTank = refuel.fullTank
        notes = refuel.notes
        fuelSubtypeRaw = refuel.fuelSubtype?.rawValue
        fuelBrand = refuel.fuelBrand
        tankStateRaw = refuel.tankState?.rawValue
        createdAt = refuel.createdAt
        self.accountId = accountId
    }

    var asRefuel: Refuel {
        Refuel(
            id: id,
            vehicleId: vehicleId,
            refuelDate: refuelDate,
            amountInr: amountInr,
            ratePerLitre: ratePerLitre,
            litres: litres,
            odoKm: odoKm,
            fullTank: fullTank,
            notes: notes,
            fuelSubtype: fuelSubtypeRaw.flatMap(FuelSubtype.init(rawValue:)),
            fuelBrand: fuelBrand,
            tankState: tankStateRaw.flatMap(TankState.init(rawValue:)),
            createdAt: createdAt
        )
    }
}

@Model
final class LocalMaintenance {
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
    var accountId: UUID?

    init(from log: MaintenanceLog, accountId: UUID? = nil) {
        id = log.id
        vehicleId = log.vehicleId
        serviceDate = log.serviceDate
        serviceType = log.serviceType
        odoKm = log.odoKm
        costInr = log.costInr
        notes = log.notes
        nextServiceOdoKm = log.nextServiceOdoKm
        nextServiceDate = log.nextServiceDate
        createdAt = log.createdAt
        self.accountId = accountId
    }

    var asLog: MaintenanceLog {
        MaintenanceLog(
            id: id,
            vehicleId: vehicleId,
            serviceDate: serviceDate,
            serviceType: serviceType,
            odoKm: odoKm,
            costInr: costInr,
            notes: notes,
            nextServiceOdoKm: nextServiceOdoKm,
            nextServiceDate: nextServiceDate,
            createdAt: createdAt
        )
    }
}

@Model
final class LocalTrip {
    var id: UUID
    var vehicleId: UUID
    var startOdoKm: Double?
    var endOdoKm: Double?
    var purpose: String?
    var tollsInr: Double?
    var notes: String?
    var tripDate: String
    var createdAt: Date
    var accountId: UUID?

    init(from trip: Trip, accountId: UUID? = nil) {
        id = trip.id
        vehicleId = trip.vehicleId
        startOdoKm = trip.startOdoKm
        endOdoKm = trip.endOdoKm
        purpose = trip.purpose
        tollsInr = trip.tollsInr
        notes = trip.notes
        tripDate = trip.tripDate
        createdAt = trip.createdAt
        self.accountId = accountId
    }

    var asTrip: Trip {
        Trip(
            id: id,
            vehicleId: vehicleId,
            startOdoKm: startOdoKm,
            endOdoKm: endOdoKm,
            purpose: purpose,
            tollsInr: tollsInr,
            notes: notes,
            tripDate: tripDate,
            createdAt: createdAt
        )
    }
}
