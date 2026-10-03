import SwiftUI
import UIKit

enum OdoPalette {
    static let terracotta = Color(red: 232 / 255, green: 92 / 255, blue: 65 / 255)
    static let terracottaDeep = Color(red: 196 / 255, green: 68 / 255, blue: 46 / 255)
    static let ink = Color(red: 28 / 255, green: 26 / 255, blue: 24 / 255)
    static let mint = terracotta
    static let mintInk = ink

    static let vehicleAccents: [Color] = [
        Color(red: 255 / 255, green: 214 / 255, blue: 196 / 255),
        Color(red: 255 / 255, green: 228 / 255, blue: 186 / 255),
        Color(red: 255 / 255, green: 205 / 255, blue: 210 / 255),
        Color(red: 221 / 255, green: 214 / 255, blue: 204 / 255),
        Color(red: 255 / 255, green: 196 / 255, blue: 176 / 255),
        Color(red: 232 / 255, green: 208 / 255, blue: 196 / 255),
    ]

    static func accent(for id: UUID) -> Color {
        let hash = abs(id.uuidString.hashValue)
        return vehicleAccents[hash % vehicleAccents.count]
    }
}

enum DashboardWidget: String, CaseIterable, Identifiable {
    case spend, efficiency, cityRates, vehicle, activity
    var id: String { rawValue }
    var title: String {
        switch self {
        case .spend: "Spend and fuel"
        case .efficiency: "Efficiency ring"
        case .cityRates: "City rates"
        case .vehicle: "Vehicle card"
        case .activity: "Activity"
        }
    }
}

enum AppearanceChoice: String, CaseIterable, Identifiable {
    case system, light, dark, amoled
    var id: String { rawValue }
    var title: String {
        switch self {
        case .system: "System"
        case .light: "Light"
        case .dark: "Dark"
        case .amoled: "AMOLED"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark, .amoled: .dark
        }
    }
}

enum AccentChoice: String, CaseIterable, Identifiable {
    case coral, amber, orange, rose, pink, red
    case mint, teal, green, lime
    case sky, blue, indigo, violet, purple
    case graphite, brown
    case custom

    var id: String { rawValue }

    var title: String {
        switch self {
        case .coral: "Coral"
        case .amber: "Amber"
        case .orange: "Orange"
        case .rose: "Rose"
        case .pink: "Pink"
        case .red: "Red"
        case .mint: "Mint"
        case .teal: "Teal"
        case .green: "Green"
        case .lime: "Lime"
        case .sky: "Sky"
        case .blue: "Blue"
        case .indigo: "Indigo"
        case .violet: "Violet"
        case .purple: "Purple"
        case .graphite: "Graphite"
        case .brown: "Brown"
        case .custom: "Custom"
        }
    }

    /// Presets shown in the grid (custom is handled separately via ColorPicker).
    static var presets: [AccentChoice] { allCases.filter { $0 != .custom } }

    var color: Color {
        switch self {
        case .coral: OdoPalette.terracotta
        case .amber: Color(red: 0.86, green: 0.54, blue: 0.02)
        case .orange: Color(red: 0.95, green: 0.45, blue: 0.10)
        case .rose: Color(red: 0.84, green: 0.25, blue: 0.46)
        case .pink: Color(red: 0.92, green: 0.34, blue: 0.61)
        case .red: Color(red: 0.86, green: 0.18, blue: 0.22)
        case .mint: Color(red: 0.05, green: 0.64, blue: 0.51)
        case .teal: Color(red: 0.02, green: 0.59, blue: 0.65)
        case .green: Color(red: 0.20, green: 0.62, blue: 0.33)
        case .lime: Color(red: 0.52, green: 0.74, blue: 0.12)
        case .sky: Color(red: 0.02, green: 0.53, blue: 0.82)
        case .blue: Color(red: 0.05, green: 0.40, blue: 0.92)
        case .indigo: Color(red: 0.37, green: 0.42, blue: 0.88)
        case .violet: Color(red: 0.56, green: 0.27, blue: 0.88)
        case .purple: Color(red: 0.61, green: 0.22, blue: 0.74)
        case .graphite: Color(red: 0.35, green: 0.36, blue: 0.38)
        case .brown: Color(red: 0.55, green: 0.35, blue: 0.22)
        case .custom: OdoPalette.terracotta
        }
    }

