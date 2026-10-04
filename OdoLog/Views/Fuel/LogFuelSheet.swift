import SwiftUI

enum LogFuelTankDefaults {
    static func state(isOnReserve: Bool) -> TankState {
        isOnReserve ? .reserve : .main
    }

    static func stateAfterVehicleChange(
        current: TankState,
        wasManuallyChanged: Bool,
        isOnReserve: Bool
    ) -> TankState {
        wasManuallyChanged ? current : state(isOnReserve: isOnReserve)
    }
}

struct LogFuelSheet: View {
    @Environment(OdoLogStore.self) private var store
    @Environment(FuelPriceStore.self) private var fuelPrices
    @Environment(AppSettings.self) private var settings
    @Environment(\.dismiss) private var dismiss
    let vehicle: Vehicle
    var existing: Refuel? = nil

    @State private var date = Date()
    @State private var amountText = ""
    @State private var rateText = ""
    @State private var litresText = ""
    @State private var odoText = ""
    @State private var notes = ""
    @State private var fullTank = false
    @State private var brand: FuelBrand = .iocl
    @State private var subtype: FuelSubtype = .normal
    @State private var tankState: TankState = .main
    @State private var selectedVehicleId: UUID
    @State private var tankStateWasManuallyChanged = false
    @State private var reservePromptVehicle: Vehicle?
    @State private var reserveOdoText = ""
    @State private var reserveOdoError: String?
    @State private var isSaving = false
    @State private var errorText: String?
    @State private var blockedByOdo = false
    @State private var confirmDelete = false
    @State private var confirmSanity = false
    @State private var pendingSanityIssues: [OdoSanity.Issue] = []
    @State private var pendingEntryCheckReason: String?
    @State private var editPreviousFill: Refuel?

    private enum Field { case amount, rate, litres }

    private var isEditing: Bool { existing != nil }
    init(vehicle: Vehicle, existing: Refuel? = nil) {
        self.vehicle = vehicle
        self.existing = existing
        _selectedVehicleId = State(initialValue: vehicle.id)
    }

    private var selectedVehicle: Vehicle { store.vehicle(id: selectedVehicleId) ?? vehicle }
    private var usesReserveTap: Bool { selectedVehicle.icon.supportsReserveTap && selectedVehicle.hasReserve }
    private var lastOdo: Double? { store.lastOdo(for: selectedVehicle.id, excluding: existing?.id) }
    private var previousFill: Refuel? { store.previousOdoFill(for: selectedVehicle.id, excluding: existing?.id) }

    private var liveSanityIssues: [OdoSanity.Issue] {
        guard let odo = parse(odoText) else { return [] }
        return OdoSanity.check(
            vehicle: selectedVehicle,
            odoKm: odo,
            litres: parse(litresText),
            date: date,
            previousOdo: previousFill?.odoKm ?? lastOdo,
            previousDateYMD: previousFill?.refuelDate
        )
    }

