import Foundation
import Supabase

enum SupabaseManager {
    static let client: SupabaseClient = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)
            if let date = Self.isoFractional.date(from: raw) { return date }
            if let date = Self.isoZ.date(from: raw) { return date }
            if let date = Self.isoOffset.date(from: raw) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid date \(raw)")
        }

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601

        let urlString = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? ""
        let key = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String ?? ""
        let url = URL(string: urlString) ?? URL(string: "https://invalid.local")!

        return SupabaseClient(
            supabaseURL: url,
            supabaseKey: key,
            options: SupabaseClientOptions(
                db: .init(encoder: encoder, decoder: decoder),
                auth: .init(emitLocalSessionAsInitialSession: true)
            )
        )
    }()

    static var isConfigured: Bool {
        let url = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? ""
        let key = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String ?? ""
        return url.hasPrefix("https://") && !url.contains("YOUR_PROJECT") && key.count > 20
    }

    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoZ: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let isoOffset: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ssxxxxx"
        return f
    }()
}
