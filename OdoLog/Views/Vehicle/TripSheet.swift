import SwiftUI

struct TripSheet: View {
    @Environment(OdoLogStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let vehicle: Vehicle

    @State private var date = Date()
    @State private var purpose = ""
    @State private var startOdoText = ""
    @State private var endOdoText = ""
    @State private var tollsText = ""
    @State private var notes = ""
    @State private var isSaving = false
    @State private var errorText: String?

    var body: some View {
        Form {
            Section {
                HStack(spacing: 12) {
                    VehicleAvatar(vehicle: vehicle, size: 44)
                    Text(vehicle.displayName).font(.headline)
                }
                DatePicker("Date", selection: $date, displayedComponents: .date)
                TextField("Purpose (optional)", text: $purpose)
                TextField("Start odo (km)", text: $startOdoText)
                    .keyboardType(.decimalPad)
                TextField("End odo (km)", text: $endOdoText)
                    .keyboardType(.decimalPad)
                TextField("Tolls (₹)", text: $tollsText)
                    .keyboardType(.decimalPad)
                TextField("Notes (optional)", text: $notes, axis: .vertical)
            } footer: {
                Text("Log trips and tolls so Analytics expenses include them.")
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red) }
            }
        }
        .navigationTitle("Log trip")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task { await save() }
                }
                .disabled(isSaving)
            }
        }
        .onAppear {
            if let last = store.lastOdo(for: vehicle.id) {
                startOdoText = String(Int(last.rounded()))
            }
        }
    }

    private func save() async {
        isSaving = true
        errorText = nil
        defer { isSaving = false }
        do {
            try await store.addTrip(
                vehicleId: vehicle.id,
                date: date,
                purpose: purpose,
                notes: notes,
                startOdo: Double(startOdoText.replacingOccurrences(of: ",", with: "")),
                endOdo: Double(endOdoText.replacingOccurrences(of: ",", with: "")),
                tolls: Double(tollsText.replacingOccurrences(of: ",", with: ""))
            )
            dismiss()
        } catch {
            errorText = error.localizedDescription
        }
    }
}
