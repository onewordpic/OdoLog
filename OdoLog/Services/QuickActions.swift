import Foundation
import UIKit
import UserNotifications

enum QuickActionType: String {
    case logFuel = "safwan.odolog.quickaction.logfuel"
}

/// Home Screen long-press quick actions only — intentionally not WidgetKit.
@Observable
final class QuickActionsRouter {
    static let shared = QuickActionsRouter()

    private(set) var pendingLogFuel = false

    @MainActor
    func requestLogFuel() {
        pendingLogFuel = true
    }

    @MainActor
    func consumeLogFuel() -> Bool {
        guard pendingLogFuel else { return false }
        pendingLogFuel = false
        return true
    }

    @MainActor
    @discardableResult
    func handle(shortcutItem: UIApplicationShortcutItem) -> Bool {
        switch QuickActionType(rawValue: shortcutItem.type) {
        case .logFuel:
            requestLogFuel()
            return true
        case .none:
            return false
        }
    }

    @MainActor
    func refreshShortcutItems(subtitle: String?) {
        let item = UIApplicationShortcutItem(
            type: QuickActionType.logFuel.rawValue,
            localizedTitle: "Log fuel",
            localizedSubtitle: subtitle,
            icon: UIApplicationShortcutIcon(systemImageName: "fuelpump.fill"),
            userInfo: nil
        )
        UIApplication.shared.shortcutItems = [item]
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Task { @MainActor in
            QuickActionsRouter.shared.refreshShortcutItems(subtitle: nil)
        }
        return true
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        if let shortcut = options.shortcutItem {
            Task { @MainActor in
                QuickActionsRouter.shared.handle(shortcutItem: shortcut)
            }
        }
        return UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
    }

    func application(
        _ application: UIApplication,
        performActionFor shortcutItem: UIApplicationShortcutItem,
        completionHandler: @escaping (Bool) -> Void
    ) {
        Task { @MainActor in
            completionHandler(QuickActionsRouter.shared.handle(shortcutItem: shortcutItem))
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .list])
    }
}
