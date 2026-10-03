import Foundation
import Network
import Observation

@Observable
@MainActor
final class NetworkMonitor {
    static let shared = NetworkMonitor()

    private(set) var isOnline = false
    var onSatisfied: (() -> Void)?

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "odolog.network")

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor [weak self] in
                guard let self else { return }
                let becameOnline = online && !self.isOnline
                self.isOnline = online
                if becameOnline {
                    self.onSatisfied?()
                }
            }
        }
        monitor.start(queue: queue)
    }
}
