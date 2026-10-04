import Foundation
import os

enum LogFuelPerformance {
    struct Token: Sendable {
        let name: StaticString
        let id: OSSignpostID
        let startedAt: TimeInterval
    }

    nonisolated private static let log = OSLog(subsystem: "com.safwan.OdoLog", category: "LogFuel")
    @MainActor private static var touchToken: Token?
    @MainActor private static var tapToken: Token?

    nonisolated static func begin(_ name: StaticString) -> Token {
        let id = OSSignpostID(log: log)
        os_signpost(.begin, log: log, name: name, signpostID: id)
        return Token(name: name, id: id, startedAt: ProcessInfo.processInfo.systemUptime)
    }

    nonisolated static func end(_ token: Token) {
        let elapsedMs = (ProcessInfo.processInfo.systemUptime - token.startedAt) * 1_000
        os_signpost(.end, log: log, name: token.name, signpostID: token.id, "%{public}.3f ms", elapsedMs)
        os_log(.info, log: log, "ODOLOG_PERF %{public}@ %{public}.3f ms", String(describing: token.name), elapsedMs)
        #if DEBUG
        print("ODOLOG_PERF \(token.name): \(String(format: "%.3f", elapsedMs)) ms")
        #endif
    }

    nonisolated static func measure<T>(_ name: StaticString, _ work: () throws -> T) rethrows -> T {
        let token = begin(name)
        defer { end(token) }
        return try work()
    }

    @MainActor
    static func touchDown() {
        guard touchToken == nil else { return }
        touchToken = begin("TouchDownToTapFired")
    }

    @MainActor
    static func tapFired() {
        if let touchToken {
            end(touchToken)
            self.touchToken = nil
        }
        if let tapToken {
            end(tapToken)
        }
        tapToken = begin("TapFiredToSheetFirstFrame")
    }

    @MainActor
    static func sheetDidAppear() {
        guard let tapToken else { return }
        end(tapToken)
        self.tapToken = nil
    }
}
