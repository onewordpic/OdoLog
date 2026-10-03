import SwiftUI

private struct ChangelogRelease: Identifiable {
    var id: String { date }
    var date: String
    var title: String
    var groups: [ChangelogGroup]
}

private struct ChangelogGroup: Identifiable {
    var id: String { title }
    var title: String
    var items: [String]
}

struct ChangelogView: View {
    private let releases: [ChangelogRelease] = [
        ChangelogRelease(
            date: "3 October 2026",
            title: "1.1 — Current version",
            groups: [
                ChangelogGroup(title: "Home", items: [
                    "Switching to reserve now asks for your odometer reading.",
                    "Refuelling ₹100 or more—or updating your latest fill—returns your bike to the main tank automatically.",
                ]),
                ChangelogGroup(title: "Mileage", items: [
                    "Mileage now uses exact distance and litres between reserve points.",
                    "Unusual entries are left out instead of skewing your km/L.",
                    "You can see why an entry was skipped.",
                    "Suspicious fuel entries now get a quick on-device check.",
                ]),
                ChangelogGroup(title: "Siri", items: [
                    "New: say “Log fuel in OdoLog” or “What’s my mileage in OdoLog”.",
                    "Say “Set reserve in OdoLog” to switch a bike to reserve.",
                ]),
                ChangelogGroup(title: "Reliability", items: [
                    "Pull to refresh now updates fills, fuel prices, and weather together.",
                    "It works quietly offline and syncs when you’re back online.",
                ]),
                ChangelogGroup(title: "Fixes", items: [
                    "Fixed: pull to refresh no longer shows a false error.",
                    "Fixed: the screen no longer jumps when you toggle reserve.",
                ]),
            ]
        ),
        ChangelogRelease(
            date: "10 September 2026",
            title: "1.0",
            groups: [
                ChangelogGroup(title: "Home", items: [
                    "Date and greeting sit next to your avatar without a large empty gap.",
                    "Weather (icon and temperature) can appear next to the date when your fuel city is set. If it can’t load, it stays hidden.",
                    "Tap Log fuel to log the last vehicle you filled. Long-press to pick from all your fuel vehicles.",
                    "Sync this garage can be closed with the X. Sign-in stays in Settings.",
                ]),
                ChangelogGroup(title: "Mileage", items: [
                    "Each vehicle can store a claimed km/L (the catalog can fill it in).",
                    "km/L only appears when there’s enough data (reserve bikes: 2 stretches; others: 3 fill-to-fill intervals). Until then it shows Not enough data.",
                ]),
                ChangelogGroup(title: "Look & settings", items: [
                    "AMOLED appearance (true black).",
                    "Logging: default vehicle and strict odometer (blocks a lower reading, offers edit previous fill).",
                    "Advanced: reset selected data (guest = this phone, signed-in = cloud).",
                ]),
                ChangelogGroup(title: "Reliability", items: [
                    "Signed-in mode keeps last data on the phone without Wi-Fi. New fills save locally and sync when you’re back online.",
                    "Fuel rates and weather keep the last good values if the network is down.",
                ]),
                ChangelogGroup(title: "Fixes", items: [
                    "Opening a vehicle from Garage no longer freezes the screen.",
                ]),
            ]
        ),
    ]

    var body: some View {
        List {
            ForEach(releases) { release in
                Section {
                    ForEach(release.groups) { group in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(group.title)
                                .font(.subheadline.weight(.semibold))
                            ForEach(group.items, id: \.self) { item in
                                HStack(alignment: .top, spacing: 8) {
                                    Text("•")
                                        .foregroundStyle(.secondary)
                                    Text(item)
                                        .font(.subheadline)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                } header: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(release.title)
                        Text(release.date)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .textCase(nil)
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .fontDesign(.rounded)
        .navigationTitle("What’s new")
        .navigationBarTitleDisplayMode(.inline)
    }
}
