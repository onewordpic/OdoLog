import SwiftUI

struct DashboardView: View {
    @Environment(OdoLogStore.self) private var store
    @Environment(FuelPriceStore.self) private var fuelPrices
    @Environment(WeatherStore.self) private var weather
    @Environment(AppSettings.self) private var settings
    @State private var spendRange: OdoLogStore.SpendRange = .month
    @State private var showAddVehicle = false
    @State private var logFuelVehicle: Vehicle?
    @State private var showAuth = false
    @State private var activityQuery = ""
    @State private var openVehicle: Vehicle?
    @State private var editingItem: RefuelWithVehicle?
    @State private var reserveVehicle: Vehicle?
    @State private var reserveOdoText = ""
    @State private var reserveOdoError: String?
    @State private var isRefreshing = false

    var body: some View {
        LogFuelPerformance.measure("DashboardBody") {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                if !store.isSignedIn, !settings.hideSyncGaragePrompt {
                    DashCard {
                        HStack(spacing: 12) {
                            Button { showAuth = true } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: "person.crop.circle.badge.plus")
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Sync this garage")
                                            .font(.subheadline.weight(.semibold))
                                        Text("Sign in — guest logs upload automatically")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer(minLength: 0)
                                }
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityHint("Opens Google or email sign-in")

                            Button {
                                settings.hideSyncGaragePrompt = true
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                    .frame(width: 28, height: 28)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Dismiss sync prompt")
                        }
                    }
                }

                if let insight = store.activeReserveInsight() {
                    let estimate = insight.estimate
                    let title: String = {
                        switch estimate.status {
                        case .critical: return "Reserve nearly empty"
                        case .refuelSoon: return "Refuel soon"
                        case .ok: return "On reserve"
                        }
                    }()
                    let message: String = {
                        var parts = ["\(insight.vehicle.displayName)"]
                        if let kmLeft = estimate.kmLeft {
                            parts.append("~\(Format.km(kmLeft)) left")
                        }
                        if let suggested = estimate.suggestedRefuelOdo {
                            parts.append("refuel by \(Format.km(suggested))")
                        }
                        return parts.joined(separator: " · ")
                    }()
                    Button {
                        store.clearReserve(
                            for: insight.vehicle.id,
                            at: store.lastOdo(for: insight.vehicle.id),
                            note: "Switched to main tank from Home"
                        )
                        Task {
                            await ReminderService.reschedule(using: store, enabled: settings.remindersEnabled)
                        }
                    } label: {
                        InsightBanner(
                            title: title,
                            message: message,
                            systemImage: "exclamationmark.fuelpump.fill",
                            tint: settings.accentColor,
                            tone: .caution
                        )
                    }
                    .buttonStyle(.plain)
                }

                if settings.shows(.spend) {
                    HStack(spacing: 12) {
                        StatTile(
                            title: "Spent",
                            value: Format.rupees(store.spend(in: spendRange)),
                            caption: spendRange == .month ? "This month" : "All time",
                            tint: settings.accentColor
                        )
                        if spendRange == .month, let cpk = store.costPerKm(inCalendarMonthOf: .now) {
                            StatTile(
                                title: "Cost / km",
                                value: Format.rupeesPerKm(cpk),
                                caption: "This month",
                                tint: settings.accentTertiary
                            )
                        } else {
                            let fuelStats = store.fuelStats(in: spendRange)
                            StatTile(
                                title: "Fuel",
                                value: Format.litres(fuelStats.litres),
                                caption: "\(fuelStats.count) fills",
                                tint: settings.accentTertiary
                            )
                        }
                    }

                    if spendRange == .month, let insight = store.monthlySpendInsight() {
                        InsightBanner(
                            title: insight.costPerKm.map { Format.rupeesPerKm($0) } ?? "This month",
                            message: insight.line,
                            systemImage: "chart.line.uptrend.xyaxis",
                            tint: settings.accentColor,
                            tone: .info
                        )
                    }
                }

                if settings.shows(.efficiency) || settings.shows(.cityRates) {
                    HStack(alignment: .top, spacing: 12) {
                        if settings.shows(.efficiency) {
                            DashCard {
                                VStack(alignment: .leading, spacing: 12) {
                                    Text("Efficiency")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                    RingProgress(
                                        progress: efficiencyProgress,
                                        value: primaryKmpl.map { String(format: "%.1f", $0) } ?? "—",
                                        caption: "km/L",
                                        tint: settings.accentColor
                                    )
                                    .frame(height: 118)
                                    Text(efficiencyCaption)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        if settings.shows(.cityRates) {
                            NavigationLink {
                                FuelPricesView()
                            } label: {
                                DashCard {
                                    VStack(alignment: .leading, spacing: 12) {
                                        Text("City rates")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(.secondary)
                                        Text(fuelPrices.city)
                                            .font(.headline)
                                        if fuelPrices.isLoading {
                                            ProgressView()
                                        } else if let petrol = fuelPrices.prices?.petrol {
                                            Text(String(format: "₹%.2f", petrol))
                                                .font(.title2.weight(.bold))
                                            Text("Petrol / L")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        } else {
                                            Text("Choose city")
                                                .foregroundStyle(.secondary)
                                        }
                                        Spacer(minLength: 0)
                                        Label("Prices", systemImage: "chevron.right")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(settings.accentColor)
                                    }
                                    .frame(minHeight: 150, alignment: .topLeading)
                                }
                            }
                            .buttonStyle(.plain)
                            .accessibilityHint("Opens city fuel prices")
                        }
                    }
                }

                if settings.shows(.vehicle) {
                    if let hero = store.featured ?? store.vehicles.first {
                        VehicleHeroCard(
                            vehicle: hero,
                            spend: Format.rupees(store.spend(for: hero.id)),
                            onLogFuel: hero.fuelType.isFuelable ? {
                                LogFuelPerformance.tapFired()
                                logFuelVehicle = hero
                            } : nil,
                            onOpen: { openVehicle = hero },
                            isOnReserve: store.reserveOdo(for: hero.id) != nil,
                            onToggleReserve: hero.icon.supportsReserveTap && hero.hasReserve ? {
                                toggleReserve(for: hero)
                            } : nil
                        )
                    } else {
                        DashCard {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("Your garage is empty")
                                    .font(.headline)
                                Text("Add a vehicle, then log fuel from the bar below.")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                OdoPrimaryButton(title: "Add vehicle", systemImage: "plus") {
                                    showAddVehicle = true
                                }
                            }
                        }
                    }
                }

                if settings.shows(.activity) {
                    DashCard(padding: 16) {
                        VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Text("Activity")
                                .font(.headline)
                            Spacer()
                            Text(subtitle)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        HStack {
                            Image(systemName: "magnifyingglass")
                                .foregroundStyle(.secondary)
                            TextField("Search fills…", text: $activityQuery)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 11)
                        .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 14, style: .continuous))

                        ActivityDots(days: fillDays, tint: settings.accentColor)

                        if filteredActivity.isEmpty {
                            Text(activityQuery.isEmpty ? "No refuels yet." : "No fills match “\(activityQuery)”.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .padding(.vertical, 8)
                        } else {
                            ForEach(filteredActivity) { item in
                                Button {
                                    editingItem = item
                                } label: {
                                    HStack(spacing: 12) {
                                        Image(systemName: item.vehicleIcon.systemImage)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(OdoPalette.ink)
                                            .frame(width: 40, height: 40)
                                            .background(OdoPalette.accent(for: item.vehicleId), in: Circle())
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(item.vehicleName)
                                                .font(.subheadline.weight(.semibold))
                                            HStack(spacing: 6) {
                                                Text(Format.dateLabel(item.refuel.refuelDate))
                                                    .font(.caption)
                                                    .foregroundStyle(.secondary)
                                                if item.refuel.fullTank {
                                                    Text("Full")
                                                        .font(.caption2.weight(.bold))
                                                        .foregroundStyle(settings.accentColor)
                                                        .padding(.horizontal, 6)
                                                        .padding(.vertical, 2)
                                                        .background(settings.accentColor.opacity(0.12), in: Capsule())
                                                }
                                            }
                                        }
                                        Spacer()
                                        VStack(alignment: .trailing, spacing: 2) {
                                            Text(Format.rupees(item.refuel.amountInr))
                                                .font(.subheadline.weight(.bold))
                                            if let odo = item.refuel.odoKm {
                                                Text(Format.km(odo))
                                                    .font(.caption2)
                                                    .foregroundStyle(.secondary)
                                            }
                                        }
                                    }
                                    .padding(.vertical, 2)
                                }
                                .buttonStyle(.plain)
                                .accessibilityHint("Edit this fill")
                                .accessibilityElement(children: .combine)
                            }
                        }
                    }
                    }
                }
            }
            .padding(16)
            .padding(.bottom, 8)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                HStack(spacing: 8) {
                    OdoChip(title: "This month", selected: spendRange == .month) { spendRange = .month }
                    OdoChip(title: "All time", selected: spendRange == .all) { spendRange = .all }
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { showAddVehicle = true } label: {
                    Image(systemName: "plus")
                        .font(.body.weight(.semibold))
                        .frame(width: 32, height: 32)
                        .background(Color.primary.opacity(0.06), in: Circle())
                }
                .accessibilityLabel("Add vehicle")
            }
        }
        .refreshable {
            let refreshTask = Task { @MainActor in
                await refreshDashboard()
            }
            await refreshTask.value
        }
        .alert("Message", isPresented: Binding(
            get: { refreshErrorMessage != nil },
            set: {
                if !$0 {
                    store.errorMessage = nil
                    fuelPrices.errorMessage = nil
                    weather.errorMessage = nil
                }
            }
        )) {
            Button("OK", role: .cancel) {
                store.errorMessage = nil
                fuelPrices.errorMessage = nil
                weather.errorMessage = nil
            }
        } message: {
            Text(refreshErrorMessage ?? "")
        }
        .sheet(isPresented: $showAddVehicle) {
            NavigationStack { AddVehicleSheet() }
        }
        .sheet(item: $logFuelVehicle) { vehicle in
            NavigationStack { LogFuelSheet(vehicle: vehicle) }
        }
        .sheet(item: $editingItem) { item in
            if let vehicle = store.vehicle(id: item.vehicleId) {
                NavigationStack { LogFuelSheet(vehicle: vehicle, existing: item.refuel) }
            }
        }
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
                        Text(reserveOdoError)
                            .foregroundStyle(.red)
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
        .sheet(isPresented: $showAuth) {
            NavigationStack { AuthView() }
        }
        .navigationDestination(item: $openVehicle) { vehicle in
            VehicleDetailView(vehicle: vehicle)
        }
        }
    }

    @MainActor
    private func refreshDashboard() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }

        async let logs: Void = store.refresh(reportError: true)
        async let prices: Void = fuelPrices.refresh()
        async let forecast: Void = weather.refresh(for: fuelPrices.city)
        _ = await (logs, prices, forecast)
        store.recomputeMileageAndReserveState()
    }

    private var refreshErrorMessage: String? {
        store.errorMessage ?? fuelPrices.errorMessage ?? weather.errorMessage
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text(Date.now.formatted(.dateTime.weekday(.wide).day().month(.wide)))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    if let weather = weather.snapshot {
                        HStack(spacing: 4) {
                            Image(systemName: weather.symbolName)
                            Text("\(weather.temperatureC)°C")
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(settings.accentColor)
                        .accessibilityLabel("\(weather.temperatureC) degrees, weather")
                    }
                }
                Text(Format.greeting(name: store.displayName))
                    .font(.title2.weight(.bold))
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
            }
            Spacer(minLength: 8)
            UserAvatar(name: store.displayName, size: 44, tint: settings.accentColor, photoStamp: settings.photoStamp)
        }
    }

    private var subtitle: String {
        if store.vehicles.isEmpty { return "Add your first vehicle" }
        let n = store.vehicles.count
        let r = store.stats.count
        return "\(n) vehicle\(n == 1 ? "" : "s") · \(r) fill\(r == 1 ? "" : "s")"
    }

    private var filteredActivity: [RefuelWithVehicle] {
        let q = activityQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        let byId = Dictionary(uniqueKeysWithValues: store.vehicles.map { ($0.id, $0) })
        let items: [RefuelWithVehicle] = store.allRefuels.prefix(200).map { refuel in
            let vehicle = byId[refuel.vehicleId]
            return RefuelWithVehicle(
                refuel: refuel,
                vehicleName: vehicle?.displayName ?? "Unknown",
                vehicleIcon: vehicle?.icon ?? .car,
                vehicleId: refuel.vehicleId
            )
        }
        guard !q.isEmpty else { return Array(items.prefix(20)) }
        return items.filter { item in
            let r = item.refuel
            return item.vehicleName.localizedCaseInsensitiveContains(q)
                || Format.rupees(r.amountInr).localizedCaseInsensitiveContains(q)
                || Format.dateLabel(r.refuelDate).localizedCaseInsensitiveContains(q)
                || Format.shortDate(r.refuelDate).localizedCaseInsensitiveContains(q)
                || Format.litres(r.litres).localizedCaseInsensitiveContains(q)
                || (r.notes?.localizedCaseInsensitiveContains(q) ?? false)
                || (r.odoKm.map { Format.km($0).localizedCaseInsensitiveContains(q) } ?? false)
                || (r.fullTank && "full".localizedCaseInsensitiveContains(q))
        }
    }

    private var primaryVehicle: Vehicle? { store.lastLoggedVehicle }

    private var primaryKmpl: Double? {
        primaryVehicle.flatMap { store.homeEfficiencyKmpl(for: $0.id) }
    }

    private var efficiencyProgress: Double {
        guard let vehicle = primaryVehicle, let kmpl = store.homeEfficiencyKmpl(for: vehicle.id) else { return 0 }
        let claimed = vehicle.resolvedClaimedKmpl ?? vehicle.fuelType.fallbackKmpl
        guard claimed > 0 else { return 0 }
        return min(1, kmpl / claimed)
    }

    private var efficiencyCaption: String {
        if primaryKmpl == nil { return "Not enough data" }
        guard let vehicle = primaryVehicle,
              let claimed = vehicle.resolvedClaimedKmpl else { return "Versus typical claim" }
        return "Versus typical claim \(Format.kmpl(claimed))"
    }

    private func toggleReserve(for vehicle: Vehicle) {
        if store.reserveOdo(for: vehicle.id) != nil {
            store.clearReserve(for: vehicle.id, at: store.lastOdo(for: vehicle.id), note: "Switched to main tank from Home")
            rescheduleReminders()
        } else {
            let last = store.lastOdo(for: vehicle.id)
            reserveOdoText = last.map { String(format: "%.0f", $0) } ?? ""
            reserveOdoError = nil
            reserveVehicle = vehicle
        }
    }

    private func saveReserveStart(for vehicle: Vehicle) {
        let cleaned = reserveOdoText.replacingOccurrences(of: ",", with: "")
        guard let odo = Double(cleaned) else {
            reserveOdoError = "Enter a valid odometer reading."
            return
        }
        do {
            try store.validateReserveOdometer(odo, for: vehicle.id)
        } catch {
            reserveOdoError = error.localizedDescription
            return
        }
        store.markReserve(for: vehicle.id, at: odo, note: "Switched to reserve from Home")
        reserveVehicle = nil
        rescheduleReminders()
    }

    private func rescheduleReminders() {
        Task {
            await ReminderService.reschedule(using: store, enabled: settings.remindersEnabled)
        }
    }

    private var fillDays: [Bool] {
        let cal = Calendar.current
        let dates = Set(store.allRefuels.compactMap { ymd -> Date? in
            Self.dayParser.date(from: ymd.refuelDate)
        }.map { cal.startOfDay(for: $0) })
        return (0..<13).reversed().map { offset in
            let day = cal.date(byAdding: .day, value: -offset, to: cal.startOfDay(for: .now)) ?? .now
            return dates.contains(day)
        }
    }

    private static let dayParser: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
}
