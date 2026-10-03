import SwiftUI

struct AuthView: View {
    @Environment(OdoLogStore.self) private var store
    @Environment(AppSettings.self) private var settings
    @Environment(\.dismiss) private var dismiss

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var isWorking = false
    @State private var errorText: String?

    enum Mode {
        case signIn, signUp
        var title: String { self == .signIn ? "Sign in" : "Create account" }
        var action: String { self == .signIn ? "Sign in" : "Create account" }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Welcome")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text("Sync this garage, or keep it on this iPhone.")
                        .font(.title2.weight(.bold))
                        .fixedSize(horizontal: false, vertical: true)
                }

                DashCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Google")
                            .font(.headline)
                        Text("Uses your odolog.online account so vehicles and fills follow you.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Button {
                            Task { await oauth { try await store.signInWithGoogle() } }
                        } label: {
                            Label("Continue with Google", systemImage: "globe")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .foregroundStyle(.white)
                                .background(settings.accentColor, in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(isWorking)
                        .accessibilityHint("Opens Google sign-in in a secure browser sheet")
                    }
                }

                DashCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Guest")
                            .font(.headline)
                        Text("Stays on this iPhone until you sign in — then it uploads to your account automatically.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Button { dismiss() } label: {
                            Label("Continue as guest", systemImage: "iphone")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(Color.primary.opacity(0.06), in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .accessibilityHint("Closes this screen and keeps logs on this device")
                    }
                }

                DashCard {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Email")
                            .font(.headline)
                        HStack(spacing: 8) {
                            OdoChip(title: "Sign in", selected: mode == .signIn) { mode = .signIn }
                            OdoChip(title: "Create account", selected: mode == .signUp) { mode = .signUp }
                        }
                        .accessibilityElement(children: .contain)
                        .accessibilityLabel("Email account mode")

                        if mode == .signUp {
                            TextField("Name", text: $name)
                                .textContentType(.name)
                                .padding(12)
                                .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        TextField("Email", text: $email)
                            .textContentType(.username)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(12)
                            .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        SecureField("Password", text: $password)
                            .textContentType(mode == .signUp ? .newPassword : .password)
                            .padding(12)
                            .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 14, style: .continuous))

                        Button {
                            Task { await submitEmail() }
                        } label: {
                            Group {
                                if isWorking {
                                    ProgressView()
                                } else {
                                    Text(mode.action).font(.headline)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .foregroundStyle(.white)
                            .background(settings.accentColor.opacity(canSubmitEmail ? 1 : 0.4), in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(!canSubmitEmail || isWorking)
                    }
                }

                if let errorText {
                    DashCard {
                        Text(errorText)
                            .font(.subheadline)
                            .foregroundStyle(.red)
                    }
                }
            }
            .padding(16)
        }
        .background { DashBackdrop() }
        .fontDesign(.rounded)
        .navigationTitle("Account")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close") { dismiss() }
            }
        }
        .disabled(isWorking)
    }

    private var canSubmitEmail: Bool {
        !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && password.count >= 6
    }

    private func oauth(_ work: () async throws -> Void) async {
        isWorking = true
        errorText = nil
        defer { isWorking = false }
        do {
            try await work()
            dismiss()
        } catch {
            errorText = friendly(error)
        }
    }

    private func submitEmail() async {
        await oauth {
            if mode == .signIn {
                try await store.signIn(
                    email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                    password: password
                )
            } else {
                try await store.signUp(
                    email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                    password: password,
                    name: name.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            }
        }
    }

    private func friendly(_ error: Error) -> String {
        let text = error.localizedDescription
        if text.localizedCaseInsensitiveContains("missing OAuth secret")
            || text.localizedCaseInsensitiveContains("oauth secret") {
            return "Google sign-in isn’t fully set up on the server. In Supabase → Authentication → Providers → Google, paste both Client ID and Client Secret from Google Cloud, then save."
        }
        if text.localizedCaseInsensitiveContains("provider") || text.localizedCaseInsensitiveContains("unsupported") {
            return "Enable Google in Supabase Auth → Providers, add Client ID + Client Secret, and allow redirect odolog://auth-callback."
        }
        return text
    }
}
