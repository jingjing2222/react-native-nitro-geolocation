import CoreLocation
import NitroModules

extension CLLocation {
    var nitroGeolocationMocked: Bool? {
        if #available(iOS 15.0, *) {
            return sourceInformation?.isSimulatedBySoftware
        }

        return nil
    }

    var nitroGeolocationProvider: LocationProviderUsed {
        return .unknown
    }

    var nitroGeolocationAltitude: NullableDouble {
        return verticalAccuracy < 0 ? .first(NullType.null) : .second(altitude)
    }

    var nitroGeolocationAltitudeAccuracy: NullableDouble {
        return verticalAccuracy < 0 ? .first(NullType.null) : .second(verticalAccuracy)
    }

    var nitroGeolocationHeading: NullableDouble {
        return course >= 0 ? .second(course) : .first(NullType.null)
    }

    var nitroGeolocationSpeed: NullableDouble {
        return speed >= 0 ? .second(speed) : .first(NullType.null)
    }
}