    var tertiary: Color {
        switch self {
        case .coral: Color(red: 0.98, green: 0.72, blue: 0.52)
        case .amber: Color(red: 0.62, green: 0.28, blue: 0.82)
        case .orange: Color(red: 0.20, green: 0.55, blue: 0.90)
        case .rose: Color(red: 0.18, green: 0.62, blue: 0.72)
        case .pink: Color(red: 0.25, green: 0.55, blue: 0.95)
        case .red: Color(red: 0.95, green: 0.65, blue: 0.20)
        case .mint: Color(red: 0.45, green: 0.32, blue: 0.88)
        case .teal: Color(red: 0.92, green: 0.45, blue: 0.22)
        case .green: Color(red: 0.95, green: 0.55, blue: 0.15)
        case .lime: Color(red: 0.35, green: 0.35, blue: 0.90)
        case .sky: Color(red: 0.95, green: 0.55, blue: 0.15)
        case .blue: Color(red: 0.98, green: 0.55, blue: 0.20)
        case .indigo: Color(red: 0.12, green: 0.72, blue: 0.62)
        case .violet: Color(red: 0.98, green: 0.55, blue: 0.18)
        case .purple: Color(red: 0.98, green: 0.62, blue: 0.20)
        case .graphite: Color(red: 0.90, green: 0.50, blue: 0.30)
        case .brown: Color(red: 0.30, green: 0.60, blue: 0.70)
        case .custom: Color(red: 0.98, green: 0.72, blue: 0.52)
        }
    }
}

@Observable
final class AppSettings {
    var appearance: AppearanceChoice {
        didSet { UserDefaults.standard.set(appearance.rawValue, forKey: "odolog.appearance") }
    }
    var accent: AccentChoice {
        didSet { UserDefaults.standard.set(accent.rawValue, forKey: "odolog.accent") }
    }
    /// Stored as #RRGGBB when using the custom colour picker.
    var customAccentHex: String {
        didSet { UserDefaults.standard.set(customAccentHex, forKey: "odolog.customAccentHex") }
    }
    var liquidGlass: Bool {
        didSet { UserDefaults.standard.set(liquidGlass, forKey: "odolog.liquidGlassEnabled") }
    }
    var remindersEnabled: Bool {
        didSet { UserDefaults.standard.set(remindersEnabled, forKey: "odolog.remindersEnabled") }
    }
    var replaceVehicleLogsOnImport: Bool {
        didSet { UserDefaults.standard.set(replaceVehicleLogsOnImport, forKey: "odolog.replaceVehicleLogsOnImport") }
    }
    var dashboardWidgetRaw: [String] {
        didSet { UserDefaults.standard.set(dashboardWidgetRaw, forKey: OdoLogGroup.dashboardWidgetsKey) }
    }
    var strictOdoChecks: Bool {
        didSet { UserDefaults.standard.set(strictOdoChecks, forKey: "odolog.strictOdoChecks") }
    }
    var defaultVehicleId: UUID? {
        didSet {
            if let defaultVehicleId {
                UserDefaults.standard.set(defaultVehicleId.uuidString, forKey: "odolog.defaultVehicleId")
            } else {
                UserDefaults.standard.removeObject(forKey: "odolog.defaultVehicleId")
            }
        }
    }
    var hideSyncGaragePrompt: Bool {
        didSet { UserDefaults.standard.set(hideSyncGaragePrompt, forKey: "odolog.hideSyncGaragePrompt") }
    }
    var photoStamp: TimeInterval = Date().timeIntervalSince1970

    var usesAmoled: Bool { appearance == .amoled }

    func canvasColor(for scheme: ColorScheme) -> Color {
        if usesAmoled { return .black }
        return scheme == .dark
            ? Color(red: 0.10, green: 0.09, blue: 0.08)
            : Color(red: 0.945, green: 0.933, blue: 0.918)
    }

    func cardColor(for scheme: ColorScheme) -> Color {
        if usesAmoled { return Color(white: 0.07) }
        return scheme == .dark ? Color(red: 0.16, green: 0.15, blue: 0.14) : .white
    }

    func notePhotoChange() {
        photoStamp = Date().timeIntervalSince1970
    }

    var accentColor: Color {
        accent == .custom ? Color(hex: customAccentHex) ?? OdoPalette.terracotta : accent.color
    }

    var accentTertiary: Color {
        accent == .custom ? Color(hex: customAccentHex)?.harmonizingTertiary() ?? accent.tertiary : accent.tertiary
    }

    var accentTitle: String {
        accent == .custom ? "Custom" : accent.title
    }

    var dashboardWidgets: Set<DashboardWidget> {
        let set = Set(dashboardWidgetRaw.compactMap(DashboardWidget.init(rawValue:)))
        return set.isEmpty ? Set(DashboardWidget.allCases) : set
    }

