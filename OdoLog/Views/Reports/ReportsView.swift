import Charts
import SwiftUI

struct ReportsView: View {
    @Environment(OdoLogStore.self) private var store
    @Environment(AppSettings.self) private var settings
    @State private var yearly = false

    private struct Period: Identifiable {
        var id: String { key }
        var key: String
        var label: String
        var spend: Double
        var litres: Double
        var count: Int
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Picker("View", selection: $yearly) {
                    Text("Monthly").tag(false)
                    Text("Yearly").tag(true)
                }
                .pickerStyle(.segmented)

                if periods.isEmpty {
                    DashCard {
                        Text("Log a few fills to see monthly and yearly spend.")
                            .foregroundStyle(.secondary)
                    }
                } else {
                    DashCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Spend")
                                .font(.headline)
                            Chart(chartRows, id: \.label) { row in
                                BarMark(
                                    x: .value("Period", row.label),
                                    y: .value("Spend", row.spend)
                                )
                                .foregroundStyle(settings.accentColor.gradient)
                                .cornerRadius(6)
                            }
                            .frame(height: 200)
                            .chartYAxis {
                                AxisMarks(position: .leading, values: .automatic(desiredCount: 4))
                            }
                        }
                    }

                    ForEach(periods) { period in
                        DashCard(padding: 16) {
                            VStack(alignment: .leading, spacing: 10) {
                                Text(period.label).font(.headline)
                                HStack {
                                    labeled("Spend", Format.rupees(period.spend))
                                    labeled("Litres", Format.litres(period.litres))
                                    labeled("Fills", "\(period.count)")
                                }
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
        .navigationTitle("Reports")
        .navigationBarTitleDisplayMode(.large)
    }

    private var periods: [Period] {
        var map: [String: Period] = [:]
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        let out = DateFormatter()
        out.locale = Locale(identifier: "en_IN")
        for r in store.allRefuels {
            guard let date = f.date(from: r.refuelDate) else { continue }
            let key: String
            let label: String
            if yearly {
                key = "\(Calendar.current.component(.year, from: date))"
                label = key
            } else {
                key = String(format: "%04d-%02d",
                             Calendar.current.component(.year, from: date),
                             Calendar.current.component(.month, from: date))
                out.setLocalizedDateFormatFromTemplate("MMM y")
                label = out.string(from: date)
            }
            var p = map[key] ?? Period(key: key, label: label, spend: 0, litres: 0, count: 0)
            p.spend += r.amountInr
            p.litres += r.litres
            p.count += 1
            map[key] = p
        }
        return map.values.sorted { $0.key > $1.key }
    }

    private var chartRows: [Period] {
        Array(periods.prefix(12).reversed())
    }

    private func labeled(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.subheadline.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
