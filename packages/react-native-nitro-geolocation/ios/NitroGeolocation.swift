class NitroGeolocation: HybridNitroGeolocationSpec {
    private var configuration: RNConfigurationInternal = RNConfigurationInternal(
        skipPermissionRequests: false,
        authorizationLevel: nil,
        enableBackgroundLocationUpdates: nil,
        locationProvider: nil
    )

    public func setRNConfiguration(config: RNConfigurationInternal) throws {
        configuration = config
    }

    public func requestAuthorization(success: (() -> Void)?, error: ((GeolocationError) -> Void)?)
        throws
    {
        // TODO: Implement
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
