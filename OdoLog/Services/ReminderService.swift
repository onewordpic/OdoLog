import Foundation
import UserNotifications

enum ReminderService {
    private static let prefix = "odolog.reminder."
    private static let notifiedKey = "odolog.reminder.notified."

    static func requestAuthorization() async -> Bool {
        do {
            return try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            return false
        }
    }

    static func authorizationStatus() async -> UNAuthorizationStatus {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    @MainActor
    static func reschedule(using store: OdoLogStore, enabled: Bool) async {
        await cancelAll()
        guard enabled else { return }
        let status = await authorizationStatus()
        guard status == .authorized || status == .provisional else { return }

        for vehicle in store.vehicles {
            await scheduleServiceReminders(for: vehicle, store: store)
            await scheduleReserveReminder(for: vehicle, store: store)
        }
    }

    private static func cancelAll() async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
        let ours = pending.map(\.identifier).filter { $0.hasPrefix(prefix) }
        center.removePendingNotificationRequests(withIdentifiers: ours)
        let delivered = await center.deliveredNotifications()
        let deliveredOurs = delivered.map(\.request.identifier).filter { $0.hasPrefix(prefix) }
        center.removeDeliveredNotifications(withIdentifiers: deliveredOurs)
    }

    @MainActor
    private static func scheduleServiceReminders(for vehicle: Vehicle, store: OdoLogStore) async {
        let logs = store.maintenance(for: vehicle.id)
        guard let latest = logs.first(where: {
            $0.nextServiceDate != nil || ($0.nextServiceOdoKm ?? 0) > 0
        }) else { return }

        let name = vehicle.displayName

        if let ymd = latest.nextServiceDate, let due = Format.date(fromYMD: ymd) {
            let cal = Calendar.current
            let startOfDue = cal.startOfDay(for: due)
            // 7 days, 3 days, 1 day before, and day-of at 09:00
            for offset in [7, 3, 1, 0] {
                guard let fireDay = cal.date(byAdding: .day, value: -offset, to: startOfDue) else { continue }
                var comps = cal.dateComponents([.year, .month, .day], from: fireDay)
                comps.hour = 9
                comps.minute = 0
                guard let fire = cal.date(from: comps), fire > Date().addingTimeInterval(-60) else { continue }
                let id = "\(prefix)service.date.\(vehicle.id.uuidString).\(offset)"
                let content = UNMutableNotificationContent()
                switch offset {
                case 0:
                    content.title = "Service due today"
                    content.body = "\(name) is due for \(latest.serviceType) today."
                case 1:
                    content.title = "Service tomorrow"
                    content.body = "\(name) needs \(latest.serviceType) tomorrow."
                default:
                    content.title = "Service coming up"
                    content.body = "\(name) needs \(latest.serviceType) in \(offset) days."
                }
                content.sound = .default
                let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
                try? await UNUserNotificationCenter.current()
                    .add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
            }
        }

        if let nextOdo = latest.nextServiceOdoKm, nextOdo > 0 {
            let last = store.lastOdo(for: vehicle.id) ?? 0
            let remaining = nextOdo - last
            guard remaining <= 300 else { return }
            let dayKey = Format.ymd(.now)
            let stampKey = notifiedKey + "odo.\(vehicle.id.uuidString)"
            if UserDefaults.standard.string(forKey: stampKey) == dayKey { return }
            let id = "\(prefix)service.odo.\(vehicle.id.uuidString).\(dayKey)"
            let content = UNMutableNotificationContent()
            if remaining <= 0 {
                content.title = "Service overdue"
                content.body = "\(name) has passed the \(Format.km(nextOdo)) service mark."
            } else if remaining <= 50 {
                content.title = "Service almost due"
                content.body = "\(name) has about \(Format.km(remaining)) left until \(latest.serviceType)."
            } else {
                content.title = "Service approaching"
                content.body = "\(name) has about \(Format.km(remaining)) until the next \(latest.serviceType)."
            }
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 2, repeats: false)
            try? await UNUserNotificationCenter.current()
                .add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
            UserDefaults.standard.set(dayKey, forKey: stampKey)
        }
    }

    @MainActor
    private static func scheduleReserveReminder(for vehicle: Vehicle, store: OdoLogStore) async {
        guard let marked = store.reserveOdo(for: vehicle.id) else { return }
        let name = vehicle.displayName
        // Avoid mileageSegments here — notifications must stay cheap on the main actor.
        let roughKmpl = vehicle.resolvedClaimedKmpl
            ?? vehicle.fuelType.fallbackKmpl
        let detailBody: String
        if let litres = vehicle.reserveLitres, litres > 0, roughKmpl > 0 {
            let rangeKm = litres * roughKmpl
            let current = max(store.lastOdo(for: vehicle.id) ?? marked, marked)
            let emptyOdo = marked + rangeKm
            let suggested = floor((marked + rangeKm * 0.75) / 10) * 10
            let kmLeft = max(0, emptyOdo - current)
            if kmLeft <= rangeKm * 0.10 {
                detailBody = "\(name) has ~\(Format.km(kmLeft)) left on reserve — find a pump now."
            } else if current >= suggested {
                detailBody = "\(name) should refuel by \(Format.km(suggested)) (~\(Format.km(kmLeft)) left)."
            } else {
                detailBody = "\(name) has ~\(Format.km(kmLeft)) left on reserve. Refuel by \(Format.km(suggested))."
            }
        } else {
            detailBody = "\(name) has been on reserve since \(Format.km(marked)). Plan a fill-up."
        }

        let dayKey = Format.ymd(.now)
        let stampKey = notifiedKey + "reserve.once.\(vehicle.id.uuidString)"
        if UserDefaults.standard.string(forKey: stampKey) != dayKey {
            let id = "\(prefix)reserve.once.\(vehicle.id.uuidString).\(dayKey)"
            let content = UNMutableNotificationContent()
            content.title = "On reserve"
            content.body = detailBody
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 3, repeats: false)
            try? await UNUserNotificationCenter.current()
                .add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
            UserDefaults.standard.set(dayKey, forKey: stampKey)
        }

        for hour in [9, 18] {
            let id = "\(prefix)reserve.daily.\(vehicle.id.uuidString).\(hour)"
            let content = UNMutableNotificationContent()
            content.title = "Still on reserve"
            content.body = detailBody
            content.sound = .default
            var comps = DateComponents()
            comps.hour = hour
            comps.minute = 0
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: true)
            try? await UNUserNotificationCenter.current()
                .add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
        }
    }
}
