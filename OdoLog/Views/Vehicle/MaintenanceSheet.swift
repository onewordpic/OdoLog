import SwiftUI

struct MaintenanceSheet: View {
    @Environment(OdoLogStore.self) private var store
    @Environment(AppSettings.self) private var settings
    @Environment(\.dismiss) private var dismiss
    let vehicle: Vehicle
    var existing: MaintenanceLog? = nil

    @State private var date = Date()
    @State private var serviceType = "Service"
    @State private var odoText = ""
    @State private var costText = ""
    @State private var notes = ""
    @State private var nextOdoText = ""
    @State private var hasNextDate = false
    @State private var nextDate = Date()
    @State private var isSaving = false
    @State private var errorText: String?
    @State private var confirmDelete = false

    private let types = ["Service", "Oil change", "Tyres", "Battery", "Brakes", "Insurance", "PUC", "Other"]
    private var isEditing: Bool { existing != nil }

    private var typeOptions: [String] {
        if let existing, !types.contains(existing.serviceType) {
            return types + [existing.serviceType]
        }
        return types
    }

    var body: some View {
        Form {
            Section {
                HStack(spacing: 12) {
                    VehicleAvatar(vehicle: vehicle, size: 44)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(vehicle.displayName).font(.headline)
                        Text(vehicle.fuelType.title).font(.caption).foregroundStyle(.secondary)
                    }
                }
                .accessibilityElement(children: .combine)
            }
            Picker("Type", selection: $serviceType) {
                ForEach(typeOptions, id: \.self) { Text($0) }
            }
            DatePicker("Date", selection: $date, displayedComponents: .date)
            TextField("Odometer (km)", text: $odoText).keyboardType(.decimalPad)
            TextField("Cost (₹)", text: $costText).keyboardType(.decimalPad)
            TextField("Notes", text: $notes, axis: .vertical)
            TextField("Next service odo", text: $nextOdoText).keyboardType(.decimalPad)
            Toggle("Next service date", isOn: $hasNextDate)
            if hasNextDate {
                DatePicker("When", selection: $nextDate, displayedComponents: .date)
            }
            if isEditing {
                Button("Delete this service log", role: .destructive) { confirmDelete = true }
            }
            if let errorText { Text(errorText).foregroundStyle(.red) }
        }
        .navigationTitle(isEditing ? "Edit service" : "Log service")
        .navigationSubtitle(vehicle.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { Task { await save() } }.disabled(isSaving || serviceType.isEmpty)
            }
        }
        .onAppear { hydrate() }
        .alert("Delete this service log?", isPresented: $confirmDelete) {
            Button("Delete", role: .destructive) {
                Task {
                    if let existing { try? await store.deleteMaintenance(existing.id) }
                    dismiss()
                }
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    private func hydrate() {
        if let existing {
            date = Format.date(fromYMD: existing.serviceDate) ?? date
            serviceType = existing.serviceType
            if let odo = existing.odoKm { odoText = String(Int(odo.rounded())) }
            if let cost = existing.costInr { costText = String(format: "%.0f", cost) }
            notes = existing.notes ?? ""
            if let next = existing.nextServiceOdoKm { nextOdoText = String(Int(next.rounded())) }
            if let next = existing.nextServiceDate, let parsed = Format.date(fromYMD: next) {
                hasNextDate = true
                nextDate = parsed
            }
            return
        }
        if let last = store.lastOdo(for: vehicle.id) { odoText = String(Int(last.rounded())) }
    }

    private func save() async {
        isSaving = true
        errorText = nil
        defer { isSaving = false }
        do {
            if let existing {
                try await store.updateMaintenance(
                    existing.id,
                    date: date,
                    serviceType: serviceType,
                    odoKm: Double(odoText.replacingOccurrences(of: ",", with: "")),
                    costInr: Double(costText.replacingOccurrences(of: ",", with: "")),
                    notes: notes,
                    nextServiceOdo: Double(nextOdoText.replacingOccurrences(of: ",", with: "")),
                    nextServiceDate: hasNextDate ? nextDate : nil
                )
            } else {
                try await store.addMaintenance(
                    vehicleId: vehicle.id,
                    date: date,
                    serviceType: serviceType,
                    odoKm: Double(odoText.replacingOccurrences(of: ",", with: "")),
                    costInr: Double(costText.replacingOccurrences(of: ",", with: "")),
                    notes: notes,
                    nextServiceOdo: Double(nextOdoText.replacingOccurrences(of: ",", with: "")),
                    nextServiceDate: hasNextDate ? nextDate : nil
                )
            }
            await ReminderService.reschedule(using: store, enabled: settings.remindersEnabled)
            dismiss()
        } catch {
            errorText = error.localizedDescription
        }
    }
}
