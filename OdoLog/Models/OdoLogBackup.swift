import Foundation

struct OdoLogBackup: Codable, Sendable {
    let version: Int
    let exportedAt: Date
    let vehicles: [Vehicle]
    let refuels: [Refuel]
    let maintenance: [MaintenanceLog]
    let trips: [Trip]

    init(vehicles: [Vehicle], refuels: [Refuel], maintenance: [MaintenanceLog], trips: [Trip]) {
        version = 1
        exportedAt = .now
        self.vehicles = vehicles
        self.refuels = refuels
        self.maintenance = maintenance
        self.trips = trips
    }
}
