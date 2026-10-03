import Foundation
import SwiftData
import Testing
@testable import OdoLog

@Suite(.serialized)
@MainActor
struct ReserveRuleTests {
    @Test(arguments: [99, 100, 101, 150, 999, 1_000, 5_000, 25_000])
    func `Reserve threshold uses ₹100`(amount: Double) async throws {
        let fixture = try await makeFixture()
        fixture.store.markReserve(for: fixture.vehicle.id, at: 1_000)

        try await addRefuel(amount: amount, odo: 1_050, to: fixture)

        #expect((fixture.store.reserveOdo(for: fixture.vehicle.id) == nil) == (amount >= 100))
        if amount >= 100 {
            #expect(fixture.store.reserveEvents(for: fixture.vehicle.id).contains {
                $0.action == .entered && $0.odoKm == 1_000
            })
        }
    }

    @Test(arguments: [0.99, 1, 1.5])
    func `Litres-only refuel uses city rate`(litres: Double) async throws {
        let fixture = try await makeFixture()
        fixture.store.markReserve(for: fixture.vehicle.id, at: 1_000)

        try await addRefuel(amount: 0, rate: 100, litres: litres, odo: 1_050, to: fixture)

        #expect((fixture.store.reserveOdo(for: fixture.vehicle.id) == nil) == (litres >= 1))
    }

    @Test
    func `Litres-only refuel without a rate clears reserve and keeps amount missing`() async throws {
        let fixture = try await makeFixture()
        fixture.store.markReserve(for: fixture.vehicle.id, at: 1_000)

        try await addRefuel(amount: 0, rate: 0, litres: 1, odo: 1_050, to: fixture)

        #expect(fixture.store.reserveOdo(for: fixture.vehicle.id) == nil)
        #expect(fixture.store.refuels(for: fixture.vehicle.id).first?.amountInr == 0)
    }

    @Test
    func `Bike not on reserve is unaffected`() async throws {
        let fixture = try await makeFixture()

        try await addRefuel(amount: 500, odo: 1_050, to: fixture)

        #expect(fixture.store.reserveOdo(for: fixture.vehicle.id) == nil)
        #expect(fixture.store.reserveEvents(for: fixture.vehicle.id).isEmpty)
    }

    @Test
    func `Editing newest refuel to ₹100 returns to main tank`() async throws {
        let fixture = try await makeFixture()
        fixture.store.markReserve(for: fixture.vehicle.id, at: 1_000)
        try await addRefuel(amount: 99, odo: 1_050, to: fixture)
        let newest = try #require(fixture.store.refuels(for: fixture.vehicle.id).first)

        try await updateRefuel(newest, amount: 100, in: fixture)

        #expect(fixture.store.reserveOdo(for: fixture.vehicle.id) == nil)
        #expect(fixture.store.reserveEvents(for: fixture.vehicle.id).contains {
            $0.action == .entered && $0.odoKm == 1_000
        })
    }

    @Test
    func `Editing older refuel does not change reserve state`() async throws {
        let fixture = try await makeFixture()
        let defaults = UserDefaults.standard
        let previousStrictSetting = defaults.object(forKey: "odolog.strictOdoChecks")
        defaults.set(false, forKey: "odolog.strictOdoChecks")
        defer {
            if let previousStrictSetting {
                defaults.set(previousStrictSetting, forKey: "odolog.strictOdoChecks")
            } else {
                defaults.removeObject(forKey: "odolog.strictOdoChecks")
            }
        }

        fixture.store.markReserve(for: fixture.vehicle.id, at: 1_000)
        try await addRefuel(amount: 99, odo: 1_050, date: Date(timeIntervalSince1970: 1_000), to: fixture)
        try await addRefuel(amount: 99, odo: 1_100, date: Date(timeIntervalSince1970: 2_000), to: fixture)
        let older = try #require(fixture.store.refuels(for: fixture.vehicle.id).last)

        try await updateRefuel(older, amount: 500, in: fixture)

        #expect(fixture.store.reserveOdo(for: fixture.vehicle.id) == 1_000)
    }

    @Test
    func autoReturnThenNextReserveStretchProducesMileage() async throws {
        let fixture = try await makeFixture()
        let day1 = Date(timeIntervalSince1970: 1_700_000_000)
        let day2 = day1.addingTimeInterval(86_400)
        let day3 = day2.addingTimeInterval(86_400)
        fixture.store.markReserve(for: fixture.vehicle.id, at: 1_000, date: day1)
        try await addRefuel(amount: 200, odo: 1_040, date: day1, to: fixture)
        fixture.store.markReserve(for: fixture.vehicle.id, at: 1_080, date: day2)
        try await addRefuel(amount: 200, odo: 1_120, date: day2, to: fixture)
        fixture.store.markReserve(for: fixture.vehicle.id, at: 1_160, date: day3)

        let result = fixture.store.mileageResult(for: fixture.vehicle.id)

        #expect(result.validSegments.count == 2)
        #expect(result.kmpl == 40)
    }

    private func makeFixture() async throws -> Fixture {
        let schema = Schema([
            LocalVehicle.self,
            LocalRefuel.self,
            LocalMaintenance.self,
            LocalTrip.self,
        ])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
        let container = try ModelContainer(for: schema, configurations: [configuration])
        let store = OdoLogStore()
        store.attach(modelContext: container.mainContext)
        let vehicle = try await store.addVehicle(
            name: "Test Bike",
            fuelType: .petrol,
            icon: .bike,
            make: nil,
            modelYear: nil,
            regNumber: nil,
            isGuest: true,
            ownerName: nil,
            hasReserve: true,
            reserveLitres: 2,
            claimedMileageKmpl: 40
        )
        return Fixture(store: store, vehicle: vehicle, container: container)
    }

    private func addRefuel(
        amount: Double,
        rate: Double = 100,
        litres: Double? = nil,
        odo: Double,
        date: Date = .now,
        to fixture: Fixture
    ) async throws {
        try await fixture.store.addRefuel(
            vehicleId: fixture.vehicle.id,
            date: date,
            amount: amount,
            rate: rate,
            litres: litres ?? (rate > 0 ? amount / rate : 0),
            odoKm: odo,
            fullTank: false,
            notes: nil,
            fuelSubtype: .normal,
            fuelBrand: nil,
            tankState: .reserve
        )
    }

    private func updateRefuel(
        _ refuel: Refuel,
        amount: Double,
        in fixture: Fixture
    ) async throws {
        try await fixture.store.updateRefuel(
            refuel.id,
            vehicleId: fixture.vehicle.id,
            date: Format.date(fromYMD: refuel.refuelDate) ?? .now,
            amount: amount,
            rate: 100,
            litres: amount / 100,
            odoKm: refuel.odoKm,
            fullTank: refuel.fullTank,
            notes: refuel.notes,
            fuelSubtype: refuel.fuelSubtype,
            fuelBrand: refuel.fuelBrand.flatMap(FuelBrand.init(rawValue:)),
            tankState: refuel.tankState
        )
    }
}