    var body: some View {
        LogFuelPerformance.measure("LogFuelSheetBody") {
        Form {
            Section {
                HStack(spacing: 12) {
                    VehicleAvatar(vehicle: selectedVehicle, size: 44)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(selectedVehicle.displayName)
                            .font(.headline)
                        Text(vehicleSubtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Vehicle \(selectedVehicle.displayName)")
                if !isEditing, store.fuelableVehicles.count > 1 {
                    Picker("Vehicle", selection: $selectedVehicleId) {
                        ForEach(store.fuelableVehicles) { candidate in
                            Text(candidate.displayName).tag(candidate.id)
                        }
                    }
                }
            }

            Section {
                DatePicker("Date", selection: $date, displayedComponents: .date)
                labeledField("Amount", suffix: "₹", text: amountBinding, accessibility: "Amount in rupees")
                labeledField("Rate", suffix: "₹/L", text: rateBinding, accessibility: "Rate per litre")
                labeledField("Litres", suffix: "L", text: litresBinding, accessibility: "Litres")
                labeledField("Odometer", suffix: "km", text: $odoText, accessibility: "Odometer in kilometres", required: true)
                if usesReserveTap {
                    Toggle(isOn: $fullTank) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Filled the tank")
                            Text("Recorded with this fill. Not used for km/L.")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .tint(settings.accentColor)
                }
            } footer: {
                if let lastOdo {
                    Text(isEditing
                         ? "Odo is required. Other fills go up to \(Format.km(lastOdo))."
                         : "Odo is required. Last reading \(Format.km(lastOdo)).")
                } else {
                    Text(usesReserveTap
                         ? "Odo is required. Mileage uses the distance and fuel between reserve points."
                         : "Odo is required. Mileage uses recent full-fill intervals.")
                }
            }

            if let first = liveSanityIssues.first {
                Section {
                    InsightBanner(
                        title: first.title,
                        message: liveSanityIssues.count > 1
                            ? "\(first.message) Also: \(liveSanityIssues.dropFirst().map(\.title).joined(separator: ", ").lowercased())."
                            : first.message,
                        systemImage: "exclamationmark.triangle.fill",
                        tint: settings.accentColor,
                        tone: .caution
                    )
                    .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
                    .listRowBackground(Color.clear)
                }
            }

            if selectedVehicle.fuelType.isFuelable, let cityRate = fuelPrices.price(for: selectedVehicle.fuelType) {
                Section {
                    Button {
                        fill(rate: cityRate)
                        recompute(from: .rate)
                    } label: {
                        Label(
                            "Use \(fuelPrices.city.localizedCapitalized) \(selectedVehicle.fuelType.title.lowercased()) rate (₹\(String(format: "%.2f", cityRate))/L)",
                            systemImage: "indianrupeesign.circle"
                        )
                    }
                    .accessibilityHint("Fills the rate field with today’s published city price")
                }
            }

            Section("Fuel") {
                Picker("Brand", selection: $brand) {
                    ForEach(FuelBrand.allCases) { b in Text(b.title).tag(b) }
                }
                if selectedVehicle.fuelType == .petrol {
                    Picker("Grade", selection: $subtype) {
                        ForEach(FuelSubtype.allCases) { s in Text(s.title).tag(s) }
                    }
                }
                if selectedVehicle.icon.supportsReserveTap && selectedVehicle.hasReserve {
                    Picker("Tank when you pulled in", selection: tankStateBinding) {
                        ForEach(TankState.allCases) { t in Text(t.title).tag(t) }
                    }
                    Button {
                        if store.reserveOdo(for: selectedVehicle.id) != nil {
                            store.clearReserveWithoutRefuel(
                                for: selectedVehicle.id,
                                at: store.lastOdo(for: selectedVehicle.id)
                            )
                            tankState = .main
                            tankStateWasManuallyChanged = true
                        } else {
                            beginReservePrompt()
                        }
                    } label: {
                        Label(
                            store.reserveOdo(for: selectedVehicle.id) == nil ? "Set reserve" : "Clear reserve",
                            systemImage: store.reserveOdo(for: selectedVehicle.id) == nil
                                ? "exclamationmark.fuelpump.fill"
                                : "fuelpump"
                        )
                    }
                }
                TextField("Notes (optional)", text: $notes, axis: .vertical)
            }

            if isEditing {
                Section {
                    Button("Delete this fill", role: .destructive) { confirmDelete = true }
                }
            }

            if let errorText {
                Section {
                    Text(errorText).foregroundStyle(.red)
                    if blockedByOdo, let previousFill {
                        Button("Edit previous fill") { editPreviousFill = previousFill }
                    }
                }
            }
        }
        .navigationTitle(isEditing ? "Edit fill" : "Log fuel")
        .navigationSubtitle(selectedVehicle.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { Task { await prepareSave() } }
                    .disabled(isSaving)
                    .fontWeight(.semibold)
            }
        }
        .onAppear {
            hydrate()
            LogFuelPerformance.sheetDidAppear()
        }
        .onChange(of: selectedVehicleId) { _, _ in
            tankState = LogFuelTankDefaults.stateAfterVehicleChange(
                current: tankState,
                wasManuallyChanged: tankStateWasManuallyChanged,
                isOnReserve: store.reserveOdo(for: selectedVehicle.id) != nil
            )
        }
        .sheet(item: $editPreviousFill) { fill in
            NavigationStack { LogFuelSheet(vehicle: selectedVehicle, existing: fill) }
        }
        .sheet(item: $reservePromptVehicle) { promptedVehicle in
            NavigationStack {
                Form {
                    Section {
                        TextField("Odometer", text: $reserveOdoText)
                            .keyboardType(.decimalPad)
                    } footer: {
                        if let last = store.lastOdo(for: promptedVehicle.id) {
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
                        Button("Cancel") { reservePromptVehicle = nil }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") { saveReserveStart(for: promptedVehicle) }
                            .fontWeight(.semibold)
                    }
                }
            }
            .presentationDetents([.medium])
        }
        .alert("Delete this fill?", isPresented: $confirmDelete) {
            Button("Delete", role: .destructive) {
                Task {
                    if let existing {
                        try? await store.deleteRefuel(existing.id)
                    }
                    dismiss()
                }
            }
            Button("Cancel", role: .cancel) {}
        }
        .confirmationDialog(
            pendingSanityIssues.first?.title ?? "Check this fill",
            isPresented: $confirmSanity,
            titleVisibility: .visible
        ) {
            Button("Save anyway") {
                Task { await save() }
            }
            Button("Go back", role: .cancel) {}
        } message: {
            Text(
                (pendingSanityIssues.map(\.message) + [pendingEntryCheckReason].compactMap { $0 })
                    .joined(separator: "\n\n")
            )
        }
        }
    }

    private var vehicleSubtitle: String {
        var parts = [selectedVehicle.fuelType.title]
        if let reg = selectedVehicle.regNumber, !reg.isEmpty { parts.append(reg) }
        return parts.joined(separator: " · ")
    }

    private func labeledField(
        _ title: String,
        suffix: String,
        text: Binding<String>,
        accessibility: String,
        required: Bool = false
    ) -> some View {
        HStack {
            Text(required ? "\(title) *" : title)
            Spacer(minLength: 12)
            TextField(suffix, text: text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .accessibilityLabel(accessibility)
            Text(suffix)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
        }
    }

    private var amountBinding: Binding<String> {
        Binding(get: { amountText }, set: { amountText = $0; recompute(from: .amount) })
    }

    private var rateBinding: Binding<String> {
        Binding(get: { rateText }, set: { rateText = $0; recompute(from: .rate) })
    }

    private var litresBinding: Binding<String> {
        Binding(get: { litresText }, set: { litresText = $0; recompute(from: .litres) })
    }

    private var tankStateBinding: Binding<TankState> {
        Binding(
            get: { tankState },
            set: {
                tankState = $0
                tankStateWasManuallyChanged = true
            }
        )
    }

    private func parse(_ text: String) -> Double? {
        let cleaned = text.replacingOccurrences(of: ",", with: "")
        guard let value = Double(cleaned), value > 0 else { return nil }
        return value
    }

    private func fill(rate value: Double) {
        rateText = String(format: "%.2f", value)
    }

    private func fill(litres value: Double) {
        litresText = String(format: "%.3f", value)
    }

    private func fill(amount value: Double) {
        amountText = String(format: "%.2f", value)
    }

    private func hydrate() {
        if let existing {
            date = Format.date(fromYMD: existing.refuelDate) ?? date
            fill(amount: existing.amountInr)
            fill(rate: existing.ratePerLitre)
            fill(litres: existing.litres)
            if let odo = existing.odoKm { odoText = String(format: "%.0f", odo) }
            notes = existing.notes ?? ""
            fullTank = existing.fullTank
            brand = existing.fuelBrand.flatMap(FuelBrand.init(rawValue:)) ?? .iocl
            subtype = existing.fuelSubtype ?? .normal
            tankState = existing.tankState ?? .main
            return
        }
        if selectedVehicle.fuelType == .cng { fullTank = true }
        tankState = LogFuelTankDefaults.state(
            isOnReserve: store.reserveOdo(for: selectedVehicle.id) != nil
        )
        if rateText.isEmpty, let cityRate = fuelPrices.price(for: selectedVehicle.fuelType) {
            fill(rate: cityRate)
        }
    }

    private func beginReservePrompt() {
        reserveOdoError = nil
        reserveOdoText = lastOdo.map { String(format: "%.0f", $0) } ?? ""
        reservePromptVehicle = selectedVehicle
    }

    private func saveReserveStart(for promptedVehicle: Vehicle) {
        let cleaned = reserveOdoText.replacingOccurrences(of: ",", with: "")
        guard let odo = Double(cleaned), odo > 0 else {
            reserveOdoError = OdoLogError.odoRequired.localizedDescription
            return
        }
        do {
            try store.validateReserveOdometer(odo, for: promptedVehicle.id)
            store.markReserve(for: promptedVehicle.id, at: odo, note: "Switched to reserve while logging fuel")
            tankState = .reserve
            tankStateWasManuallyChanged = true
            reservePromptVehicle = nil
        } catch {
            reserveOdoError = error.localizedDescription
        }
    }

    /// Keep the posted city rate stable. Amount fills litres; litres fills amount.
    /// Rate is only derived if the user typed litres and the rate field is empty.
    private func recompute(from field: Field) {
        let amount = parse(amountText)
        let rate = parse(rateText)
        let litres = parse(litresText)
        switch field {
        case .amount:
            if let amount, let rate, rate > 0 {
                fill(litres: amount / rate)
            }
        case .rate:
            if let amount, let rate, rate > 0 {
                fill(litres: amount / rate)
            } else if amount == nil, let rate, let litres, litres > 0 {
                fill(amount: rate * litres)
            }
        case .litres:
            if let litres, litres > 0, let rate, rate > 0 {
                fill(amount: rate * litres)
            } else if let litres, litres > 0, let amount, rate == nil {
                fill(rate: amount / litres)
            }
        }
    }

    private func prepareSave() async {
        await continueAfterFullTankChoice()
    }

    private func continueAfterFullTankChoice() async {
        let issues = resolvedSanityIssues()
        let entryCheck = await resolvedEntryCheck()
        if !issues.isEmpty || entryCheck.isSuspicious {
            pendingSanityIssues = issues
            pendingEntryCheckReason = entryCheck.reason
            confirmSanity = true
            return
        }
        await save()
    }

    private func resolvedEntryCheck() async -> FuelEntryCheck {
        guard let odometer = parse(odoText) else { return FuelEntryCheck(reason: nil) }
        return await FuelEntryChecker.check(
            FuelEntryChecker.Input(
                odometer: odometer,
                previousOdometer: previousFill?.odoKm ?? lastOdo,
                amount: parse(amountText),
                litres: parse(litresText),
                expectedRate: parse(rateText)
            )
        )
    }

    private func resolvedSanityIssues() -> [OdoSanity.Issue] {
        guard let odo = parse(odoText) else { return [] }
        var amount = parse(amountText)
        var rate = parse(rateText)
        var litres = parse(litresText)
        if amount == nil, let rate, let litres { amount = rate * litres }
        if rate == nil, let amount, let litres, litres > 0 { rate = amount / litres }
        if litres == nil, let amount, let rate, rate > 0 { litres = amount / rate }
        return OdoSanity.check(
            vehicle: selectedVehicle,
            odoKm: odo,
            litres: litres,
            date: date,
            previousOdo: previousFill?.odoKm ?? lastOdo,
            previousDateYMD: previousFill?.refuelDate
        )
    }

    private func save() async {
        isSaving = true
        errorText = nil
        blockedByOdo = false
        defer { isSaving = false }
        var amount = parse(amountText)
        var rate = parse(rateText)
        var litres = parse(litresText)
        if amount == nil, let rate, let litres { amount = rate * litres }
        if rate == nil, let amount, let litres, litres > 0 { rate = amount / litres }
        if litres == nil, let amount, let rate, rate > 0 { litres = amount / rate }
        guard let amount, let rate, let litres else {
            errorText = OdoLogError.missingFuelValues.localizedDescription
            return
        }
        guard parse(odoText) != nil else {
            errorText = OdoLogError.odoRequired.localizedDescription
            return
        }
        do {
            if let existing {
                try await store.updateRefuel(
                    existing.id,
                    vehicleId: selectedVehicle.id,
                    date: date,
                    amount: amount,
                    rate: rate,
                    litres: litres,
                    odoKm: parse(odoText),
                    fullTank: fullTank,
                    notes: notes,
                    fuelSubtype: selectedVehicle.fuelType == .petrol ? subtype : nil,
                    fuelBrand: brand,
                    tankState: selectedVehicle.icon.supportsReserveTap && selectedVehicle.hasReserve ? tankState : nil
                )
            } else {
                try await store.addRefuel(
                    vehicleId: selectedVehicle.id,
                    date: date,
                    amount: amount,
                    rate: rate,
                    litres: litres,
                    odoKm: parse(odoText),
                    fullTank: fullTank,
                    notes: notes,
                    fuelSubtype: selectedVehicle.fuelType == .petrol ? subtype : nil,
                    fuelBrand: brand,
                    tankState: selectedVehicle.icon.supportsReserveTap && selectedVehicle.hasReserve ? tankState : nil
                )
            }
            if usesReserveTap && amount >= OdoLogStore.reserveAutoClearAmountInr {
                await ReminderService.reschedule(using: store, enabled: settings.remindersEnabled)
            }
            dismiss()
        } catch let error as OdoLogError {
            errorText = error.localizedDescription
            if case .odoTooLow = error { blockedByOdo = true }
        } catch {
            errorText = error.localizedDescription
        }
    }
}
