import SwiftData
import SwiftUI

private enum AppTab: Hashable {
    case log, analytics, garage, settings
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
    @State private var vehiclePicker: [Vehicle]?
    @State private var logFuelLongPressed = false

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
                if logFuelLongPressed {
                    logFuelLongPressed = false
                    return
                }
                startLogFuel()
            }) {
                Image(systemName: "fuelpump.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Log fuel")
            .accessibilityHint("Opens the last filled vehicle. Long press to choose another.")
            .simultaneousGesture(
                LongPressGesture(minimumDuration: 0.45).onEnded { _ in
                    logFuelLongPressed = true
                    pickVehicleForFuel()
                }
            )
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
        .confirmationDialog(
            "Log fuel for which vehicle?",
            isPresented: Binding(
                get: { vehiclePicker != nil },
                set: { if !$0 { vehiclePicker = nil } }
            ),
            titleVisibility: .visible
        ) {
            ForEach(vehiclePicker ?? []) { vehicle in
                Button(vehicle.displayName) {
                    selectedTab = .log
                    logFuelVehicle = vehicle
                    vehiclePicker = nil
                }
            }
            Button("Cancel", role: .cancel) { vehiclePicker = nil }
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

    private func pickVehicleForFuel() {
        selectedTab = .log
        let fuelable = store.fuelableVehicles
        if fuelable.isEmpty {
            showAddVehicle = true
            return
        }
        vehiclePicker = fuelable
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
