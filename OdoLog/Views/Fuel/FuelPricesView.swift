import SwiftUI

struct FuelPricesView: View {
    @Environment(FuelPriceStore.self) private var fuelPrices
    @Environment(OdoLogStore.self) private var store
    @State private var query = ""

    private var cities: [String] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if q.isEmpty { return IndianCities.popular }
        return IndianCities.popular.filter { $0.localizedCaseInsensitiveContains(q) }
    }

    var body: some View {
        List {
            Section {
                if fuelPrices.isLoading {
                    ProgressView("Fetching today’s rates…")
                } else {
                    priceRow("Petrol", fuelPrices.prices?.petrol)
                    priceRow("Diesel", fuelPrices.prices?.diesel)
                    priceRow("CNG", fuelPrices.prices?.cng)
                }
                if let error = fuelPrices.errorMessage {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.footnote)
                }
            } header: {
                Text(fuelPrices.city)
            } footer: {
                if let source = fuelPrices.prices?.source, let date = fuelPrices.prices?.fetchedAt {
                    Text("From \(source), updated \(date.formatted(date: .abbreviated, time: .shortened)). Free public city rates — no API key.")
                } else {
                    Text("Rates are loaded from a free public source for the city you pick.")
                }
            }

            Section("Choose city") {
                ForEach(cities, id: \.self) { city in
                    Button {
                        Task {
                            await fuelPrices.selectCity(city)
                            try? await store.saveProfile(name: store.displayName ?? "", city: city)
                        }
                    } label: {
                        HStack {
                            Text(city)
                                .foregroundStyle(.primary)
                            Spacer()
                            if city.compare(fuelPrices.city, options: .caseInsensitive) == .orderedSame {
                                Image(systemName: "checkmark")
                                    .accessibilityLabel("Selected")
                            }
                        }
                    }
                    .accessibilityHint("Loads petrol, diesel, and CNG rates for \(city)")
                }
            }
        }
        .scrollContentBackground(.hidden)
        .navigationTitle("Fuel prices")
        .searchable(text: $query, prompt: "Search cities")
        .refreshable { await fuelPrices.refresh() }
        .task {
            if fuelPrices.prices == nil { await fuelPrices.refresh() }
        }
    }

    private func priceRow(_ title: String, _ value: Double?) -> some View {
        LabeledContent(title, value: value.map { String(format: "₹%.2f / L", $0) } ?? "—")
            .accessibilityLabel(value.map { "\(title) \(String(format: "%.2f rupees per litre", $0))" } ?? "\(title) unavailable")
    }
}