@Suite
struct MileageCalculatorTests {
    @Test func currentSnapshotMatchesExtractedCalculation() {
        let fills = [fill(0, odo: 1_000, litres: 2, full: true), fill(1, odo: 1_100, litres: 2, full: true), fill(2, odo: 1_200, litres: 2, full: true), fill(3, odo: 1_300, litres: 2, full: true)]
        let legacy = zip(fills, fills.dropFirst()).map { ($1.odoKm! - $0.odoKm!) / $1.litres }
        let result = MileageCalculator.calculate(.init(mode: .fullFill, claimedKmpl: nil, fills: fills))
        #expect(result.validSegments.map(\.kmpl) == legacy)
        #expect(result.kmpl == 50)
    }

    @Test func normalFullFillsUseWeightedTotals() {
        let result = MileageCalculator.calculate(.init(mode: .fullFill, claimedKmpl: 50, fills: [
            fill(0, odo: 1_000, litres: 1, full: true), fill(1, odo: 1_100, litres: 2, full: true),
            fill(2, odo: 1_250, litres: 3, full: true), fill(3, odo: 1_450, litres: 5, full: true),
        ]))
        #expect(result.kmpl == 45)
        #expect(result.validSegments.count == 3)
    }

    @Test func severalRefuelsAreSummedWithinReserveStretch() {
        let result = MileageCalculator.calculate(.init(mode: .reserve, claimedKmpl: 40, fills: [
            fill(1, odo: 1_040, litres: 1, full: false), fill(2, odo: 1_080, litres: 2, full: false),
            fill(4, odo: 1_180, litres: 2, full: false), fill(5, odo: 1_220, litres: 1, full: false),
        ], reservePoints: [point(0, odo: 1_000), point(3, odo: 1_120), point(6, odo: 1_240)]))
        #expect(result.validSegments.map(\.litres) == [3, 3])
        #expect(result.kmpl == 40)
    }

    @Test func badOdometerIsDropped() {
        let result = MileageCalculator.calculate(.init(mode: .reserve, claimedKmpl: 40, fills: [
            fill(1, odo: 990, litres: 2, full: false),
        ], reservePoints: [point(0, odo: 1_000), point(2, odo: 990)]))
        #expect(result.kmpl == nil)
        #expect(result.droppedSegments.first?.reason == .nonPositiveDistance)
    }

    @Test func seventySevenPointSixOutlierIsDropped() {
        let result = MileageCalculator.calculate(.init(mode: .reserve, claimedKmpl: 30, fills: [
            fill(1, odo: 1_077.6, litres: 1, full: false),
        ], reservePoints: [point(0, odo: 1_000), point(2, odo: 1_077.6)]))
        #expect(result.kmpl == nil)
        guard case .implausibleMileage(let actual, _, _)? = result.droppedSegments.first?.reason else {
            Issue.record("Expected an implausible mileage reason")
            return
        }
        #expect(abs(actual - 77.6) < 0.000_001)
    }

