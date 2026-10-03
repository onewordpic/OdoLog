import SwiftUI

struct EditVehicleSheet: View {
    @Environment(OdoLogStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let vehicle: Vehicle

    @State private var name: String
    @State private var fuelType: FuelType
    @State private var icon: VehicleIconKind
    @State private var make: String
    @State private var yearText: String
    @State private var regNumber: String
    @State private var isGuest: Bool
    @State private var ownerName: String
    @State private var hasReserve: Bool
    @State private var reserveText: String
    @State private var claimedText: String
    @State private var isSaving = false
    @State private var errorText: String?

    init(vehicle: Vehicle) {
        self.vehicle = vehicle
        _name = State(initialValue: vehicle.name)
        _fuelType = State(initialValue: vehicle.fuelType)
        _icon = State(initialValue: vehicle.icon)
        _make = State(initialValue: vehicle.make ?? "")
        _yearText = State(initialValue: vehicle.modelYear.map(String.init) ?? "")
        _regNumber = State(initialValue: vehicle.regNumber ?? "")
        _isGuest = State(initialValue: vehicle.isGuest)
        _ownerName = State(initialValue: vehicle.ownerName ?? "")
        _hasReserve = State(initialValue: vehicle.icon.supportsReserveTap && vehicle.hasReserve)
        _reserveText = State(initialValue: vehicle.reserveLitres.map { String(format: "%g", $0) } ?? "")
        let claimed = vehicle.claimedMileageKmpl ?? VehicleCatalog.claimedMileage(make: vehicle.make, model: vehicle.name)
        _claimedText = State(initialValue: claimed.map { String(format: "%g", $0) } ?? "")
    }

    private var matches: [VehicleCatalogEntry] {
        VehicleCatalog.search(name, kind: icon)
    }

    var body: some View {
        Form {
            Section {
                TextField("Name", text: $name)
                    .textInputAutocapitalization(.words)
                Picker("Type", selection: $icon) {
                    ForEach(VehicleIconKind.allCases) { kind in
                        Label(kind.title, systemImage: kind.systemImage).tag(kind)
                    }
                }
                .onChange(of: icon) { _, newIcon in
                    if !newIcon.supportsReserveTap {
                        hasReserve = false
                    }
                }
                Picker("Fuel", selection: $fuelType) {
                    ForEach(FuelType.allCases) { type in
                        Text(type.title).tag(type)
                    }
                }
                TextField("Make (optional)", text: $make)
                TextField("Model year (optional)", text: $yearText)
                    .keyboardType(.numberPad)
                TextField("Registration (optional)", text: $regNumber)
                    .textInputAutocapitalization(.characters)
                TextField("Claimed km/L (optional)", text: $claimedText)
                    .keyboardType(.decimalPad)
            } header: {
                Text("Vehicle")
            } footer: {
                Text("Company or brochure figure. Used as a comparison and for range until you have enough fills.")
            }
            if !matches.isEmpty {
                Section("Matching vehicles") {
                    ForEach(matches) { suggestion in
                        Button {
                            make = suggestion.make
                            name = suggestion.model
                            fuelType = suggestion.fuel
                            if let claimed = VehicleCatalog.claimedMileage(make: suggestion.make, model: suggestion.model) {
                                claimedText = String(format: "%g", claimed)
                            }
                        } label: {
                            Label(suggestion.title, systemImage: icon.systemImage)
                        }
                    }
                }
            }
            Section("Borrowed") {
                Toggle("Guest / borrowed vehicle", isOn: $isGuest)
                if isGuest {
                    TextField("Owner name", text: $ownerName)
                }
            }
            if icon == .bike {
                Section {
                    Toggle("Has reserve tap", isOn: $hasReserve)
                    if hasReserve {
                        TextField("Reserve litres (~1.5 L)", text: $reserveText)
                            .keyboardType(.decimalPad)
                    }
                } header: {
                    Text("Reserve tap")
                } footer: {
                    Text("Only some bikes have a reserve tap (often carbureted). Fuel-injected bikes usually don’t. Leave off if yours has none. Size varies by bike.")
                }
            }
            if let errorText {
                Text(errorText).foregroundStyle(.red).font(.footnote)
            }
        }
        .navigationTitle("Edit vehicle")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { Task { await save() } }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                    .fontWeight(.semibold)
            }
        }
    }

    private func save() async {
        isSaving = true
        errorText = nil
        defer { isSaving = false }
        let wantsReserve = icon.supportsReserveTap && hasReserve
        let litres = Double(reserveText.replacingOccurrences(of: ",", with: ""))
        if wantsReserve, litres == nil || (litres ?? 0) <= 0 {
            errorText = "Enter this bike’s reserve tank size in litres so OdoLog can estimate range on reserve."
            return
        }
        do {
            try await store.updateVehicle(
                vehicle.id,
                name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                fuelType: fuelType,
                icon: icon,
                make: make.trimmingCharacters(in: .whitespacesAndNewlines),
                modelYear: Int(yearText),
                regNumber: regNumber.trimmingCharacters(in: .whitespacesAndNewlines),
                isGuest: isGuest,
                ownerName: ownerName.trimmingCharacters(in: .whitespacesAndNewlines),
                hasReserve: wantsReserve,
                reserveLitres: wantsReserve ? litres : nil,
                claimedMileageKmpl: Double(claimedText.replacingOccurrences(of: ",", with: ""))
            )
            dismiss()
        } catch {
            errorText = error.localizedDescription
        }
    }
}