    func shows(_ widget: DashboardWidget) -> Bool {
        dashboardWidgets.contains(widget)
    }

    func toggle(_ widget: DashboardWidget) {
        var next = dashboardWidgets
        if next.contains(widget) {
            if next.count > 1 { next.remove(widget) }
        } else {
            next.insert(widget)
        }
        dashboardWidgetRaw = DashboardWidget.allCases.filter { next.contains($0) }.map(\.rawValue)
    }

    init() {
        appearance = AppearanceChoice(rawValue: UserDefaults.standard.string(forKey: "odolog.appearance") ?? "") ?? .light
        let savedAccent = UserDefaults.standard.string(forKey: "odolog.accent") ?? ""
        accent = AccentChoice(rawValue: savedAccent) ?? .coral
        customAccentHex = UserDefaults.standard.string(forKey: "odolog.customAccentHex") ?? "#E85C41"
        if UserDefaults.standard.object(forKey: "odolog.liquidGlassEnabled") != nil {
            liquidGlass = UserDefaults.standard.bool(forKey: "odolog.liquidGlassEnabled")
        } else {
            liquidGlass = false
        }
        remindersEnabled = UserDefaults.standard.bool(forKey: "odolog.remindersEnabled")
        replaceVehicleLogsOnImport = UserDefaults.standard.bool(forKey: "odolog.replaceVehicleLogsOnImport")
        dashboardWidgetRaw = UserDefaults.standard.stringArray(forKey: OdoLogGroup.dashboardWidgetsKey) ?? DashboardWidget.allCases.map(\.rawValue)
        if UserDefaults.standard.object(forKey: "odolog.strictOdoChecks") != nil {
            strictOdoChecks = UserDefaults.standard.bool(forKey: "odolog.strictOdoChecks")
        } else {
            strictOdoChecks = true
        }
        if let raw = UserDefaults.standard.string(forKey: "odolog.defaultVehicleId") {
            defaultVehicleId = UUID(uuidString: raw)
        } else {
            defaultVehicleId = nil
        }
        hideSyncGaragePrompt = UserDefaults.standard.bool(forKey: "odolog.hideSyncGaragePrompt")
    }

    func resetToDefaults() {
        appearance = .light
        accent = .coral
        customAccentHex = "#E85C41"
        liquidGlass = false
        remindersEnabled = false
        replaceVehicleLogsOnImport = false
        dashboardWidgetRaw = DashboardWidget.allCases.map(\.rawValue)
        strictOdoChecks = true
        defaultVehicleId = nil
        hideSyncGaragePrompt = false
    }
}

struct DashBackdrop: View {
    @Environment(AppSettings.self) private var settings
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        ZStack {
            settings.canvasColor(for: scheme)
            if !settings.usesAmoled {
                Circle()
                    .fill(settings.accentColor.opacity(scheme == .dark ? 0.22 : 0.14))
                    .frame(width: 280)
                    .blur(radius: 80)
                    .offset(x: 140, y: -260)
                Circle()
                    .fill(settings.accentTertiary.opacity(scheme == .dark ? 0.16 : 0.18))
                    .frame(width: 240)
                    .blur(radius: 70)
                    .offset(x: -160, y: 320)
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}

typealias MaterialYouBackdrop = DashBackdrop

extension View {
    @ViewBuilder
    func odoGlass(
        cornerRadius: CGFloat = 28,
        tint: Color? = nil,
        interactive: Bool = false,
        enabled: Bool = true
    ) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        if #available(iOS 26.0, *), enabled {
            if interactive {
                if let tint {
                    self.glassEffect(.regular.tint(tint).interactive(), in: shape)
                } else {
                    self.glassEffect(.regular.interactive(), in: shape)
                }
            } else if let tint {
                self.glassEffect(.regular.tint(tint), in: shape)
            } else {
                self.glassEffect(.regular, in: shape)
            }
        } else {
            self.background(.ultraThinMaterial, in: shape)
        }
    }

    func dashShadow() -> some View {
        modifier(DashShadowModifier())
    }

    @ViewBuilder
    func applyAmoledTabBar(_ enabled: Bool) -> some View {
        if enabled {
            self.toolbarBackground(.visible, for: .tabBar)
                .toolbarBackground(Color.black, for: .tabBar)
        } else {
            self
        }
    }
}

private struct DashShadowModifier: ViewModifier {
    @Environment(AppSettings.self) private var settings

