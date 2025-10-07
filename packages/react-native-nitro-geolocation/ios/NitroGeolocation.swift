import CoreLocation

class NitroGeolocation: HybridNitroGeolocationSpec {
    // MARK: - Properties

    private var configuration: RNConfigurationInternal = RNConfigurationInternal(
        skipPermissionRequests: false,
        authorizationLevel: nil,
        enableBackgroundLocationUpdates: nil,
        locationProvider: nil
    )

    private let locationManager = LocationManager()

    // MARK: - Public API

    public func setRNConfiguration(config: RNConfigurationInternal) throws {
        configuration = config
    }

    public func requestAuthorization(success: (() -> Void)?, error: ((GeolocationError) -> Void)?)
        throws
    {
        let authType = determineAuthorizationType()
        let skipPermissionRequests = configuration.skipPermissionRequests
        let enableBackgroundLocationUpdates = configuration.enableBackgroundLocationUpdates ?? false

        locationManager.requestAuthorization(
            authType: authType,
            skipPermissionRequests: skipPermissionRequests,
            enableBackgroundLocationUpdates: enableBackgroundLocationUpdates,
            success: success,
            error: error
        )
    }

    public func getCurrentPosition(
        success: @escaping (GeolocationPosition) -> Void, error: ((GeolocationError) -> Void)?,
        options: GeolocationOptions?
    ) throws {
        locationManager.getCurrentPosition(success: success, error: error, options: options)
    }

    public func watchPosition(
        success: @escaping (GeolocationPosition) -> Void, error: ((GeolocationError) -> Void)?,
        options: GeolocationOptions?
    ) throws -> Double {
        return locationManager.watchPosition(success: success, error: error, options: options)
    }

    public func clearWatch(watchId: Double) throws {
        locationManager.clearWatch(watchId: watchId)
    }

    public func stopObserving() throws {
        locationManager.stopObserving()
    }

    // MARK: - Authorization Helpers

    private func determineAuthorizationType() -> LocationManager.AuthorizationType {
        guard let authLevel = configuration.authorizationLevel else {
            return determineAuthorizationTypeFromInfoPlist()
        }

        switch authLevel {
        case .always:
            return .always
        case .wheninuse:
            return .whenInUse
        case .auto:
            return determineAuthorizationTypeFromInfoPlist()
        }
    }

    private func determineAuthorizationTypeFromInfoPlist() -> LocationManager.AuthorizationType {
        if hasInfoPlistKey(for: .always) {
            return .always
        } else if hasInfoPlistKey(for: .whenInUse) {
            return .whenInUse
        }
        return .none
    }

    private func hasInfoPlistKey(for type: LocationManager.AuthorizationType) -> Bool {
        switch type {
        case .always:
            return Bundle.main.object(forInfoDictionaryKey: "NSLocationAlwaysUsageDescription") != nil ||
                   Bundle.main.object(forInfoDictionaryKey: "NSLocationAlwaysAndWhenInUseUsageDescription") != nil
        case .whenInUse:
            return Bundle.main.object(forInfoDictionaryKey: "NSLocationWhenInUseUsageDescription") != nil
        case .none:
            return false
        }
    }
}
