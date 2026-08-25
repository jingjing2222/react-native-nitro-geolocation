import Foundation
import CoreLocation

extension NitroGeolocation {
    func getCurrentPosition(
        success: @escaping (GeolocationResponse) -> Void,
        options: LocationRequestOptions,
        error: ((LocationError) -> Void)?
    ) throws -> Void {
        let locationServicesEnabled = CLLocationManager.locationServicesEnabled()
        runLocationOperationOnMain {
            self.getCurrentPositionInternal(
                requestId: UUID().uuidString,
                success: success,
                options: options,
                locationServicesEnabled: locationServicesEnabled,
                error: error
            )
        }
    }

    func getCurrentPositionCancellable(
        requestId: String,
        success: @escaping (GeolocationResponse) -> Void,
        options: LocationRequestOptions,
        error: ((LocationError) -> Void)?
    ) throws -> Void {
        let locationServicesEnabled = CLLocationManager.locationServicesEnabled()
        runLocationOperationOnMain {
            self.cancelCurrentPositionRequestOnMain(requestId: requestId)
            self.getCurrentPositionInternal(
                requestId: requestId,
                success: success,
                options: options,
                locationServicesEnabled: locationServicesEnabled,
                error: error
            )
        }
    }

    func cancelCurrentPositionRequest(requestId: String) {
        runLocationOperationOnMain {
            self.cancelCurrentPositionRequestOnMain(requestId: requestId)
        }
    }

    func watchPosition(
        success: @escaping (GeolocationResponse) -> Void,
        options: LocationRequestOptions,
        error: ((LocationError) -> Void)?
    ) -> String {
        let token = UUID().uuidString
        let subscription = WatchSubscription(
            success: success,
            error: error,
            options: ParsedOptions.parse(from: options),
            deliveryState: nil
        )

        runLocationOperationOnMainSync {
            self.watchSubscriptions[token] = subscription
            self.initializeLocationManagerIfNeeded()
            self.updateLocationManagerConfiguration()
            self.startMonitoring()
        }

        return token
    }

    private func cancelCurrentPositionRequestOnMain(requestId: String) {
        guard let request = pendingPositionRequests.removeValue(forKey: requestId) else {
            return
        }

        request.timer?.cancel()
        updateMonitoringAfterPositionRequestRemoval()
    }

    internal func runLocationOperationOnMain(_ operation: @escaping () -> Void) {
        if Thread.isMainThread {
            operation()
        } else {
            DispatchQueue.main.async(execute: operation)
        }
    }

    internal func runLocationOperationOnMainSync(_ operation: () -> Void) {
        if Thread.isMainThread {
            operation()
        } else {
            DispatchQueue.main.sync(execute: operation)
        }
    }
}

internal func isCachedLocationValid(_ location: CLLocation, options: ParsedOptions) -> Bool {
    if options.maximumAge.isInfinite {
        return true
    }

    let age = Date().timeIntervalSince(location.timestamp) * 1000
    return age < options.maximumAge
}
