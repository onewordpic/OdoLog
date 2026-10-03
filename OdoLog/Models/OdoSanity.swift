import Foundation

/// Soft checks before a fill is saved — typos that poison km/L.
enum OdoSanity {
    enum Issue: Identifiable, Equatable {
        case bigJump(km: Double, days: Int?)
        case absurdKmpl(kmpl: Double, expected: ClosedRange<Double>)

        var id: String {
            switch self {
            case .bigJump: "jump"
            case .absurdKmpl: "kmpl"
            }
        }

        var title: String {
            switch self {
            case .bigJump: "Unusually large jump"
            case .absurdKmpl: "Mileage looks off"
            }
        }

        var message: String {
            switch self {
            case .bigJump(let km, let days):
                if let days, days > 0 {
                    return "That’s \(Format.km(km)) since the last fill (\(days) day\(days == 1 ? "" : "s")). Confirm the odo is right."
                }
                return "That’s \(Format.km(km)) since the last fill. Confirm the odo is right."
            case .absurdKmpl(let kmpl, let expected):
                return String(
                    format: "This fill implies %.1f km/L (typical for this vehicle is about %.0f–%.0f). Check odo or litres.",
                    kmpl,
                    expected.lowerBound,
                    expected.upperBound
                )
            }
        }
    }

    static func check(
        vehicle: Vehicle,
        odoKm: Double,
        litres: Double?,
        date: Date,
        previousOdo: Double?,
        previousDateYMD: String?
    ) -> [Issue] {
        var issues: [Issue] = []
        guard let previous = previousOdo, previous > 0 else { return issues }

        if odoKm <= previous { return issues }

        let delta = odoKm - previous
        let days: Int? = {
            guard let ymd = previousDateYMD, let prevDate = Format.date(fromYMD: ymd) else { return nil }
            let start = Calendar.current.startOfDay(for: prevDate)
            let end = Calendar.current.startOfDay(for: date)
            return max(0, Calendar.current.dateComponents([.day], from: start, to: end).day ?? 0)
        }()

        let jumpLimit = maxJumpKm(for: vehicle, days: days)
        if delta > jumpLimit {
            issues.append(.bigJump(km: delta, days: days))
        }

        if let litres, litres > 0, delta > 0 {
            let kmpl = delta / litres
            let band = plausibleKmpl(for: vehicle)
            // Soften: only warn well outside the band (partial fills often look weird)
            let softLow = band.lowerBound * 0.55
            let softHigh = band.upperBound * 1.55
            if kmpl < softLow || kmpl > softHigh {
                issues.append(.absurdKmpl(kmpl: kmpl, expected: band))
            }
        }

        return issues
    }

    static func plausibleKmpl(for vehicle: Vehicle) -> ClosedRange<Double> {
        switch (vehicle.icon, vehicle.fuelType) {
        case (.bike, .petrol), (.scooter, .petrol):
            return 25...70
        case (.bike, _), (.scooter, _):
            return 20...80
        case (.car, .diesel):
            return 10...30
        case (.car, .cng):
            return 12...35
        case (.car, .petrol):
            return 8...25
        case (.car, .electric):
            return 5...20
        }
    }

    private static func maxJumpKm(for vehicle: Vehicle, days: Int?) -> Double {
        let perDay: Double = {
            switch vehicle.icon {
            case .bike, .scooter: return 450
            case .car: return 800
            }
        }()
        let absolute: Double = {
            switch vehicle.icon {
            case .bike, .scooter: return 1_200
            case .car: return 2_500
            }
        }()
        guard let days, days > 0 else { return absolute }
        return max(absolute, Double(days) * perDay)
    }
}
