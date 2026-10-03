import Foundation

struct MileageCalculator {
    enum Mode: Sendable {
        case reserve
        case fullFill
    }

    struct Moment: Comparable, Sendable {
        let date: String
        let createdAt: Date

        static func < (lhs: Moment, rhs: Moment) -> Bool {
            lhs.date == rhs.date ? lhs.createdAt < rhs.createdAt : lhs.date < rhs.date
        }
    }

    struct Fill: Identifiable, Sendable {
        let id: UUID
        let moment: Moment
        let odoKm: Double?
        let litres: Double
        let amount: Double
        let rate: Double
        let isFull: Bool
        let wasEdited: Bool

        init(
            id: UUID = UUID(),
            date: String,
            createdAt: Date,
            odoKm: Double?,
            litres: Double,
            amount: Double = 0,
            rate: Double = 0,
            isFull: Bool,
            wasEdited: Bool = false
        ) {
            self.id = id
            moment = Moment(date: date, createdAt: createdAt)
            self.odoKm = odoKm
            self.litres = litres
            self.amount = amount
            self.rate = rate
            self.isFull = isFull
            self.wasEdited = wasEdited
        }

        var resolvedLitres: Double {
            if litres > 0 { return litres }
            guard amount > 0, rate > 0 else { return 0 }
            return amount / rate
        }
    }

    struct ReservePoint: Identifiable, Sendable {
        let id: UUID
        let moment: Moment
        let odoKm: Double

        init(id: UUID = UUID(), date: String, createdAt: Date, odoKm: Double) {
            self.id = id
            moment = Moment(date: date, createdAt: createdAt)
            self.odoKm = odoKm
        }
    }

    struct ChainBreak: Sendable {
        let moment: Moment
    }

    enum DropReason: Equatable, Sendable {
        case nonPositiveDistance
        case missingFuel
        case editedOrDeletedLog
        case implausibleMileage(actual: Double, expectedLow: Double, expectedHigh: Double)

        var message: String {
            switch self {
            case .nonPositiveDistance:
                "Odometer did not increase."
            case .missingFuel:
                "Fuel quantity is missing."
            case .editedOrDeletedLog:
                "A fill in this stretch was edited or deleted."
            case .implausibleMileage(let actual, let low, let high):
                String(format: "%.1f km/L is outside the expected %.1f–%.1f range.", actual, low, high)
            }
        }
    }

    struct Segment: Identifiable, Sendable {
        let id: UUID
        let date: String
        let km: Double
        let litres: Double

        init(id: UUID = UUID(), date: String, km: Double, litres: Double) {
            self.id = id
            self.date = date
            self.km = km
            self.litres = litres
        }

        var kmpl: Double { km / litres }
    }

    struct DroppedSegment: Identifiable, Sendable {
        let id: UUID
        let segment: Segment
        let reason: DropReason

        init(segment: Segment, reason: DropReason) {
            id = segment.id
            self.segment = segment
            self.reason = reason
        }
    }

    struct Input: Sendable {
        let mode: Mode
        let claimedKmpl: Double?
        let fills: [Fill]
        let reservePoints: [ReservePoint]
        let chainBreaks: [ChainBreak]

        init(
            mode: Mode,
            claimedKmpl: Double?,
            fills: [Fill],
            reservePoints: [ReservePoint] = [],
            chainBreaks: [ChainBreak] = []
        ) {
            self.mode = mode
            self.claimedKmpl = claimedKmpl
            self.fills = fills
            self.reservePoints = reservePoints
            self.chainBreaks = chainBreaks
        }
    }

    struct Result: Sendable {
        let kmpl: Double?
        let validSegments: [Segment]
        let droppedSegments: [DroppedSegment]
    }

    static func calculate(_ input: Input) -> Result {
        let candidates: [(Segment, Bool)]
        let minimum: Int
        switch input.mode {
        case .reserve:
            candidates = reserveCandidates(input)
            minimum = 2
        case .fullFill:
            candidates = fullFillCandidates(input)
            minimum = 3
        }

        var valid: [Segment] = []
        var dropped: [DroppedSegment] = []
        for (segment, broken) in candidates.suffix(8) {
            if segment.km <= 0 {
                dropped.append(DroppedSegment(segment: segment, reason: .nonPositiveDistance))
            } else if segment.litres <= 0 {
                dropped.append(DroppedSegment(segment: segment, reason: .missingFuel))
            } else if broken {
                dropped.append(DroppedSegment(segment: segment, reason: .editedOrDeletedLog))
            } else if let claimed = input.claimedKmpl, claimed > 0,
                      segment.kmpl < claimed * 0.4 || segment.kmpl > claimed * 2 {
                dropped.append(DroppedSegment(
                    segment: segment,
                    reason: .implausibleMileage(
                        actual: segment.kmpl,
                        expectedLow: claimed * 0.4,
                        expectedHigh: claimed * 2
                    )
                ))
            } else {
                valid.append(segment)
            }
        }

        guard valid.count >= minimum else {
            return Result(kmpl: nil, validSegments: valid, droppedSegments: dropped)
        }
        let totalKm = valid.reduce(0) { $0 + $1.km }
        let totalLitres = valid.reduce(0) { $0 + $1.litres }
        let kmpl = totalKm > 0 && totalLitres > 0 ? totalKm / totalLitres : nil
        return Result(kmpl: kmpl, validSegments: valid, droppedSegments: dropped)
    }

    private static func reserveCandidates(_ input: Input) -> [(Segment, Bool)] {
        let points = input.reservePoints.sorted { $0.moment < $1.moment }
        guard points.count >= 2 else { return [] }
        let fills = input.fills.sorted { $0.moment < $1.moment }

        return (1..<points.count).map { index in
            let start = points[index - 1]
            let end = points[index]
            let included = fills.filter { $0.moment > start.moment && $0.moment <= end.moment }
            let litres = included.reduce(0) { $0 + $1.resolvedLitres }
            let broken = included.contains(where: \.wasEdited)
                || input.chainBreaks.contains { $0.moment > start.moment && $0.moment <= end.moment }
            return (Segment(date: end.moment.date, km: end.odoKm - start.odoKm, litres: litres), broken)
        }
    }

    private static func fullFillCandidates(_ input: Input) -> [(Segment, Bool)] {
        let fills = input.fills.sorted { $0.moment < $1.moment }
        let endpoints = fills.filter(\.isFull)
        guard endpoints.count >= 2 else { return [] }

        return (1..<endpoints.count).map { index in
            let start = endpoints[index - 1]
            let end = endpoints[index]
            let included = fills.filter { $0.moment > start.moment && $0.moment <= end.moment }
            let litres = included.reduce(0) { $0 + $1.resolvedLitres }
            let broken = included.contains(where: \.wasEdited)
                || input.chainBreaks.contains { $0.moment > start.moment && $0.moment <= end.moment }
            return (
                Segment(date: end.moment.date, km: (end.odoKm ?? 0) - (start.odoKm ?? 0), litres: litres),
                broken
            )
        }
    }
}
