import Foundation
import UniformTypeIdentifiers

struct CSVImportResult: Sendable {
    var imported: Int
    var skipped: Int
    var duplicates: Int
    var vehiclesCreated: Int
    var replacedVehicles: Int
}

nonisolated struct CSVImportOptions: Sendable {
    var replaceVehicleLogs: Bool = false
}

enum CSVRefuelImport {
    struct Mapping {
        var vehicle: String?
        var date: String?
        var odo: String?
        var amount: String?
        var rate: String?
        var litres: String?
        var fullTank: String?
        var notes: String?
    }

    struct RowPayload: Sendable {
        var vehicleName: String
        var refuelDate: String
        var amountInr: Double
        var ratePerLitre: Double
        var litres: Double
        var odoKm: Double
        var fullTank: Bool
        var notes: String?

        func fingerprint(vehicleId: UUID) -> String {
            [
                vehicleId.uuidString,
                refuelDate,
                String(format: "%.2f", amountInr),
                String(format: "%.3f", litres),
                String(format: "%.1f", odoKm),
                fullTank ? "1" : "0",
            ].joined(separator: "|")
        }
    }

    private enum Field: CaseIterable {
        case vehicle, date, odo, amount, rate, litres, fullTank, notes

        var keys: [String] {
            switch self {
            case .vehicle: ["vehicle", "vehicle_name", "car", "bike", "name"]
            case .date: ["date", "refuel_date", "fill date", "filldate", "datetime", "day"]
            case .odo: ["odo", "odometer", "odometer (km)", "odometer_km", "mileage", "kms", "kilometers", "total_km", "odo_km"]
            case .amount: ["amount", "cost", "total cost", "total_cost", "price", "total", "amount_inr", "expense", "total price"]
            case .rate: ["rate", "price/unit", "unit price", "unit_price", "rate_per_litre", "price per litre", "price per liter", "rate/l", "ppl"]
            case .litres: ["litres", "liters", "volume", "quantity", "fuel volume", "fuel_volume", "qty", "litre", "liter", "gallons"]
            case .fullTank: ["full", "full tank", "fulltank", "full_tank", "is_full"]
            case .notes: ["notes", "note", "comment", "comments", "remark", "remarks"]
            }
        }
    }

    static var allowedContentTypes: [UTType] {
        // Keep this broad: Safari/Files often tags Downloads as public.data
        // (or a dynamic UTI) instead of public.json / public.comma-separated-values-text.
        var types: [UTType] = [
            .json,
            .commaSeparatedText,
            .tabSeparatedText,
            .delimitedText,
            .plainText,
            .utf8PlainText,
            .text,
            .spreadsheet,
            .data,
            .content,
            .item,
        ]
        if let csv = UTType(filenameExtension: "csv") { types.insert(csv, at: 0) }
        if let json = UTType(filenameExtension: "json") { types.insert(json, at: 0) }
        if let txt = UTType(filenameExtension: "txt") { types.insert(txt, at: 0) }
        return types
    }

    /// Reads a security-scoped Files URL reliably (iCloud / Downloads copies included).
    static func readFileData(from url: URL) throws -> Data {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }

        var coordinatorError: NSError?
        var data: Data?
        var readError: Error?
        NSFileCoordinator().coordinate(readingItemAt: url, options: [.withoutChanges], error: &coordinatorError) { coordinatedURL in
            do {
                data = try Data(contentsOf: coordinatedURL, options: [.mappedIfSafe])
            } catch {
                // Fall back to a local temp copy — needed for some iCloud placeholders.
                do {
                    let temp = FileManager.default.temporaryDirectory
                        .appendingPathComponent("odolog-import-\(UUID().uuidString)-\(coordinatedURL.lastPathComponent)")
                    try FileManager.default.copyItem(at: coordinatedURL, to: temp)
                    defer { try? FileManager.default.removeItem(at: temp) }
                    data = try Data(contentsOf: temp)
                } catch {
                    readError = error
                }
            }
        }
        if let coordinatorError { throw coordinatorError }
        if let readError { throw readError }
        guard let data, !data.isEmpty else { throw OdoLogError.emptyImport }
        return data
    }

    static func parse(_ data: Data) throws -> [RowPayload] {
        guard let text = String(data: data, encoding: .utf8)
            ?? String(data: data, encoding: .isoLatin1) else {
            throw OdoLogError.unsupportedBackup
        }
        let cleaned = text.hasPrefix("\u{FEFF}") ? String(text.dropFirst()) : text
        let parsed = parseCSV(cleaned)
        guard !parsed.headers.isEmpty, !parsed.rows.isEmpty else {
            throw OdoLogError.emptyImport
        }
        let mapping = autoMap(parsed.headers)
        guard mapping.date != nil else { throw OdoLogError.csvMissingDate }
        guard mapping.vehicle != nil else { throw OdoLogError.csvMissingVehicle }

        var out: [RowPayload] = []
        for row in parsed.rows {
            if let payload = build(row: row, mapping: mapping) {
                out.append(payload)
            }
        }
        guard !out.isEmpty else { throw OdoLogError.emptyImport }

        return out.sorted {
            if $0.refuelDate != $1.refuelDate { return $0.refuelDate < $1.refuelDate }
            return $0.odoKm < $1.odoKm
        }
    }

    static func guessProfile(for name: String) -> (fuel: FuelType, icon: VehicleIconKind) {
        let n = name.lowercased()
        let bikeHints = ["bullet", "glamour", "pulsar", "splendor", "apache", "duke", "classic", "hunter", "meteor", "raider", "shine", "hf deluxe", "mt-15", "mt 15"]
        let scooterHints = ["activa", "dio", "jupiter", "ntorq", "access", "burgman", "fascino", "pleasure", "sr 160"]
        let dieselHints = ["pajero", "fortuner", "scorpio", "thar", "harrier", "safari", "innova", "e 220", "e220", "xuv", "creta diesel"]
        if scooterHints.contains(where: { n.contains($0) }) { return (.petrol, .scooter) }
        if bikeHints.contains(where: { n.contains($0) }) { return (.petrol, .bike) }
        if dieselHints.contains(where: { n.contains($0) }) { return (.diesel, .car) }
        if let hit = VehicleCatalog.entries.first(where: {
            n.contains($0.model.lowercased()) || $0.title.lowercased().contains(n)
        }) {
            return (hit.fuel, hit.kind)
        }
        return (.petrol, .car)
    }

    private static func autoMap(_ headers: [String]) -> Mapping {
        let lower = headers.map { $0.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) }
        func find(_ keys: [String]) -> String? {
            for k in keys {
                if let idx = lower.firstIndex(of: k) { return headers[idx] }
            }
            for k in keys {
                if let idx = lower.firstIndex(where: { $0.contains(k) }) { return headers[idx] }
            }
            return nil
        }
        return Mapping(
            vehicle: find(Field.vehicle.keys),
            date: find(Field.date.keys),
            odo: find(Field.odo.keys),
            amount: find(Field.amount.keys),
            rate: find(Field.rate.keys),
            litres: find(Field.litres.keys),
            fullTank: find(Field.fullTank.keys),
            notes: find(Field.notes.keys)
        )
    }

    private static func build(row: [String: String], mapping: Mapping) -> RowPayload? {
        let vehicleName = mapping.vehicle.flatMap { row[$0] }?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !vehicleName.isEmpty else { return nil }

        let dateRaw = mapping.date.flatMap { row[$0] } ?? ""
        guard let date = normaliseDate(dateRaw) else { return nil }

        var amount = mapping.amount.flatMap { toNum(row[$0] ?? "") }
        var rate = mapping.rate.flatMap { toNum(row[$0] ?? "") }
        var litres = mapping.litres.flatMap { toNum(row[$0] ?? "") }

        if amount == nil, let rate, let litres { amount = rate * litres }
        if rate == nil, let amount, let litres, litres > 0 { rate = amount / litres }
        if litres == nil, let amount, let rate, rate > 0 { litres = amount / rate }

        guard let amount, let rate, let litres, rate > 0, litres > 0, amount > 0 else { return nil }
        guard let odo = mapping.odo.flatMap({ toNum(row[$0] ?? "") }), odo > 0 else { return nil }

        let fullRaw = (mapping.fullTank.flatMap { row[$0] } ?? "").lowercased()
        let fullTank = ["true", "1", "yes", "y", "full"].contains(fullRaw)
        let notes = mapping.notes.flatMap { row[$0] }?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedNotes = (notes?.isEmpty == false) ? notes : nil

        return RowPayload(
            vehicleName: vehicleName,
            refuelDate: date,
            amountInr: (amount * 100).rounded() / 100,
            ratePerLitre: (rate * 1000).rounded() / 1000,
            litres: (litres * 1000).rounded() / 1000,
            odoKm: odo,
            fullTank: fullTank,
            notes: trimmedNotes
        )
    }

    private static func normaliseDate(_ value: String) -> String? {
        let v = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !v.isEmpty else { return nil }
        if let iso = v.range(of: #"^\d{4}-\d{2}-\d{2}"#, options: .regularExpression) {
            return String(v[iso])
        }
        let pattern = #"^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})"#
        if let match = try? NSRegularExpression(pattern: pattern).firstMatch(in: v, range: NSRange(v.startIndex..., in: v)),
           let dRange = Range(match.range(at: 1), in: v),
           let mRange = Range(match.range(at: 2), in: v),
           let yRange = Range(match.range(at: 3), in: v) {
            let dd = String(v[dRange]).padLeft(to: 2, with: "0")
            let mm = String(v[mRange]).padLeft(to: 2, with: "0")
            var yyyy = String(v[yRange])
            if yyyy.count == 2 { yyyy = "20\(yyyy)" }
            return "\(yyyy)-\(mm)-\(dd)"
        }
        return nil
    }

    private static func toNum(_ value: String) -> Double? {
        let cleaned = value.replacingOccurrences(of: #"[₹$,\s]"#, with: "", options: .regularExpression)
        guard !cleaned.isEmpty, let n = Double(cleaned), n.isFinite else { return nil }
        return n
    }

    private static func parseCSV(_ text: String) -> (headers: [String], rows: [[String: String]]) {
        var lines: [[String]] = []
        var cur = ""
        var row: [String] = []
        var inQuotes = false
        let chars = Array(text)
        var i = 0
        while i < chars.count {
            let c = chars[i]
            if inQuotes {
                if c == "\"" {
                    if i + 1 < chars.count, chars[i + 1] == "\"" {
                        cur.append("\"")
                        i += 1
                    } else {
                        inQuotes = false
                    }
                } else {
                    cur.append(c)
                }
            } else if c == "\"" {
                inQuotes = true
            } else if c == "," {
                row.append(cur)
                cur = ""
            } else if c == "\n" || c == "\r" {
                if !cur.isEmpty || !row.isEmpty {
                    row.append(cur)
                    lines.append(row)
                    row = []
                    cur = ""
                }
                if c == "\r", i + 1 < chars.count, chars[i + 1] == "\n" { i += 1 }
            } else {
                cur.append(c)
            }
            i += 1
        }
        if !cur.isEmpty || !row.isEmpty {
            row.append(cur)
            lines.append(row)
        }
        guard let headerLine = lines.first else { return ([], []) }
        let headers = headerLine.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        let rows = lines.dropFirst()
            .filter { $0.contains { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty } }
            .map { cells -> [String: String] in
                var dict: [String: String] = [:]
                for (idx, header) in headers.enumerated() where !header.isEmpty {
                    dict[header] = idx < cells.count
                        ? cells[idx].trimmingCharacters(in: .whitespacesAndNewlines)
                        : ""
                }
                return dict
            }
        return (headers, rows)
    }
}

private extension String {
    func padLeft(to length: Int, with char: Character) -> String {
        if count >= length { return self }
        return String(repeating: char, count: length - count) + self
    }
}
