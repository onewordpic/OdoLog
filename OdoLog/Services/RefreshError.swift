import Foundation

enum RefreshError {
    nonisolated static func isCancellation(_ error: any Error) -> Bool {
        if error is CancellationError { return true }
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain && nsError.code == URLError.cancelled.rawValue {
            return true
        }
        if let underlying = nsError.userInfo[NSUnderlyingErrorKey] as? any Error {
            return isCancellation(underlying)
        }
        return false
    }
}
