import Charts
import SwiftUI

struct AnalyticsView: View {
    @Environment(OdoLogStore.self) private var store
    @Environment(AppSettings.self) private var settings
    @State private var vehicleId: UUID?
    @State private var period: Period = .month

    enum Period: String, CaseIterable, Identifiable {
        case week, month, all
        var id: String { rawValue }
        var title: String {
            switch self {
            case .week: "7 days"
            case .month: "30 days"
            case .all: "All"
            }
        }
        var days: Int? {
            switch self { case .week: 7; case .month: 30; case .all: nil }
        }
    }

    private var selected: Vehicle? {
        store.vehicles.first { $0.id == vehicleId } ?? store.vehicles.first
    }

    private var spendTint: Color { settings.accentColor }
    private var expenseTint: Color { settings.accentTertiary }
    private var rangeTint: Color { Color(red: 0.12, green: 0.62, blue: 0.55) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if store.vehicles.isEmpty {
                    DashCard {
                        Text("Add a vehicle and a few fills to see spend, expenses, and range.")
                            .foregroundStyle(.secondary)
                    }
                } else {
                    vehiclePicker
                    periodPicker

                    HStack(spacing: 12) {
                        heroCard(
                            title: "Spend",
                            value: Format.rupees(periodFuelSpend),
                            icon: "fuelpump.fill",
                            tint: spendTint
                        )
                        heroCard(
                            title: "Expenses",
                            value: Format.rupees(periodExpenses),
                            icon: "wrench.and.screwdriver.fill",
                            tint: expenseTint
                        )
                    }

                    if let rangeLine {
                        Text(rangeLine)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }

                    chartCard

                    Text("Vehicle details")
                        .font(.headline)
                        .padding(.top, 4)

                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                        detailCard(
                            title: "Mileage",
                            value: selected.flatMap { store.kmpl(for: $0.id) }.map { Format.kmpl($0) } ?? "—",
                            icon: "gauge.with.dots.needle.67percent",
                            tint: spendTint
                        )
                        detailCard(
                            title: "Range left",
                            value: selected.flatMap { store.range(for: $0)?.kmLeft }.map { Format.km($0) } ?? "—",
                            icon: "road.lanes",
                            tint: rangeTint
                        )
                        detailCard(
                            title: "₹ / km",
                            value: selected.flatMap { store.costPerKm(for: $0.id) }.map { String(format: "₹%.2f", $0) } ?? "—",
                            icon: "indianrupeesign.circle.fill",
                            tint: expenseTint
                        )
                        detailCard(
                            title: "Fuel used",
                            value: Format.litres(periodLitres),
                            icon: "drop.fill",
                            tint: spendTint
                        )
                    }

                    runningCostCard

                    NavigationLink {
                        ReportsView()
                    } label: {
                        DashCard {
                            HStack(spacing: 12) {
                                Image(systemName: "chart.bar.doc.horizontal.fill")
                                    .font(.title3)
                                    .foregroundStyle(settings.accentColor)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Monthly & yearly reports")
                                        .font(.headline)
                                        .foregroundStyle(.primary)
                                    Text("Break down spend, litres, and fill counts by period.")
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
            }
            .padding(16)
        }
        .navigationTitle("Analytics")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    ReportsView()
                } label: {
                    Image(systemName: "doc.text")
                }
                .accessibilityLabel("Reports")
            }
        }
        .onAppear { vehicleId = store.vehicles.first?.id }
    }

    private var vehiclePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(store.vehicles) { v in
                    OdoChip(title: v.displayName, selected: selected?.id == v.id) {
                        vehicleId = v.id
                    }
                }
            }
        }
    }

    private var periodPicker: some View {
        HStack(spacing: 8) {
            ForEach(Period.allCases) { p in
                OdoChip(title: p.title, selected: period == p) { period = p }
            }
            Spacer(minLength: 0)
        }
    }

    private var chartCard: some View {
        DashCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Trends")
                        .font(.headline)
                    Spacer()
                    HStack(spacing: 14) {
                        legendDot(color: spendTint, title: "Spend")
                        legendDot(color: expenseTint, title: "Expenses")
                    }
                }

                if chartPoints.isEmpty {
                    Text("Not enough logs in this period yet.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, minHeight: 180, alignment: .center)
                } else {
                    Chart(chartPoints) { point in
                        LineMark(
                            x: .value("Date", point.date),
                            y: .value("Amount", point.value)
                        )
                        .foregroundStyle(by: .value("Series", point.series))
                        .interpolationMethod(.catmullRom)
                        .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))

                        AreaMark(
                            x: .value("Date", point.date),
                            y: .value("Amount", point.value)
                        )
                        .foregroundStyle(by: .value("Series", point.series))
                        .interpolationMethod(.catmullRom)
                        .opacity(0.12)
                    }
                    .chartForegroundStyleScale([
                        "Spend": spendTint,
                        "Expenses": expenseTint,
                    ])
                    .chartLegend(.hidden)
                    .chartXAxis {
                        AxisMarks(values: .automatic(desiredCount: 4)) { _ in
                            AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4, 4]))
                                .foregroundStyle(Color.primary.opacity(0.08))
                            AxisValueLabel()
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .chartYAxis {
                        AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { _ in
                            AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4, 4]))
                                .foregroundStyle(Color.primary.opacity(0.1))
                            AxisValueLabel()
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(height: 210)
                }

                HStack {
                    labeledStat("Daily avg", Format.rupees(dailySpend))
                    labeledStat("Fills", "\(filteredFills.count)")
                    labeledStat("Distance", selected.flatMap { store.distance(for: $0.id) }.map(Format.km) ?? "—")
                }
            }
        }
    }

    private var runningCostCard: some View {
        DashCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Running cost")
                    .font(.headline)
                ForEach(store.vehicles) { v in
                    let spend = store.totalCost(for: v.id)
                    let kmpl = store.kmpl(for: v.id)
                    let share = garageTotal > 0 ? spend / garageTotal : 0
                    HStack(spacing: 12) {
                        VehicleAvatar(vehicle: v, size: 36)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(v.displayName).font(.subheadline.weight(.semibold))
                            GeometryReader { geo in
                                Capsule()
                                    .fill(settings.accentColor.opacity(0.16))
                                    .overlay(alignment: .leading) {
                                        Capsule()
                                            .fill(
                                                LinearGradient(
                                                    colors: [settings.accentColor, settings.accentTertiary],
                                                    startPoint: .leading,
                                                    endPoint: .trailing
                                                )
                                            )
                                            .frame(width: geo.size.width * share)
                                    }
                            }
                            .frame(height: 6)
                        }
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(Format.rupees(spend)).font(.subheadline.weight(.bold))
                            Text(kmpl.map { Format.kmpl($0) } ?? "Pending")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    private func heroCard(title: String, value: String, icon: String, tint: Color) -> some View {
        DashCard(padding: 16, radius: 24) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    ZStack {
                        Circle()
                            .fill(tint.opacity(0.18))
                            .frame(width: 42, height: 42)
                        Image(systemName: icon)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(tint)
                    }
                    Spacer(minLength: 0)
                    Circle()
                        .fill(tint.opacity(0.35))
                        .frame(width: 8, height: 8)
                }
                Text(title.uppercased())
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .tracking(0.6)
                Text(value)
                    .font(.title2.weight(.bold))
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(tint.opacity(0.08))
                .padding(-1)
                .allowsHitTesting(false)
        }
    }

    private func detailCard(title: String, value: String, icon: String, tint: Color) -> some View {
        DashCard(padding: 16, radius: 22) {
            VStack(alignment: .leading, spacing: 12) {
                Image(systemName: icon)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(tint)
                    .frame(width: 36, height: 36)
                    .background(tint.opacity(0.14), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.title3.weight(.bold))
                    .minimumScaleFactor(0.75)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, minHeight: 110, alignment: .topLeading)
        }
    }

    private func legendDot(color: Color, title: String) -> some View {
        HStack(spacing: 6) {
            Capsule().fill(color).frame(width: 14, height: 4)
            Text(title).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
        }
    }

    private func labeledStat(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.caption2).foregroundStyle(.secondary)
            Text(value).font(.subheadline.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Data

    private struct ChartPoint: Identifiable {
        var id: String { "\(series)-\(dateKey)" }
        var dateKey: String
        var date: String
        var value: Double
        var series: String
    }

    private var filteredFills: [Refuel] {
        guard let selected else { return [] }
        let fills = store.refuels(for: selected.id)
        guard let days = period.days else { return fills }
        let cutoff = Calendar.current.date(byAdding: .day, value: -days + 1, to: .now) ?? .now
        return fills.filter { parseYMD($0.refuelDate) >= cutoff }
    }

    private var filteredMaintenance: [MaintenanceLog] {
        guard let selected else { return [] }
        let logs = store.maintenance(for: selected.id)
        guard let days = period.days else { return logs }
        let cutoff = Calendar.current.date(byAdding: .day, value: -days + 1, to: .now) ?? .now
        return logs.filter { parseYMD($0.serviceDate) >= cutoff }
    }

    private var periodFuelSpend: Double {
        filteredFills.reduce(0) { $0 + $1.amountInr }
    }

    private var periodExpenses: Double {
        let maintenance = filteredMaintenance.reduce(0) { $0 + ($1.costInr ?? 0) }
        guard let selected else { return maintenance }
        let trips = store.trips(for: selected.id)
        let tolls: Double
        if let days = period.days {
            let cutoff = Calendar.current.date(byAdding: .day, value: -days + 1, to: .now) ?? .now
            tolls = trips.filter { parseYMD($0.tripDate) >= cutoff }.reduce(0) { $0 + ($1.tollsInr ?? 0) }
        } else {
            tolls = trips.reduce(0) { $0 + ($1.tollsInr ?? 0) }
        }
        return maintenance + tolls
    }

    private var periodLitres: Double {
        filteredFills.reduce(0) { $0 + $1.litres }
    }

    private var dailySpend: Double {
        guard !filteredFills.isEmpty else { return 0 }
        let activeDays = max(1, Set(filteredFills.map(\.refuelDate)).count)
        return periodFuelSpend / Double(activeDays)
    }

    private var garageTotal: Double {
        store.vehicles.reduce(0) { $0 + store.totalCost(for: $1.id) }
    }

    private var rangeLine: String? {
        guard let vehicle = selected, let range = store.range(for: vehicle) else { return nil }
        let left = Format.km(range.kmLeft)
        let next = Format.km(range.nextOdo)
        return "Range left \(left) · refuel around \(next)"
    }

    private var chartPoints: [ChartPoint] {
        let spendGroups = Dictionary(grouping: filteredFills, by: \.refuelDate)
        let expenseGroups = Dictionary(grouping: filteredMaintenance, by: \.serviceDate)
        let keys = Set(spendGroups.keys).union(expenseGroups.keys).sorted()
        var points: [ChartPoint] = []
        for key in keys {
            let spend = (spendGroups[key] ?? []).reduce(0) { $0 + $1.amountInr }
            let expense = (expenseGroups[key] ?? []).reduce(0) { $0 + ($1.costInr ?? 0) }
            let label = Format.shortDate(key)
            if spend > 0 {
                points.append(ChartPoint(dateKey: key, date: label, value: spend, series: "Spend"))
            }
            if expense > 0 {
                points.append(ChartPoint(dateKey: key, date: label, value: expense, series: "Expenses"))
            }
        }
        return points
    }

    private func parseYMD(_ ymd: String) -> Date {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.date(from: ymd) ?? .distantPast
    }
}
