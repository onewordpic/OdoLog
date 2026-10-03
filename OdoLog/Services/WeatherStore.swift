import CoreLocation
import Foundation
import MapKit

struct WeatherSnapshot: Equatable {
    var temperatureC: Int
    var weatherCode: Int
    var isDay: Bool
    var fetchedAt: Date

    var symbolName: String {
        WeatherSnapshot.symbol(code: weatherCode, isDay: isDay)
    }

    static func symbol(code: Int, isDay: Bool) -> String {
        switch code {
        case 0:
            return isDay ? "sun.max.fill" : "moon.stars.fill"
        case 1, 2:
            return isDay ? "cloud.sun.fill" : "cloud.moon.fill"
        case 3:
            return "cloud.fill"
        case 45, 48:
            return "cloud.fog.fill"
        case 51, 53, 55, 56, 57:
            return "cloud.drizzle.fill"
        case 61, 63, 65, 66, 67, 80, 81, 82:
            return "cloud.rain.fill"
        case 71, 73, 75, 77, 85, 86:
            return "cloud.snow.fill"
        case 95, 96, 99:
            return "cloud.bolt.fill"
        default:
            return isDay ? "cloud.fill" : "cloud.moon.fill"
        }
    }
}

@Observable
@MainActor
final class WeatherStore {
    var snapshot: WeatherSnapshot?
    var errorMessage: String?
    private(set) var isLoading = false

    private let cacheMinutes: TimeInterval = 45 * 60

    func refresh(for city: String) async {
        guard !isLoading else { return }
        guard NetworkMonitor.shared.isOnline else {
            errorMessage = nil
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        let trimmed = city.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            snapshot = nil
            return
        }

        if let cached = loadWeatherCache(), cached.city.caseInsensitiveCompare(trimmed) == .orderedSame {
            snapshot = cached.snapshot
            if Date().timeIntervalSince(cached.snapshot.fetchedAt) < cacheMinutes {
                return
            }
        }

        guard let coord = await coordinates(for: trimmed) else { return }

        do {
            let next = try await fetchOpenMeteo(lat: coord.lat, lon: coord.lon)
            saveWeatherCache(city: trimmed, snapshot: next)
            snapshot = next
        } catch {
            if !RefreshError.isCancellation(error) {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func coordinates(for city: String) async -> (lat: Double, lon: Double)? {
        if let cached = loadGeoCache(), cached.city.caseInsensitiveCompare(city) == .orderedSame {
            return (cached.lat, cached.lon)
        }
        guard let coord = await geocode(city) else { return nil }
        saveGeoCache(city: city, lat: coord.lat, lon: coord.lon)
        return coord
    }

    private func geocode(_ city: String) async -> (lat: Double, lon: Double)? {
        guard let request = MKGeocodingRequest(addressString: "\(city), India") else {
            return nil
        }
        return await withCheckedContinuation { continuation in
            request.getMapItems { mapItems, _ in
                guard let coordinate = mapItems?.first?.location.coordinate else {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: (coordinate.latitude, coordinate.longitude))
            }
        }
    }

    private func fetchOpenMeteo(lat: Double, lon: Double) async throws -> WeatherSnapshot {
        var comps = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        comps.queryItems = [
            URLQueryItem(name: "latitude", value: String(lat)),
            URLQueryItem(name: "longitude", value: String(lon)),
            URLQueryItem(name: "current", value: "temperature_2m,weather_code,is_day"),
        ]
        guard let url = comps.url else { throw URLError(.badURL) }
        let (data, response) = try await URLSession.shared.data(from: url)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        let decoded = try JSONDecoder().decode(OpenMeteoCurrent.self, from: data)
        return WeatherSnapshot(
            temperatureC: Int(decoded.current.temperature_2m.rounded()),
            weatherCode: decoded.current.weather_code,
            isDay: decoded.current.is_day == 1,
            fetchedAt: .now
        )
    }

    private func loadGeoCache() -> (city: String, lat: Double, lon: Double)? {
        let defaults = UserDefaults.standard
        guard let city = defaults.string(forKey: "odolog.weather.geoCity"),
              defaults.object(forKey: "odolog.weather.lat") != nil,
              defaults.object(forKey: "odolog.weather.lon") != nil else { return nil }
        return (city, defaults.double(forKey: "odolog.weather.lat"), defaults.double(forKey: "odolog.weather.lon"))
    }

    private func saveGeoCache(city: String, lat: Double, lon: Double) {
        let defaults = UserDefaults.standard
        defaults.set(city, forKey: "odolog.weather.geoCity")
        defaults.set(lat, forKey: "odolog.weather.lat")
        defaults.set(lon, forKey: "odolog.weather.lon")
    }

    private func loadWeatherCache() -> (city: String, snapshot: WeatherSnapshot)? {
        let defaults = UserDefaults.standard
        guard let city = defaults.string(forKey: "odolog.weather.city"),
              defaults.object(forKey: "odolog.weather.temp") != nil,
              defaults.object(forKey: "odolog.weather.code") != nil,
              let fetched = defaults.object(forKey: "odolog.weather.fetchedAt") as? Date else { return nil }
        let snapshot = WeatherSnapshot(
            temperatureC: defaults.integer(forKey: "odolog.weather.temp"),
            weatherCode: defaults.integer(forKey: "odolog.weather.code"),
            isDay: defaults.object(forKey: "odolog.weather.isDay") as? Bool ?? true,
            fetchedAt: fetched
        )
        return (city, snapshot)
    }

    private func saveWeatherCache(city: String, snapshot: WeatherSnapshot) {
        let defaults = UserDefaults.standard
        defaults.set(city, forKey: "odolog.weather.city")
        defaults.set(snapshot.temperatureC, forKey: "odolog.weather.temp")
        defaults.set(snapshot.weatherCode, forKey: "odolog.weather.code")
        defaults.set(snapshot.isDay, forKey: "odolog.weather.isDay")
        defaults.set(snapshot.fetchedAt, forKey: "odolog.weather.fetchedAt")
    }
}

private struct OpenMeteoCurrent: Decodable {
    struct Current: Decodable {
        var temperature_2m: Double
        var weather_code: Int
        var is_day: Int
    }

    var current: Current
}
