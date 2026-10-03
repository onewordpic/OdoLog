import SwiftUI

struct AddVehicleSheet: View {
    @Environment(OdoLogStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var fuelType: FuelType = .petrol
    @State private var icon: VehicleIconKind = .car
    @State private var make = ""
    @State private var yearText = ""
    @State private var regNumber = ""
    @State private var isGuest = false
    @State private var ownerName = ""
    @State private var hasReserve = false
    @State private var reserveText = ""
    @State private var claimedText = ""
    @State private var isSaving = false
    @State private var errorText: String?

    private var matches: [VehicleCatalogEntry] { VehicleCatalog.search(name, kind: icon) }

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
            if icon.supportsReserveTap {
                Section {
                    Toggle("Has reserve tap", isOn: $hasReserve)
                    if hasReserve {
                        TextField("Reserve litres (~1.5 L)", text: $reserveText)
                            .keyboardType(.decimalPad)
                    }
                } header: {
                    Text("Reserve tap")
                } footer: {
                    Text("Only some bikes have a reserve fuel tap (common on carbureted models). Fuel-injected bikes usually don’t. Size varies by bike — used to estimate range on reserve.")
                }
            }
            if let errorText {
                Text(errorText).foregroundStyle(.red).font(.footnote)
            }
        }
        .navigationTitle("Add vehicle")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { Task { await save() } }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
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
            try await store.addVehicle(
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
