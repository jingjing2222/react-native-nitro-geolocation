import CoreLocation

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
}