    func body(content: Content) -> some View {
        if settings.usesAmoled {
            content
        } else {
            content.shadow(color: Color.black.opacity(0.07), radius: 18, x: 0, y: 10)
        }
    }
}

struct DashCard<Content: View>: View {
    var padding: CGFloat = 20
    var radius: CGFloat = 28
    @ViewBuilder var content: () -> Content
    @Environment(\.colorScheme) private var scheme
    @Environment(AppSettings.self) private var settings

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        content()
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                shape.fill(settings.cardColor(for: scheme))
            }
            .clipShape(shape)
            .dashShadow()
    }
}

typealias GlassCard = DashCard

struct InsightBanner: View {
    var title: String
    var message: String
    var systemImage: String = "lightbulb.fill"
    var tint: Color
    var tone: Tone = .info

    enum Tone { case info, caution }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(tone == .caution ? Color.orange : tint)
                .frame(width: 28, height: 28)
                .background(
                    (tone == .caution ? Color.orange : tint).opacity(0.14),
                    in: Circle()
                )
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(
            (tone == .caution ? Color.orange : tint).opacity(0.08),
            in: RoundedRectangle(cornerRadius: 18, style: .continuous)
        )
        .accessibilityElement(children: .combine)
    }
}

struct StatTile: View {
    let title: String
    let value: String
    var caption: String? = nil
    let tint: Color
    @Environment(\.colorScheme) private var scheme
    @Environment(AppSettings.self) private var settings

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Circle()
                    .fill(tint.gradient)
                    .frame(width: 8, height: 8)
            }
            Text(value)
                .font(.title2.weight(.bold))
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            if let caption {
                Text(caption)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(settings.cardColor(for: scheme))
                .overlay(alignment: .top) {
                    LinearGradient(
                        colors: [tint.opacity(0.18), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 36)
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                }
        }
        .dashShadow()
        .accessibilityElement(children: .combine)
    }
}

