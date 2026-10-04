import Foundation

#if canImport(FoundationModels)
import FoundationModels
#endif

struct FuelEntryCheck: Equatable, Sendable {
    var reason: String?

    var isSuspicious: Bool { reason != nil }
}

enum FuelEntryChecker {
    struct Input: Equatable, Sendable {
        var odometer: Double
        var previousOdometer: Double?
        var amount: Double?
        var litres: Double?
        var expectedRate: Double?
    }

    static func check(_ input: Input, useOnDeviceModel: Bool = true) async -> FuelEntryCheck {
        let performanceToken = LogFuelPerformance.begin("FuelEntryChecker")
        defer { LogFuelPerformance.end(performanceToken) }
        let fallback = ruleBasedCheck(input)
        guard useOnDeviceModel, let reason = fallback.reason else { return fallback }

        #if canImport(FoundationModels)
        if #available(iOS 26.0, *), SystemLanguageModel.default.isAvailable {
            do {
                let session = LanguageModelSession()
                let response = try await session.respond(
                    to: """
                    Rewrite this fuel-entry warning as one short, friendly sentence.
                    Do not add facts or advice. Return only that sentence:
                    \(reason)
                    """
                )
                if let line = oneLine(response.content) {
                    return FuelEntryCheck(reason: line)
                }
            } catch {
                // The deterministic warning is intentionally the silent fallback.
            }
        }
        #endif

        return fallback
    }

    static func ruleBasedCheck(_ input: Input) -> FuelEntryCheck {
        if let previous = input.previousOdometer, input.odometer <= previous {
            return FuelEntryCheck(reason: "The odometer is not higher than the last reading.")
        }

        if let previous = input.previousOdometer, input.odometer - previous > 2_500 {
            return FuelEntryCheck(reason: "The odometer jump looks unusually large.")
        }

        if let amount = positive(input.amount),
           let litres = positive(input.litres),
           let expectedRate = positive(input.expectedRate) {
            let enteredRate = amount / litres
            let difference = abs(enteredRate - expectedRate) / expectedRate
            if difference > 0.2 {
                return FuelEntryCheck(reason: "The litres do not fit the amount and fuel rate.")
            }
        }

        return FuelEntryCheck(reason: nil)
    }

    private static func positive(_ value: Double?) -> Double? {
        guard let value, value > 0 else { return nil }
        return value
    }

    private static func oneLine(_ text: String) -> String? {
        let line = text
            .split(whereSeparator: \.isNewline)
            .first?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let line, !line.isEmpty else { return nil }
        return String(line.prefix(160))
    }
}
