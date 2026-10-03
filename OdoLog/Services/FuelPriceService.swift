import Foundation

enum IndianCities {
    static let popular = [
        "Delhi", "Mumbai", "Bengaluru", "Chennai", "Kolkata", "Hyderabad",
        "Pune", "Ahmedabad", "Jaipur", "Chandigarh", "Kochi", "Thiruvananthapuram",
        "Kozhikode", "Lucknow", "Kanpur", "Nagpur", "Indore", "Bhopal",
        "Patna", "Ranchi", "Bhubaneswar", "Guwahati", "Surat", "Vadodara",
        "Coimbatore", "Madurai", "Mysuru", "Visakhapatnam", "Vijayawada",
        "Noida", "Gurugram", "Faridabad", "Ghaziabad", "Dehradun", "Jammu",
        "Srinagar", "Amritsar", "Ludhiana", "Jalandhar", "Raipur", "Nashik",
        "Aurangabad", "Mangaluru", "Hubballi", "Tiruchirappalli", "Salem",
        "Puducherry", "Panaji", "Shimla", "Agra", "Varanasi", "Prayagraj",
    ]

    static let aliases: [String: String] = [
        "thiruvananthapuram": "trivandrum",
        "tvm": "trivandrum",
        "kochi": "ernakulam",
        "cochin": "ernakulam",
        "kozhikode": "calicut",
        "bengaluru": "bangalore",
        "mumbai": "mumbai",
        "gurugram": "gurgaon",
        "vadodara": "vadodara",
        "prayagraj": "allahabad",
        "puducherry": "pondicherry",
        "vizag": "visakhapatnam",
        "hubballi": "hubli",
        "mysuru": "mysore",
        "tiruchirappalli": "trichy",
        "noida": "noida",
        "delhi": "delhi",
        "new delhi": "delhi",
    ]

    static func slug(for city: String) -> String {
        let normalized = city
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return aliases[normalized] ?? normalized
    }
}

struct CityFuelPrices: Sendable, Codable {
    var city: String
    var petrol: Double?
    var diesel: Double?
    var cng: Double?
    var source: String
    var fetchedAt: Date
}

enum FuelPriceError: LocalizedError {
    case cityNotFound(String)
    case parseFailed
    case network(String)

    var errorDescription: String? {
        switch self {
        case .cityNotFound(let city):
            "No published rate for \(city). Try a nearby city or enter the rate yourself."
        case .parseFailed:
            "Couldn't read today's rate. Enter it manually."
        case .network(let message):
            message
        }
    }
}

enum FuelPriceClient {
    static func fetch(city: String) async throws -> CityFuelPrices {
        async let petrol = fetchOne(city: city, fuel: "petrol")
        async let diesel = fetchOne(city: city, fuel: "diesel")
        async let cng = fetchOne(city: city, fuel: "cng")
        let p = try await petrol
        let d = try? await diesel
        let c = try? await cng
        return CityFuelPrices(
            city: city,
            petrol: p,
            diesel: d,
            cng: c,
            source: "goodreturns.in",
            fetchedAt: .now
        )
    }

    static func fetchOne(city: String, fuel: String) async throws -> Double {
        let slug = IndianCities.slug(for: city)
        guard let url = URL(string: "https://www.goodreturns.in/\(fuel)-price-in-\(slug).html") else {
            throw FuelPriceError.cityNotFound(city)
        }
        var request = URLRequest(url: url)
        request.setValue(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            forHTTPHeaderField: "User-Agent"
        )
        request.setValue("text/html", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 20

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw FuelPriceError.parseFailed }
        if (300..<400).contains(http.statusCode) {
            throw FuelPriceError.cityNotFound(city)
        }
        guard http.statusCode == 200, let html = String(data: data, encoding: .utf8) else {
            throw FuelPriceError.network("Source returned \(http.statusCode)")
        }
        if let price = parsePrice(from: html, fuel: fuel) { return price }
        throw FuelPriceError.parseFailed
    }

    private static func parsePrice(from html: String, fuel: String) -> Double? {
        if let title = html.range(of: "<title>([^<]+)</title>", options: .regularExpression) {
            let text = String(html[title])
            if let price = firstRate(in: text, fuel: fuel) { return price }
        }
        // The main rate sentence is fuel-specific. Do not scan the whole page:
        // its header contains prices for other fuels and can cause a wrong rate.
        let pattern = "\\(fuel.capitalized) price[^.]{0,180}(?:stands at|is)\\s*(?:₹|Rs\\.?)\\s*([0-9]{2,3}\\.[0-9]{1,2})"
        return captureRate(in: html, pattern: pattern, fuel: fuel)
    }

    private static func firstRate(in text: String, fuel: String) -> Double? {
        captureRate(in: text, pattern: #"(?:Today[^₹R]{0,80})?(?:Rs\.?|₹|INR)\s*([0-9]{2,3}\.[0-9]{1,2})"#, fuel: fuel)
    }

    private static func captureRate(in text: String, pattern: String, fuel: String) -> Double? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else { return nil }
        let ns = text as NSString
        let matches = regex.matches(in: text, range: NSRange(location: 0, length: ns.length))
        for match in matches where match.numberOfRanges > 1 {
            let value = Double(ns.substring(with: match.range(at: 1)))
            let range: ClosedRange<Double> = fuel == "cng" ? 40...150 : 60...200
            if let value, range.contains(value) { return value }
        }
        return nil
    }
}

@Observable
@MainActor
final class FuelPriceStore {
    var city: String {
        didSet { UserDefaults.standard.set(city, forKey: "odolog.fuelCity") }
    }
    var prices: CityFuelPrices?
    var isLoading = false
    var errorMessage: String?

    init() {
        city = UserDefaults.standard.string(forKey: "odolog.fuelCity") ?? "Delhi"
        if let data = UserDefaults.standard.data(forKey: "odolog.fuelPrices"),
           let cached = try? JSONDecoder().decode(CityFuelPrices.self, from: data),
           cached.city.caseInsensitiveCompare(city) == .orderedSame {
            prices = cached
        }
    }

    func price(for fuelType: FuelType) -> Double? {
        switch fuelType {
        case .petrol: prices?.petrol
        case .diesel: prices?.diesel
        case .cng: prices?.cng
        case .electric: nil
        }
    }

    func refresh(fetch: @escaping (String) async throws -> CityFuelPrices = FuelPriceClient.fetch) async {
        guard !isLoading else { return }
        guard NetworkMonitor.shared.isOnline else {
            errorMessage = nil
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let next = try await fetch(city)
            prices = next
            if let data = try? JSONEncoder().encode(next) {
                UserDefaults.standard.set(data, forKey: "odolog.fuelPrices")
            }
        } catch {
            if !RefreshError.isCancellation(error) {
                errorMessage = error.localizedDescription
            }
        }
    }

    func selectCity(_ newCity: String) async {
        city = newCity
        await refresh()
    }
}