struct OdoChip: View {
    let title: String
    let selected: Bool
    var action: () -> Void
    @Environment(AppSettings.self) private var settings

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(
                    selected ? settings.accentColor : Color.primary.opacity(0.06),
                    in: Capsule()
                )
                .foregroundStyle(selected ? Color.white : Color.primary)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

struct OdoPrimaryButton: View {
    let title: String
    var systemImage: String = "arrow.right"
    var compact: Bool = false
    var action: () -> Void
    @Environment(AppSettings.self) private var settings

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text(title)
                    .font(compact ? .subheadline.weight(.semibold) : .headline)
                Image(systemName: systemImage)
                    .font(compact ? .subheadline.weight(.semibold) : .headline)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, compact ? 14 : 18)
            .padding(.vertical, compact ? 10 : 14)
            .background(settings.accentColor, in: Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct RingProgress: View {
    var progress: Double
    var value: String
    var caption: String
    var tint: Color

    var body: some View {
        ZStack {
            Circle()
                .stroke(tint.opacity(0.14), lineWidth: 12)
            Circle()
                .trim(from: 0, to: min(1, max(0, progress)))
                .stroke(tint, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 2) {
                Text(value)
                    .font(.title3.weight(.bold))
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                Text(caption)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            .padding(12)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(caption) \(value)")
    }
}

struct NestedArcs: View {
    var slices: [(ratio: Double, color: Color)]

    var body: some View {
        ZStack {
            ForEach(Array(slices.enumerated()), id: \.offset) { index, slice in
                let inset = CGFloat(index) * 16
                Circle()
                    .trim(from: 0.52, to: 0.52 + 0.48 * min(1, max(0, slice.ratio)))
                    .stroke(slice.color.opacity(0.22 + Double(index) * 0.12), style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .rotationEffect(.degrees(180))
                    .padding(inset)
            }
        }
        .accessibilityHidden(true)
    }
}

struct ActivityDots: View {
    var days: [Bool]
    var tint: Color

    var body: some View {
        HStack(spacing: 6) {
            ForEach(Array(days.enumerated()), id: \.offset) { _, filled in
                Circle()
                    .fill(filled ? tint : tint.opacity(0.16))
                    .frame(width: 10, height: 10)
            }
        }
        .accessibilityLabel("Logged fuel on \(days.filter { $0 }.count) of the last \(days.count) days")
    }
}

struct UserAvatar: View {
    var name: String?
    var size: CGFloat = 44
    var tint: Color = OdoPalette.terracotta
    var photoStamp: TimeInterval = 0

    var body: some View {
        let _ = photoStamp
        Group {
            if let image = ProfilePhoto.image() {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Text(initials)
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(tint)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityLabel(name ?? "Profile photo")
    }

    private var initials: String {
        let parts = (name ?? "You").split(separator: " ")
        return parts.prefix(2).compactMap { $0.first.map(String.init) }.joined().uppercased()
    }
}

struct VehicleAvatar: View {
    let vehicle: Vehicle
    var size: CGFloat = 40

    var body: some View {
        Image(systemName: vehicle.icon.systemImage)
            .font(.system(size: size * 0.38, weight: .semibold))
            .foregroundStyle(OdoPalette.ink)
            .frame(width: size, height: size)
            .background(OdoPalette.accent(for: vehicle.id), in: Circle())
    }
}

struct VehicleHeroCard: View {
    let vehicle: Vehicle
    var spend: String
    var onLogFuel: (() -> Void)?
    var onOpen: (() -> Void)?
    var isOnReserve = false
    var onToggleReserve: (() -> Void)?
    @Environment(AppSettings.self) private var settings

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Image(systemName: vehicle.icon.systemImage)
                    .font(.title3.weight(.semibold))
                Text(vehicle.fuelType.title.uppercased())
                    .font(.caption.weight(.bold))
                    .tracking(0.8)
                Spacer()
                Text(spend)
                    .font(.subheadline.weight(.semibold))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(vehicle.displayName)
                    .font(.title2.weight(.bold))
                Text(vehicle.regNumber?.isEmpty == false ? vehicle.regNumber! : "No registration yet")
                    .font(.subheadline.weight(.medium).monospaced())
                    .opacity(0.85)
                Text("Reserve active")
                    .font(.caption.weight(.semibold))
                    .opacity(isOnReserve ? 0.85 : 0)
                    .accessibilityHidden(!isOnReserve)
            }
            HStack(spacing: 10) {
                if let onLogFuel {
                    Button(action: onLogFuel) {
                        Label("Log fuel", systemImage: "fuelpump.fill")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(.white.opacity(0.2), in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
                if let onOpen {
                    Button(action: onOpen) {
                        Label("Details", systemImage: "arrow.right")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(.white.opacity(0.2), in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
                if let onToggleReserve {
                    Button(action: onToggleReserve) {
                        Label(isOnReserve ? "Main tank" : "On reserve", systemImage: "exclamationmark.fuelpump")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(.white.opacity(0.2), in: Capsule())
                            .animation(.easeInOut(duration: 0.2), value: isOnReserve)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .foregroundStyle(.white)
        .padding(22)
        .frame(maxWidth: .infinity, minHeight: 220, maxHeight: 220, alignment: .leading)
        .background(
            LinearGradient(
                colors: [settings.accentColor, settings.accentColor.mixed(with: OdoPalette.terracottaDeep)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 32, style: .continuous)
        )
        .dashShadow()
        .accessibilityElement(children: .contain)
    }
}

extension Color {
    init?(hex: String) {
        var cleaned = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if cleaned.hasPrefix("#") { cleaned.removeFirst() }
        guard cleaned.count == 6, let value = UInt64(cleaned, radix: 16) else { return nil }
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }

    var hexRGB: String {
        let ui = UIColor(self)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        guard ui.getRed(&r, green: &g, blue: &b, alpha: &a) else { return "#E85C41" }
        return String(format: "#%02X%02X%02X", Int(r * 255), Int(g * 255), Int(b * 255))
    }

    func harmonizingTertiary() -> Color {
        let ui = UIColor(self)
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        guard ui.getHue(&h, saturation: &s, brightness: &b, alpha: &a) else {
            return Color(red: 0.98, green: 0.72, blue: 0.52)
        }
        let shifted = fmod(h + 0.12, 1)
        return Color(hue: shifted, saturation: min(s * 0.85 + 0.1, 1), brightness: min(b * 1.05, 1))
    }

    /// Blend toward another colour for softer hero gradients.
    func mixed(with other: Color, amount: Double = 0.45) -> Color {
        let a = UIColor(self)
        let b = UIColor(other)
        var r1: CGFloat = 0, g1: CGFloat = 0, b1: CGFloat = 0, a1: CGFloat = 0
        var r2: CGFloat = 0, g2: CGFloat = 0, b2: CGFloat = 0, a2: CGFloat = 0
        a.getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        b.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        let t = CGFloat(min(1, max(0, amount)))
        return Color(
            red: Double(r1 + (r2 - r1) * t),
            green: Double(g1 + (g2 - g1) * t),
            blue: Double(b1 + (b2 - b1) * t)
        )
    }
}
