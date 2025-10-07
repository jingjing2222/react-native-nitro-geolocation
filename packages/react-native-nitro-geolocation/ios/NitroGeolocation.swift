import CoreLocation

class NitroGeolocation: HybridNitroGeolocationSpec {
    // MARK: - Properties

    private var configuration: RNConfigurationInternal = RNConfigurationInternal(
        skipPermissionRequests: false,
        authorizationLevel: nil,
        enableBackgroundLocationUpdates: nil,
        locationProvider: nil
    )

    private let authManager = LocationAuthorizationManager()

    // MARK: - Public API

    public func setRNConfiguration(config: RNConfigurationInternal) throws {
        configuration = config
    }

    public func requestAuthorization(success: (() -> Void)?, error: ((GeolocationError) -> Void)?)
        throws
    {
        let authType = determineAuthorizationType()
        authManager.requestAuthorization(authType: authType, success: success, error: error)
    }

    // MARK: - Authorization Helpers

    private func determineAuthorizationType() -> LocationAuthorizationManager.AuthorizationType {
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

    private func determineAuthorizationTypeFromInfoPlist() -> LocationAuthorizationManager.AuthorizationType {
        if hasInfoPlistKey(for: .always) {
            return .always
        } else if hasInfoPlistKey(for: .whenInUse) {
            return .whenInUse
        }
        return .none
    }

    private func hasInfoPlistKey(for type: LocationAuthorizationManager.AuthorizationType) -> Bool {
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

    public func getCurrentPosition(
        success: @escaping (GeolocationPosition) -> Void, error: ((GeolocationError) -> Void)?,
        options: GeolocationOptions?
    ) throws {
        // TODO: Implement
    }

    public func watchPosition(
        success: @escaping (GeolocationPosition) -> Void, error: ((GeolocationError) -> Void)?,
        options: GeolocationOptions?
    ) throws -> Double {
        // TODO: Implement
        return 0
    }

    public func clearWatch(watchId: Double) throws {
        // TODO: Implement
    }

    public func stopObserving() throws {
        // TODO: Implement
    }
}
