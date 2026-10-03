import Foundation

enum PendingSyncOp: Codable, Equatable {
    case upsertVehicle(Vehicle)
    case deleteVehicle(UUID)
    case upsertRefuel(Refuel)
    case deleteRefuel(UUID)
    case deleteRefuelsForVehicle(UUID)
    case upsertMaintenance(MaintenanceLog)
    case deleteMaintenance(UUID)
    case upsertTrip(Trip)
    case deleteTrip(UUID)
}

enum PendingSyncQueue {
    private static let key = "odolog.pendingSyncOps"

    static func load() -> [PendingSyncOp] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let ops = try? JSONDecoder().decode([PendingSyncOp].self, from: data) else { return [] }
        return ops
    }

    static func save(_ ops: [PendingSyncOp]) {
        if ops.isEmpty {
            UserDefaults.standard.removeObject(forKey: key)
            return
        }
        if let data = try? JSONEncoder().encode(ops) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    static func enqueue(_ op: PendingSyncOp) {
        var ops = load()
        ops.append(op)
        save(ops)
    }

    static func replace(_ ops: [PendingSyncOp]) {
        save(ops)
    }
}
