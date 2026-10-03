import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @Environment(OdoLogStore.self) private var store
    @Environment(AppSettings.self) private var settings
    @Environment(FuelPriceStore.self) private var fuelPrices
    @State private var showAuth = false
    @State private var name = ""
    @State private var showExporter = false
    @State private var showCSVExporter = false
    @State private var showImporter = false
    @State private var transferMessage: String?
    @State private var photoItem: PhotosPickerItem?
    @State private var photoError: String?
#if DEBUG
    @State private var mileageComparisons: [OdoLogStore.DebugMileageComparison] = []
    @State private var showMileageComparison = false
#endif

    var body: some View {
        @Bindable var settings = settings
        Form {
            Section {
                if store.isSignedIn {
                    LabeledContent("Signed in as", value: store.email ?? "Account")
                    Button("Sign out", role: .destructive) {
                        Task { try? await store.signOut() }
                    }
                } else {
                    Button("Sign in") { showAuth = true }
                }
            } header: {
                Text("Account")
            } footer: {
                if !store.isSignedIn {
                    Text("Guest logs stay on this iPhone until you sign in — then they upload to your account automatically.")
                }
            }

            Section("Profile") {
                HStack(spacing: 12) {
                    UserAvatar(name: name.isEmpty ? store.displayName : name, size: 48, tint: settings.accentColor, photoStamp: settings.photoStamp)
                    VStack(alignment: .leading, spacing: 4) {
                        PhotosPicker(selection: $photoItem, matching: .images, photoLibrary: .shared()) {
                            Text(ProfilePhoto.image() == nil ? "Upload photo" : "Change photo")
                        }
                        if ProfilePhoto.image() != nil {
                            Button("Remove photo", role: .destructive) {
                                ProfilePhoto.remove()
                                settings.notePhotoChange()
                            }
                        }
                    }
                }
                .onChange(of: photoItem) { _, item in
                    Task { await loadPhoto(item) }
                }
                if let photoError {
                    Text(photoError).font(.footnote).foregroundStyle(.red)
                }
                TextField("Display name", text: $name)
                NavigationLink {
                    FuelPricesView()
                } label: {
                    LabeledContent("Fuel city", value: fuelPrices.city)
                }
                Button("Save name") {
                    Task {
                        try? await store.saveProfile(name: name, city: fuelPrices.city)
                    }
                }
            }

            Section {
                ForEach(DashboardWidget.allCases) { widget in
                    Toggle(widget.title, isOn: Binding(
                        get: { settings.shows(widget) },
                        set: { _ in settings.toggle(widget) }
                    ))
                }
            } header: {
                Text("Log cards")
            } footer: {
                Text("These cards appear on the Log tab. Keep at least one on.")
            }

            Section {
                Picker("Appearance", selection: $settings.appearance) {
                    ForEach(AppearanceChoice.allCases) { choice in
                        Text(choice.title).tag(choice)
                    }
                }
                NavigationLink {
                    AccentPickerView()
                } label: {
                    HStack {
                        Text("Accent colour")
                        Spacer()
                        Circle().fill(settings.accentColor).frame(width: 18, height: 18)
                        Text(settings.accentTitle).foregroundStyle(.secondary)
                    }
                }
                Toggle("Liquid Glass", isOn: $settings.liquidGlass)
            } header: {
                Text("Display")
            } footer: {
                Text(settings.appearance == .amoled
                     ? "AMOLED uses a true-black background so OLED pixels stay off. Liquid Glass is optional."
                     : "Optional iOS glass on cards. Off keeps the soft dashboard cards.")
            }

            Section {
                Picker("Default vehicle", selection: Binding(
                    get: { settings.defaultVehicleId },
                    set: { settings.defaultVehicleId = $0 }
                )) {
                    Text("Most recently added").tag(Optional<UUID>.none)
                    ForEach(store.fuelableVehicles) { vehicle in
                        Text(vehicle.displayName).tag(Optional(vehicle.id))
                    }
                }
                Toggle("Strict odometer checks", isOn: $settings.strictOdoChecks)
            } header: {
                Text("Logging")
            } footer: {
                Text(settings.strictOdoChecks
                     ? "Log fuel uses the last filled vehicle on tap. Strict odo blocks a reading lower than or equal to the last one and offers edit previous fill."
                     : "Log fuel uses the last filled vehicle on tap. Odo can go backwards so you can correct a bad reading.")
            }

            Section {
                Toggle("Service & reserve alerts", isOn: $settings.remindersEnabled)
                    .onChange(of: settings.remindersEnabled) { _, enabled in
                        Task {
                            if enabled {
                                let ok = await ReminderService.requestAuthorization()
                                if !ok {
                                    settings.remindersEnabled = false
                                    transferMessage = "Notifications are off for OdoLog. Enable them in iOS Settings."
                                    return
                                }
                            }
                            await ReminderService.reschedule(using: store, enabled: enabled)
                        }
                    }
            } header: {
                Text("Reminders")
            } footer: {
                Text("Get notified when service is due or a vehicle is still on reserve. Alerts use local notifications — no widgets.")
            }

            Section {
                if store.isSignedIn {
                    Button {
                        Task { @MainActor in
                            do {
                                transferMessage = try await store.pullFromCloud()
                                if !store.defaultCity.isEmpty {
                                    fuelPrices.city = store.defaultCity.capitalized
                                }
                                await fuelPrices.refresh()
                            } catch {
                                if !RefreshError.isCancellation(error) { transferMessage = error.localizedDescription }
                            }
                        }
                    } label: {
                        Label("Pull from cloud", systemImage: "icloud.and.arrow.down")
                    }
                    .disabled(store.isLoading)
                } else {
                    Button { showAuth = true } label: {
                        Label("Sign in to pull from cloud", systemImage: "icloud.and.arrow.down")
                    }
                }

                Button {
                    Task { @MainActor in
                        do {
                            transferMessage = try await store.importFromClipboard(
                                replaceVehicleLogs: settings.replaceVehicleLogsOnImport
                            )
                        } catch {
                            transferMessage = error.localizedDescription
                        }
                    }
                } label: {
                    Label("Paste CSV or backup", systemImage: "doc.on.clipboard")
                }

                Button { showExporter = true } label: {
                    Label("Export JSON backup", systemImage: "square.and.arrow.up")
                }
                Button { showCSVExporter = true } label: {
                    Label("Export CSV", systemImage: "tablecells")
                }
                Button { showImporter = true } label: {
                    Label("Import from Files", systemImage: "folder")
                }
                Toggle("Replace matching vehicle logs", isOn: $settings.replaceVehicleLogsOnImport)
            } header: {
                Text("Your data")
            } footer: {
                Text(settings.replaceVehicleLogsOnImport
                     ? "Paste/import/share deletes existing fills for vehicles named in the CSV, then adds the rows."
                     : "Prefer Share → Open in OdoLog, or Paste CSV. Pull from cloud syncs your signed-in account. Guest logs merge automatically when you sign in.")
            }

            Section {
                LabeledContent("Version", value: Self.appVersion)
                NavigationLink {
                    ChangelogView()
                } label: {
                    Label("What’s new", systemImage: "sparkles")
                }
                NavigationLink {
                    AdvancedSettingsView()
                } label: {
                    Label("Advanced", systemImage: "gearshape.2")
                }
            } header: {
                Text("About")
            } footer: {
                Text("Guest logs on this iPhone upload into your account the first time you sign in. Say “Log fuel in OdoLog” to Siri.")
            }

#if DEBUG
            Section("Debug") {
                Button("Compare mileage") {
                    mileageComparisons = store.debugMileageComparisons()
                    showMileageComparison = true
                }
            }
#endif
        }
        .scrollContentBackground(.hidden)
        .listSectionSpacing(10)
        .environment(\.defaultMinListRowHeight, 36)
        .fontDesign(.rounded)
        .navigationTitle("Settings")
        .onAppear { name = store.displayName ?? "" }
        .sheet(isPresented: $showAuth) {
            NavigationStack { AuthView() }
        }
#if DEBUG
        .sheet(isPresented: $showMileageComparison) {
            NavigationStack {
                DebugMileageComparisonView(comparisons: mileageComparisons)
            }
        }
#endif
        .fileExporter(isPresented: $showExporter, document: BackupDocument(data: store.backupData()), contentType: .json, defaultFilename: "OdoLog-backup") { result in
            switch result {
            case .success:
                transferMessage = "JSON backup saved."
            case .failure(let error):
                transferMessage = error.localizedDescription
            }
        }
        .fileExporter(
            isPresented: $showCSVExporter,
            document: CSVDocument(data: store.exportCSVData()),
            contentType: .commaSeparatedText,
            defaultFilename: "odolog-refuels-\(Format.ymd(.now))"
        ) { result in
            switch result {
            case .success:
                transferMessage = "CSV exported."
            case .failure(let error):
                transferMessage = error.localizedDescription
            }
        }
        .fileImporter(isPresented: $showImporter, allowedContentTypes: CSVRefuelImport.allowedContentTypes, allowsMultipleSelection: false) { result in
            Task { @MainActor in
                do {
                    let urls = try result.get()
                    guard let url = urls.first else { throw OdoLogError.emptyImport }
                    let data = try CSVRefuelImport.readFileData(from: url)
                    transferMessage = try await store.importFile(
                        data: data,
                        filename: url.lastPathComponent,
                        replaceVehicleLogs: settings.replaceVehicleLogsOnImport
                    )
                } catch {
                    transferMessage = error.localizedDescription
                }
            }
        }
        .alert("Data transfer", isPresented: Binding(get: { transferMessage != nil }, set: { if !$0 { transferMessage = nil } })) {
            Button("OK", role: .cancel) { transferMessage = nil }
        } message: { Text(transferMessage ?? "") }
        .onChange(of: store.statusMessage) { _, message in
            if let message { transferMessage = message; store.statusMessage = nil }
        }
    }

    private static var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—"
    }

    private func loadPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        photoError = nil
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                photoError = "Could not read that photo."
                return
            }
            try ProfilePhoto.save(data)
            settings.notePhotoChange()
        } catch {
            photoError = error.localizedDescription
        }
    }
}