    @Test func tooLittleDataReturnsNilForBothModes() {
        let reserve = MileageCalculator.calculate(.init(mode: .reserve, claimedKmpl: 40, fills: [
            fill(1, odo: 1_080, litres: 2, full: false),
        ], reservePoints: [point(0, odo: 1_000), point(2, odo: 1_080)]))
        let regular = MileageCalculator.calculate(.init(mode: .fullFill, claimedKmpl: 40, fills: [
            fill(0, odo: 1_000, litres: 2, full: true), fill(1, odo: 1_080, litres: 2, full: true),
            fill(2, odo: 1_160, litres: 2, full: true),
        ]))
        #expect(reserve.kmpl == nil)
        #expect(regular.kmpl == nil)
    }

    @Test func amountAndRateReplaceMissingLitres() {
        let result = MileageCalculator.calculate(.init(mode: .reserve, claimedKmpl: 50, fills: [
            fill(1, odo: 1_100, litres: 0, amount: 200, rate: 100, full: false),
            fill(3, odo: 1_200, litres: 0, amount: 200, rate: 100, full: false),
        ], reservePoints: [point(0, odo: 1_000), point(2, odo: 1_100), point(4, odo: 1_200)]))
        #expect(result.kmpl == 50)
    }

    @Test func editedChainIsDroppedWithReason() {
        let result = MileageCalculator.calculate(.init(mode: .fullFill, claimedKmpl: 40, fills: [
            fill(0, odo: 1_000, litres: 2, full: true),
            fill(1, odo: 1_080, litres: 2, full: true, edited: true),
        ]))
        #expect(result.droppedSegments.first?.reason == .editedOrDeletedLog)
    }

    @Test func deletedChainIsDroppedWithReason() {
        let result = MileageCalculator.calculate(.init(mode: .fullFill, claimedKmpl: 40, fills: [
            fill(0, odo: 1_000, litres: 2, full: true),
            fill(2, odo: 1_080, litres: 2, full: true),
        ], chainBreaks: [
            .init(moment: .init(date: "2026-01-01", createdAt: base.addingTimeInterval(1))),
        ]))
        #expect(result.droppedSegments.first?.reason == .editedOrDeletedLog)
    }

    private let base = Date(timeIntervalSince1970: 1_700_000_000)

    private func fill(_ offset: TimeInterval, odo: Double, litres: Double, amount: Double = 0, rate: Double = 0, full: Bool, edited: Bool = false) -> MileageCalculator.Fill {
        MileageCalculator.Fill(date: "2026-01-01", createdAt: base.addingTimeInterval(offset), odoKm: odo, litres: litres, amount: amount, rate: rate, isFull: full, wasEdited: edited)
    }

    private func point(_ offset: TimeInterval, odo: Double) -> MileageCalculator.ReservePoint {
        MileageCalculator.ReservePoint(date: "2026-01-01", createdAt: base.addingTimeInterval(offset), odoKm: odo)
    }
}

@Suite
struct RefreshCancellationTests {
    @Test
    func cancellationErrorIsIgnored() {
        #expect(RefreshError.isCancellation(CancellationError()))
    }

    @Test
    func cancelledURLRequestIsIgnored() {
        #expect(RefreshError.isCancellation(URLError(.cancelled)))
    }

    @Test
    func wrappedCancelledURLRequestIsIgnored() {
        let wrapped = NSError(
            domain: "RefreshTest",
            code: 1,
            userInfo: [NSUnderlyingErrorKey: URLError(.cancelled)]
        )
        #expect(RefreshError.isCancellation(wrapped))
    }

    @Test
    func realNetworkFailureIsNotIgnored() {
        #expect(!RefreshError.isCancellation(URLError(.notConnectedToInternet)))
    }
}

@Suite
struct FuelEntryCheckerTests {
    @Test
    func fallbackFlagsOdometerTypo() async {
        let result = await FuelEntryChecker.check(
            .init(
                odometer: 9_000,
                previousOdometer: 10_000,
                amount: 500,
                litres: 5,
                expectedRate: 100
            ),
            useOnDeviceModel: false
        )

        #expect(result.reason == "The odometer is not higher than the last reading.")
    }

    @Test
    func fallbackFlagsLitresThatDoNotFitAmount() async {
        let result = await FuelEntryChecker.check(
            .init(
                odometer: 10_100,
                previousOdometer: 10_000,
                amount: 500,
                litres: 10,
                expectedRate: 100
            ),
            useOnDeviceModel: false
        )

        #expect(result.reason == "The litres do not fit the amount and fuel rate.")
    }

    @Test
    func fallbackLeavesPlausibleEntryUnflagged() async {
        let result = await FuelEntryChecker.check(
            .init(
                odometer: 10_100,
                previousOdometer: 10_000,
                amount: 500,
                litres: 5,
                expectedRate: 100
            ),
            useOnDeviceModel: false
        )

        #expect(!result.isSuspicious)
    }
}

@MainActor
private struct Fixture {
    let store: OdoLogStore
    let vehicle: Vehicle
    let container: ModelContainer
}
