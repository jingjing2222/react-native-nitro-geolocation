import CoreLocation
import Foundation

struct ParsedOptions {
    let timeout: Double
    let maximumAge: Double
    let accuracy: CLLocationAccuracy
    let distanceFilter: CLLocationDistance
    let useSignificantChanges: Bool
    let activityType: CLActivityType?
    let pausesLocationUpdatesAutomatically: Bool?
    let showsBackgroundLocationIndicator: Bool?

    static let DEFAULT_TIMEOUT: Double = 10 * 60 * 1000  // 10 minutes in ms
    static let DEFAULT_MAXIMUM_AGE: Double = 0

    static func parse(
        from options: LocationRequestOptions?,
        defaultMaximumAge: Double = DEFAULT_MAXIMUM_AGE
    ) -> ParsedOptions {
        let timeout = options?.timeout ?? DEFAULT_TIMEOUT
        let maximumAge = options?.maximumAge ?? defaultMaximumAge
        let enableHighAccuracy = options?.enableHighAccuracy ?? false
        let accuracy = resolveAccuracy(
            preset: options?.accuracy?.ios,
            enableHighAccuracy: enableHighAccuracy
        )
        let distanceFilter = options?.distanceFilter ?? kCLDistanceFilterNone
        let useSignificantChanges = options?.useSignificantChanges ?? false

        return ParsedOptions(
            timeout: timeout,
            maximumAge: maximumAge,
            accuracy: accuracy,
            distanceFilter: distanceFilter,
            useSignificantChanges: useSignificantChanges,
            activityType: resolveActivityType(options?.activityType),
            pausesLocationUpdatesAutomatically: options?.pausesLocationUpdatesAutomatically,
            showsBackgroundLocationIndicator: options?.showsBackgroundLocationIndicator
        )
    }

    static func parseLastKnown(from options: LocationRequestOptions?) -> ParsedOptions {
        return parse(from: options, defaultMaximumAge: Double.infinity)
    }

    private static func resolveAccuracy(
        preset: IOSAccuracyPreset?,
        enableHighAccuracy: Bool
    ) -> CLLocationAccuracy {
        guard let preset else {
            return enableHighAccuracy
                ? kCLLocationAccuracyBest
                : kCLLocationAccuracyHundredMeters
        }

        switch preset {
        case .bestfornavigation:
            return kCLLocationAccuracyBestForNavigation
        case .best:
            return kCLLocationAccuracyBest
        case .nearesttenmeters:
            return kCLLocationAccuracyNearestTenMeters
        case .hundredmeters:
            return kCLLocationAccuracyHundredMeters
        case .kilometer:
            return kCLLocationAccuracyKilometer
        case .threekilometers:
            return kCLLocationAccuracyThreeKilometers
        case .reduced:
            return kCLLocationAccuracyReduced
        }
    }

    private static func resolveActivityType(_ activityType: IOSActivityType?) -> CLActivityType? {
        guard let activityType else {
            return nil
        }

        switch activityType {
        case .other:
            return .other
        case .automotivenavigation:
            return .automotiveNavigation
        case .fitness:
            return .fitness
        case .othernavigation:
            return .otherNavigation
        case .airborne:
            return .airborne
        }
    }
}

struct ParsedHeadingOptions {
    let headingFilter: CLLocationDegrees

    // Apple's documented `CLLocationManager.headingFilter` default is 1°.
    // Defaulting to `0` here propagates through `mergeHeadingFilter` into
    // `kCLHeadingFilterNone` (-1), which fires the delegate on every
    // CLHeading tick (sub-degree firehose for stationary users). 1° matches
    // CL's documented behavior and lets the delegate fire only on
    // perceptible changes.
    static func parse(from options: HeadingOptions?) -> ParsedHeadingOptions {
        return ParsedHeadingOptions(
            headingFilter: options?.headingFilter ?? 1
        )
    }
}

struct WatchSubscription {
    let success: (GeolocationResponse) -> Void
    let error: ((LocationError) -> Void)?
    let options: ParsedOptions
}

struct PositionRequest {
    let success: (GeolocationResponse) -> Void
    let error: (LocationError) -> Void
    let options: ParsedOptions
    var timer: DispatchSourceTimer?
}

struct HeadingRequest {
    let success: (Heading) -> Void
    let error: (LocationError) -> Void
    var timer: DispatchSourceTimer?
}

struct HeadingSubscription {
    let success: (Heading) -> Void
    let error: ((LocationError) -> Void)?
    let options: ParsedHeadingOptions
    var lastDeliveredHeading: Double?
}
