import Foundation

enum AuthCallback {
    static let scheme = "odolog"
    static let redirectURL = URL(string: "odolog://auth-callback")!
}