#if DEBUG
private struct DebugMileageComparisonView: View {
    let comparisons: [OdoLogStore.DebugMileageComparison]

    var body: some View {
        List(comparisons) { comparison in
            Section(comparison.vehicleName) {
                LabeledContent("Old", value: comparison.oldKmpl.map(Format.kmpl) ?? "—")
                LabeledContent("New", value: comparison.newKmpl.map(Format.kmpl) ?? "—")
                LabeledContent(
                    "Difference",
                    value: comparison.difference.map { String(format: "%+.1f km/L", $0) } ?? "—"
                )
                if comparison.droppedSegments.isEmpty {
                    Text("No dropped segments")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(comparison.droppedSegments) { dropped in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(Format.shortDate(dropped.segment.date))
                                .font(.subheadline.weight(.semibold))
                            Text(dropped.reason.message)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("Mileage comparison")
        .navigationBarTitleDisplayMode(.inline)
    }
}
#endif

private struct AccentPickerView: View {
    @Environment(AppSettings.self) private var settings

    private let columns = [GridItem(.adaptive(minimum: 72), spacing: 12)]

    var body: some View {
        List {
            Section("Presets") {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(AccentChoice.presets) { accent in
                        Button {
                            settings.accent = accent
                        } label: {
                            VStack(spacing: 8) {
                                Circle()
                                    .fill(accent.color.gradient)
                                    .frame(width: 44, height: 44)
                                    .overlay {
                                        if settings.accent == accent {
                                            Image(systemName: "checkmark")
                                                .font(.caption.weight(.bold))
                                                .foregroundStyle(.white)
                                        }
                                    }
                                    .overlay { Circle().strokeBorder(.white.opacity(0.55), lineWidth: 2) }
                                Text(accent.title)
                                    .font(.caption2)
                                    .foregroundStyle(.primary)
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
                .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
            }

            Section {
                ColorPicker(
                    "Custom colour",
                    selection: Binding(
                        get: { Color(hex: settings.customAccentHex) ?? OdoPalette.terracotta },
                        set: { newValue in
                            settings.customAccentHex = newValue.hexRGB
                            settings.accent = .custom
                        }
                    ),
                    supportsOpacity: false
                )
            } footer: {
                Text("Pick any colour with the system picker, or choose a preset above.")
            }
        }
        .scrollContentBackground(.hidden)
        .navigationTitle("Accent colour")
    }
}
