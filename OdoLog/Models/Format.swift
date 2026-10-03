import Foundation

enum Format {
    static let inr: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "INR"
        f.currencySymbol = "₹"
        f.maximumFractionDigits = 0
        f.locale = Locale(identifier: "en_IN")
        return f
    }()

    static let litreFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 2
        f.minimumFractionDigits = 0
        f.locale = Locale(identifier: "en_IN")
        return f
    }()

    static func rupees(_ value: Double) -> String {
        inr.string(from: NSNumber(value: value)) ?? "₹\(Int(value.rounded()))"
    }

    /// Compact ₹/km for dashboard tiles (one decimal when useful).
    static func rupeesPerKm(_ value: Double) -> String {
        if value >= 100 {
            return "\(rupees(value))/km"
        }
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "INR"
        f.currencySymbol = "₹"
        f.minimumFractionDigits = value < 10 ? 1 : 0
        f.maximumFractionDigits = value < 10 ? 1 : 0
        f.locale = Locale(identifier: "en_IN")
        let base = f.string(from: NSNumber(value: value)) ?? String(format: "₹%.1f", value)
        return "\(base)/km"
    }

    static func compact(_ value: Double) -> String {
        if value >= 100_000 { return String(format: "%.1fL", value / 100_000) }
        return Int(value.rounded()).formatted(.number.locale(Locale(identifier: "en_IN")))
    }

    nonisolated static func km(_ value: Double) -> String {
        "\(Int(value.rounded()).formatted(.number.locale(Locale(identifier: "en_IN")))) km"
    }

    static func litres(_ value: Double) -> String {
        "\(litreFormatter.string(from: NSNumber(value: value)) ?? String(format: "%.2f", value)) L"
    }

    nonisolated static func kmpl(_ value: Double) -> String {
        String(format: "%.1f km/L", value)
    }

    static func dateLabel(_ ymd: String) -> String {
        let inF = DateFormatter()
        inF.calendar = Calendar(identifier: .gregorian)
        inF.locale = Locale(identifier: "en_US_POSIX")
        inF.dateFormat = "yyyy-MM-dd"
        guard let date = inF.date(from: ymd) else { return ymd }
        let out = DateFormatter()
        out.locale = Locale(identifier: "en_IN")
        out.dateStyle = .medium
        return out.string(from: date)
    }

    static func shortDate(_ ymd: String) -> String {
        let inF = DateFormatter()
        inF.calendar = Calendar(identifier: .gregorian)
        inF.locale = Locale(identifier: "en_US_POSIX")
        inF.dateFormat = "yyyy-MM-dd"
        guard let date = inF.date(from: ymd) else { return ymd }
        let out = DateFormatter()
        out.locale = Locale(identifier: "en_IN")
        out.setLocalizedDateFormatFromTemplate("d MMM")
        return out.string(from: date)
    }

    static func ymd(_ date: Date) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    static func date(fromYMD ymd: String) -> Date? {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.date(from: ymd)
    }

    static func monthYear(_ date: Date) -> String {
        date.formatted(.dateTime.month(.wide).year().locale(Locale(identifier: "en_IN")))
    }

    static func greeting(name: String?) -> String {
        let hour = Calendar.current.component(.hour, from: Date())
        let slot: String
        switch hour {
        case 0..<5: slot = "Burning the midnight oil"
        case 5..<12: slot = "Good morning"
        case 12..<17: slot = "Good afternoon"
        case 17..<21: slot = "Good evening"
        default: slot = "Good night"
        }
        let flavours = ["Happy riding", "Safe travels", "Drive safe"]
        let flavour = flavours[Calendar.current.component(.day, from: Date()) % flavours.count]
        let who = name.flatMap { $0.isEmpty ? nil : $0 }.map { ", \($0)" } ?? ", User"
        return (hour % 2 == 0 ? slot : flavour) + who
    }
}
