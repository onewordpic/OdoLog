import Foundation

nonisolated struct VehicleCatalogEntry: Identifiable, Hashable {
    let make: String
    let model: String
    let kind: VehicleIconKind
    let fuel: FuelType
    var id: String { "\(make)|\(model)|\(kind.rawValue)" }
    var title: String { "\(make) \(model)" }
}

nonisolated enum VehicleCatalog {
    static let entries: [VehicleCatalogEntry] = [
        // Cars
        .init(make: "Maruti Suzuki", model: "Swift", kind: .car, fuel: .petrol), .init(make: "Maruti Suzuki", model: "Baleno", kind: .car, fuel: .petrol), .init(make: "Maruti Suzuki", model: "Wagon R", kind: .car, fuel: .cng), .init(make: "Maruti Suzuki", model: "Brezza", kind: .car, fuel: .petrol), .init(make: "Maruti Suzuki", model: "Ertiga", kind: .car, fuel: .cng),
        .init(make: "Hyundai", model: "i20", kind: .car, fuel: .petrol), .init(make: "Hyundai", model: "Creta", kind: .car, fuel: .petrol), .init(make: "Hyundai", model: "Venue", kind: .car, fuel: .petrol), .init(make: "Hyundai", model: "Verna", kind: .car, fuel: .petrol), .init(make: "Hyundai", model: "Exter", kind: .car, fuel: .cng),
        .init(make: "Tata", model: "Nexon", kind: .car, fuel: .petrol), .init(make: "Tata", model: "Punch", kind: .car, fuel: .cng), .init(make: "Tata", model: "Harrier", kind: .car, fuel: .diesel), .init(make: "Tata", model: "Safari", kind: .car, fuel: .diesel), .init(make: "Tata", model: "Tiago", kind: .car, fuel: .cng),
        .init(make: "Mahindra", model: "Thar", kind: .car, fuel: .diesel), .init(make: "Mahindra", model: "XUV700", kind: .car, fuel: .diesel), .init(make: "Mahindra", model: "Scorpio N", kind: .car, fuel: .diesel), .init(make: "Kia", model: "Seltos", kind: .car, fuel: .petrol), .init(make: "Kia", model: "Sonet", kind: .car, fuel: .diesel),
        .init(make: "Honda", model: "City", kind: .car, fuel: .petrol), .init(make: "Honda", model: "Amaze", kind: .car, fuel: .petrol), .init(make: "Toyota", model: "Innova Crysta", kind: .car, fuel: .diesel), .init(make: "Toyota", model: "Fortuner", kind: .car, fuel: .diesel), .init(make: "Volkswagen", model: "Virtus", kind: .car, fuel: .petrol),
        // Motorbikes
        .init(make: "Royal Enfield", model: "Classic 350", kind: .bike, fuel: .petrol), .init(make: "Royal Enfield", model: "Bullet 350", kind: .bike, fuel: .petrol), .init(make: "Royal Enfield", model: "Hunter 350", kind: .bike, fuel: .petrol), .init(make: "Royal Enfield", model: "Meteor 350", kind: .bike, fuel: .petrol), .init(make: "Bajaj", model: "Pulsar NS200", kind: .bike, fuel: .petrol), .init(make: "Bajaj", model: "Pulsar 150", kind: .bike, fuel: .petrol),
        .init(make: "Hero", model: "Splendor Plus", kind: .bike, fuel: .petrol), .init(make: "Hero", model: "HF Deluxe", kind: .bike, fuel: .petrol), .init(make: "Honda", model: "Shine 125", kind: .bike, fuel: .petrol), .init(make: "Honda", model: "SP 125", kind: .bike, fuel: .petrol), .init(make: "TVS", model: "Apache RTR 160", kind: .bike, fuel: .petrol), .init(make: "TVS", model: "Raider 125", kind: .bike, fuel: .petrol), .init(make: "Yamaha", model: "MT-15", kind: .bike, fuel: .petrol), .init(make: "KTM", model: "Duke 200", kind: .bike, fuel: .petrol),
        // Petrol scooters
        .init(make: "Honda", model: "Activa 6G", kind: .scooter, fuel: .petrol), .init(make: "Honda", model: "Dio", kind: .scooter, fuel: .petrol), .init(make: "TVS", model: "Jupiter 125", kind: .scooter, fuel: .petrol), .init(make: "TVS", model: "Ntorq 125", kind: .scooter, fuel: .petrol), .init(make: "Suzuki", model: "Access 125", kind: .scooter, fuel: .petrol), .init(make: "Suzuki", model: "Burgman Street", kind: .scooter, fuel: .petrol), .init(make: "Yamaha", model: "Fascino 125", kind: .scooter, fuel: .petrol), .init(make: "Hero", model: "Pleasure Plus", kind: .scooter, fuel: .petrol), .init(make: "Aprilia", model: "SR 160", kind: .scooter, fuel: .petrol),
    ]

    static func search(_ query: String, kind: VehicleIconKind) -> [VehicleCatalogEntry] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard q.count >= 2 else { return [] }
        return entries.filter { $0.kind == kind && $0.title.lowercased().contains(q) }.prefix(8).map { $0 }
    }

    static func claimedMileage(make: String?, model: String?) -> Double? {
        let key = "\((make ?? "").lowercased())|\((model ?? "").lowercased())"
        return [
            "maruti suzuki|swift": 22.4, "maruti suzuki|baleno": 22.3, "maruti suzuki|wagon r": 24.4,
            "hyundai|creta": 17.7, "hyundai|i20": 20.0, "tata|nexon": 17.4, "tata|punch": 18.8,
            "mahindra|thar": 15.2, "honda|city": 17.8, "royal enfield|classic 350": 41.0,
            "royal enfield|hunter 350": 36.2, "hero|splendor plus": 80.6, "honda|shine 125": 55.0,
            "honda|sp 125": 65.0, "tvs|apache rtr 160": 45.0, "yamaha|mt-15": 56.9,
            "honda|activa 6g": 50.0, "tvs|jupiter 125": 50.0, "suzuki|access 125": 45.0
        ][key]
    }

    static func reserveLitres(make: String?, model: String?) -> Double? {
        let key = "\((make ?? "").lowercased())|\((model ?? "").lowercased())"
        return [
            "royal enfield|bullet 350": 2.0
        ][key]
    }
}
