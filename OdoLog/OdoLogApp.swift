import AppIntents
import SwiftData
import SwiftUI

@main
struct OdoLogApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var store: OdoLogStore
    @State private var settings = AppSettings()
    @State private var fuelPrices = FuelPriceStore()
    @State private var weather = WeatherStore()
    @State private var incomingMessage: String?

    init() {
        let store = OdoLogStore()
        _store = State(initialValue: store)
        AppDependencyManager.shared.add(dependency: store)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .environment(settings)
                .environment(fuelPrices)
                .environment(weather)
                .preferredColorScheme(settings.appearance.colorScheme)
                .onOpenURL { url in
                    Task { await handleOpen(url) }
                }
                .alert("OdoLog", isPresented: Binding(
                    get: { incomingMessage != nil || store.statusMessage != nil },
                    set: { if !$0 { incomingMessage = nil; store.statusMessage = nil } }
                )) {
                    Button("OK", role: .cancel) {
                        incomingMessage = nil
                        store.statusMessage = nil
                    }
                } message: {
                    Text(incomingMessage ?? store.statusMessage ?? "")
                }
        }
        .modelContainer(for: [LocalVehicle.self, LocalRefuel.self, LocalMaintenance.self, LocalTrip.self])
    }

    private func handleOpen(_ url: URL) async {
        if url.scheme?.lowercased() == "odolog" {
            await store.handleAuthURL(url)
            return
        }
        let ext = url.pathExtension.lowercased()
        if url.isFileURL || ["csv", "json", "txt"].contains(ext) {
            do {
                let message = try await store.handleIncomingFile(
                    url: url,
                    replaceVehicleLogs: settings.replaceVehicleLogsOnImport
                )
                incomingMessage = message
            } catch {
                if !RefreshError.isCancellation(error) {
                    incomingMessage = error.localizedDescription
                }
            }
            return
        }
        await store.handleAuthURL(url)
    }
}
