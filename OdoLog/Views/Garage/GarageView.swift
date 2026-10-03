import SwiftUI

private enum GarageRoute: Hashable {
    case reports
    case vehicle(UUID)
}

struct GarageView: View {
    @Environment(OdoLogStore.self) private var store
    @Environment(AppSettings.self) private var settings
    @State private var showAddVehicle = false
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if !store.vehicles.isEmpty {
                        Button {
                            path.append(GarageRoute.reports)
                        } label: {
                            DashCard {
                                HStack(spacing: 12) {
                                    Image(systemName: "chart.bar.doc.horizontal.fill")
                                        .font(.title3)
                                        .foregroundStyle(settings.accentColor)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Reports")
                                            .font(.headline)
                                            .foregroundStyle(.primary)
                                        Text("Monthly and yearly fuel spend")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer(minLength: 0)
                                    Image(systemName: "chevron.right")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.tertiary)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }

                    if store.vehicles.isEmpty {
                        DashCard {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("Empty garage")
                                    .font(.title3.weight(.bold))
                                Text("Add a vehicle to start logging fuel and service.")
                                    .foregroundStyle(.secondary)
                                OdoPrimaryButton(title: "Add vehicle", systemImage: "plus") {
                                    showAddVehicle = true
                                }
                            }
                        }
                    } else {
                        ForEach(store.vehicles) { vehicle in
                            DashCard {
                                HStack(alignment: .center, spacing: 10) {
                                    Button {
                                        path.append(GarageRoute.vehicle(vehicle.id))
                                    } label: {
                                        garageRow(vehicle)
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityHint("Opens \(vehicle.displayName)")

                                    if vehicle.icon.supportsReserveTap && vehicle.hasReserve {
                                        Button {
                                            toggleReserve(for: vehicle)
                                        } label: {
                                            Image(systemName: store.reserveOdo(for: vehicle.id) == nil
                                                  ? "exclamationmark.fuelpump"
                                                  : "fuelpump.fill")
                                                .font(.headline)
                                                .foregroundStyle(settings.accentColor)
                                                .frame(width: 44, height: 44)
                                                .background(settings.accentColor.opacity(0.12), in: Circle())
                                        }
                                        .buttonStyle(.plain)
                                        .accessibilityLabel(store.reserveOdo(for: vehicle.id) == nil
                                                            ? "Switch to reserve"
                                                            : "Switch to main tank")
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(16)
            }
            .navigationTitle("Garage")
            .navigationDestination(for: GarageRoute.self) { route in
                switch route {
                case .reports:
                    ReportsView()
                case .vehicle(let id):
                    VehicleDetailView(vehicleId: id)
                }
            }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showAddVehicle = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.body.weight(.semibold))
                            .frame(width: 32, height: 32)
                            .background(Color.primary.opacity(0.06), in: Circle())
                    }
                    .accessibilityLabel("Add vehicle")
                }
            }
            .sheet(isPresented: $showAddVehicle) {
                NavigationStack { AddVehicleSheet() }
            }
            .refreshable { await store.refresh(reportError: true) }
        }
    }

    @ViewBuilder
    private func garageRow(_ vehicle: Vehicle) -> some View {
        HStack(alignment: .top, spacing: 14) {
                VehicleAvatar(vehicle: vehicle, size: 56)
                VStack(alignment: .leading, spacing: 8) {
                    Text(vehicle.displayName)
                        .font(.headline)
                        .foregroundStyle(.primary)
                    Text(meta(vehicle))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    HStack(spacing: 8) {
                        Text(Format.rupees(store.spend(for: vehicle.id)))
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(settings.accentColor)
                        if let odo = store.lastOdo(for: vehicle.id) {
                            Text(Format.km(odo))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    if let badge = statusBadge(for: vehicle) {
                        Text(badge.text)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(badge.color)
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
        }
    }

    private func meta(_ vehicle: Vehicle) -> String {
        var parts = [vehicle.fuelType.title]
        if let reg = vehicle.regNumber, !reg.isEmpty { parts.append(reg) }
        if let year = vehicle.modelYear { parts.append("\(year)") }
        if vehicle.isGuest { parts.append("Borrowed") }
        return parts.joined(separator: " · ")
    }

    private func statusBadge(for vehicle: Vehicle) -> (text: String, color: Color)? {
        if let marked = store.reserveOdo(for: vehicle.id) {
            let roughKmpl = vehicle.resolvedClaimedKmpl
                ?? vehicle.fuelType.fallbackKmpl
            if let litres = vehicle.resolvedReserveLitres, litres > 0, roughKmpl > 0 {
                let rangeKm = litres * roughKmpl
                let current = max(store.lastOdo(for: vehicle.id) ?? marked, marked)
                let kmLeft = max(0, marked + rangeKm - current)
                if kmLeft <= rangeKm * 0.10 {
                    return ("Refuel now", .red)
                }
                if current >= marked + rangeKm * 0.75 {
                    return ("Refuel soon", .orange)
                }
                return ("~\(Int(kmLeft.rounded())) km left", settings.accentColor)
            }
            return ("On reserve", settings.accentColor)
        }
        if let due = store.serviceDueSummary(for: vehicle.id) {
            return (due, .orange)
        }
        return nil
    }

    private func toggleReserve(for vehicle: Vehicle) {
        if store.reserveOdo(for: vehicle.id) != nil {
            store.clearReserve(for: vehicle.id, at: store.lastOdo(for: vehicle.id), note: "Switched to main tank from Garage")
        } else if let odo = store.lastOdo(for: vehicle.id) {
            store.markReserve(for: vehicle.id, at: odo, note: "Switched to reserve from Garage")
        }
        Task {
            await ReminderService.reschedule(using: store, enabled: settings.remindersEnabled)
        }
    }
}
