import SwiftData
import SwiftUI

private enum AppTab: Hashable {
    case log, analytics, garage, settings
}

private struct LogFuelButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.7 : 1)
            .onChange(of: configuration.isPressed) { _, isPressed in
                if isPressed {
                    LogFuelPerformance.touchDown()
                }
            }
    }
}

struct RootView: View {
    @Environment(OdoLogStore.self) private var store
    @Environment(FuelPriceStore.self) private var fuelPrices
    @Environment(WeatherStore.self) private var weather
    @Environment(AppSettings.self) private var settings
    @Environment(\.modelContext) private var modelContext
    @Environment(\.scenePhase) private var scenePhase

    @State private var selectedTab: AppTab = .log
    @State private var showAddVehicle = false
    @State private var logFuelVehicle: Vehicle?
    @State private var reserveVehicle: Vehicle?
    @State private var reserveOdoText = ""
    @State private var reserveOdoError: String?

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab("Log", systemImage: "house.fill", value: AppTab.log) {
                NavigationStack { DashboardView() }
            }
            Tab("Analytics", systemImage: "chart.line.uptrend.xyaxis", value: AppTab.analytics) {
                NavigationStack { AnalyticsView() }
            }
            Tab("Garage", systemImage: "car.fill", value: AppTab.garage) {
                GarageView()
            }
            Tab("Settings", systemImage: "gearshape", value: AppTab.settings) {
                NavigationStack { SettingsView() }
            }
        }
        .tint(settings.accentColor)
        .fontDesign(.rounded)
        .tabBarMinimizeBehavior(.onScrollDown)
        .applyAmoledTabBar(settings.usesAmoled)
        .toolbarBackground(.visible, for: .tabBar)
        .tabViewBottomAccessory {
            Button(action: {
                LogFuelPerformance.tapFired()
                startLogFuel()
            }) {
                Image(systemName: "fuelpump.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(LogFuelButtonStyle())
            .accessibilityLabel("Log fuel")
            .accessibilityHint("Opens the last filled vehicle. Long press to choose another.")
            .contextMenu {
                if store.fuelableVehicles.isEmpty {
                    Button("Add vehicle", systemImage: "plus") {
                        selectedTab = .log
                        showAddVehicle = true
                    }
                } else {
                    ForEach(store.fuelableVehicles) { vehicle in
                        Button("Log fuel for \(vehicle.displayName)", systemImage: "fuelpump.fill") {
                            selectedTab = .log
                            logFuelVehicle = vehicle
                        }
                        if vehicle.icon.supportsReserveTap && vehicle.hasReserve {
                            if store.reserveOdo(for: vehicle.id) != nil {
                                Button("Clear reserve for \(vehicle.displayName)", systemImage: "fuelpump") {
                                    store.clearReserveWithoutRefuel(
                                        for: vehicle.id,
                                        at: store.lastOdo(for: vehicle.id)
                                    )
                                }
                            } else {
                                Button("Set reserve for \(vehicle.displayName)", systemImage: "exclamationmark.fuelpump.fill") {
                                    beginReservePrompt(for: vehicle)
                                }
                            }
                        }
                    }
                }
            }
        }
        .background { DashBackdrop() }
        .onAppear {
            store.attach(modelContext: modelContext)
            refreshQuickActions()
            openPendingQuickActionIfNeeded()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                refreshQuickActions()
                openPendingQuickActionIfNeeded()
                // Defer reminders off the first frames so Garage stays responsive.
                Task(priority: .utility) {
                    await ReminderService.reschedule(using: store, enabled: settings.remindersEnabled)
                }
                Task { await store.refresh(reportError: false) }
            }
        }
        .onChange(of: store.vehicles.count) { _, _ in
            refreshQuickActions()
        }
        .onChange(of: fuelPrices.city) { _, city in
            Task { await weather.refresh(for: city) }
        }
        .task {
            await store.refresh()
            if !store.defaultCity.isEmpty {
                let city = store.defaultCity.capitalized
                if fuelPrices.city.lowercased() == "delhi", store.defaultCity.lowercased() != "delhi" {
                    fuelPrices.city = city
                }
            }
            await fuelPrices.refresh()
            await weather.refresh(for: fuelPrices.city)
            refreshQuickActions()
            openPendingQuickActionIfNeeded()
            Task(priority: .utility) {
                await ReminderService.reschedule(using: store, enabled: settings.remindersEnabled)
            }
        }
        .sheet(isPresented: $showAddVehicle) { NavigationStack { AddVehicleSheet() } }
        .sheet(item: $logFuelVehicle) { vehicle in NavigationStack { LogFuelSheet(vehicle: vehicle) } }
        .sheet(item: $reserveVehicle) { vehicle in
            NavigationStack {
                Form {
                    Section {
                        TextField("Odometer", text: $reserveOdoText)
                            .keyboardType(.decimalPad)
                    } footer: {
                        if let last = store.lastOdo(for: vehicle.id) {
                            Text("Last logged reading: \(Format.km(last))")
                        }
                    }
                    if let reserveOdoError {
                        Text(reserveOdoError).foregroundStyle(.red)
                    }
                }
                .navigationTitle("Start reserve")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { reserveVehicle = nil }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") { saveReserveStart(for: vehicle) }
                            .fontWeight(.semibold)
                    }
                }
            }
            .presentationDetents([.medium])
        }
    }

    private func startLogFuel() {
        selectedTab = .log
        if store.fuelableVehicles.isEmpty {
            showAddVehicle = true
        } else if let preferred = store.preferredLogVehicle {
            logFuelVehicle = preferred
        } else {
            showAddVehicle = true
        }
    }

    private func beginReservePrompt(for vehicle: Vehicle) {
        reserveOdoError = nil
        reserveOdoText = store.lastOdo(for: vehicle.id).map { String(format: "%.0f", $0) } ?? ""
        reserveVehicle = vehicle
    }

    private func saveReserveStart(for vehicle: Vehicle) {
        let cleaned = reserveOdoText.replacingOccurrences(of: ",", with: "")
        guard let odo = Double(cleaned), odo > 0 else {
            reserveOdoError = OdoLogError.odoRequired.localizedDescription
            return
        }
        do {
            try store.validateReserveOdometer(odo, for: vehicle.id)
            store.markReserve(for: vehicle.id, at: odo, note: "Switched to reserve from Log fuel menu")
            reserveVehicle = nil
        } catch {
            reserveOdoError = error.localizedDescription
        }
    }

    private func openPendingQuickActionIfNeeded() {
        guard QuickActionsRouter.shared.consumeLogFuel() else { return }
        startLogFuel()
    }

    private func refreshQuickActions() {
        // Home Screen long-press quick action only — no WidgetKit extension.
        let subtitle = store.preferredLogVehicle?.displayName
        QuickActionsRouter.shared.refreshShortcutItems(subtitle: subtitle)
    }
}
