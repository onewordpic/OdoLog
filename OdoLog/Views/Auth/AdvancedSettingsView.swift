import SwiftUI

struct AdvancedSettingsView: View {
    @Environment(OdoLogStore.self) private var store
    @Environment(AppSettings.self) private var settings
    @State private var options = DataResetOptions()
    @State private var showConfirm = false
    @State private var confirmText = ""
    @State private var isResetting = false
    @State private var resultMessage: String?

    var body: some View {
        Form {
            Section("Diagnostics") {
                LabeledContent("Version", value: Self.appVersion)
                LabeledContent("Account", value: store.isSignedIn ? (store.email ?? "Signed in") : "Guest")
                LabeledContent("Vehicles", value: "\(store.vehicles.count)")
                LabeledContent("Fills", value: "\(store.allRefuels.count)")
                LabeledContent("Maintenance", value: "\(store.allMaintenance.count)")
                LabeledContent("Trips", value: "\(store.allTrips.count)")
            }

            Section("Reminders") {
                Button("Rebuild reminders") {
                    Task {
                        await ReminderService.reschedule(using: store, enabled: settings.remindersEnabled)
                        resultMessage = settings.remindersEnabled
                            ? "Reminders rebuilt."
                            : "Reminders are off — nothing scheduled."
                    }
                }
                Text("Cancels pending OdoLog alerts and schedules them again from current vehicles.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section {
                Text("Export a JSON backup or CSV from Settings → Your data before resetting. This cannot be undone.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Reset data") {
                Toggle("Fuel fills", isOn: $options.fuelFills)
                    .disabled(options.vehicles)
                Toggle("Maintenance", isOn: $options.maintenance)
                    .disabled(options.vehicles)
                Toggle("Trips & tolls", isOn: $options.trips)
                    .disabled(options.vehicles)
                Toggle("Reserve history", isOn: $options.reserveHistory)
                    .disabled(options.vehicles)
                Toggle("Vehicles", isOn: $options.vehicles)
                    .onChange(of: options.vehicles) { _, on in
                        if on {
                            options.fuelFills = true
                            options.maintenance = true
                            options.trips = true
                            options.reserveHistory = true
                        }
                    }
                Toggle("App settings", isOn: $options.appSettings)
                Toggle("Profile photo", isOn: $options.profilePhoto)

                Text(store.isSignedIn
                     ? "Selected logs are deleted from your OdoLog account on every device, not only this iPhone. Your sign-in stays."
                     : "Selected logs are deleted from this iPhone only.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                Button("Reset selected data", role: .destructive) {
                    confirmText = ""
                    showConfirm = true
                }
                .disabled(!options.hasSelection || store.isLoading || isResetting)
            }
        }
        .scrollContentBackground(.hidden)
        .fontDesign(.rounded)
        .navigationTitle("Advanced")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showConfirm) {
            NavigationStack {
                confirmSheet
            }
            .presentationDetents([.medium])
        }
        .alert("Reset", isPresented: Binding(get: { resultMessage != nil }, set: { if !$0 { resultMessage = nil } })) {
            Button("OK", role: .cancel) { resultMessage = nil }
        } message: {
            Text(resultMessage ?? "")
        }
    }

    private var confirmSheet: some View {
        Form {
            Section {
                Text("This will delete \(options.summaryLabels.joined(separator: ", ")). Type DELETE to confirm.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                TextField("DELETE", text: $confirmText)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
            }
            Section {
                Button("Delete now", role: .destructive) {
                    Task { await runReset() }
                }
                .disabled(!canConfirm || isResetting)
            }
        }
        .navigationTitle("Confirm reset")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { showConfirm = false }
            }
        }
        .disabled(isResetting)
    }

    private var canConfirm: Bool {
        confirmText.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() == "DELETE"
    }

    private static var appVersion: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "—"
        let build = info?["CFBundleVersion"] as? String
        if let build, build != short { return "\(short) (\(build))" }
        return short
    }

    @MainActor
    private func runReset() async {
        guard canConfirm else { return }
        isResetting = true
        defer { isResetting = false }
        do {
            let message = try await store.resetData(options, settings: settings)
            await ReminderService.reschedule(using: store, enabled: settings.remindersEnabled)
            showConfirm = false
            options = DataResetOptions()
            resultMessage = message
        } catch {
            resultMessage = error.localizedDescription
        }
    }
}
