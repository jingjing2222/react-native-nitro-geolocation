import Foundation
import CoreLocation

extension NitroGeolocation {
    func getCurrentPosition(
        success: @escaping (GeolocationResponse) -> Void,
        options: LocationRequestOptions,
        error: ((LocationError) -> Void)?
    ) throws -> Void {
        runCurrentPositionOperationOnMain {
            self.getCurrentPositionInternal(
                requestId: UUID().uuidString,
                success: success,
                options: options,
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
        runCurrentPositionOperationOnMain {
            self.cancelCurrentPositionRequestOnMain(requestId: requestId)
            self.getCurrentPositionInternal(
                requestId: requestId,
                success: success,
                options: options,
                error: error
            )
        }
    }

    func cancelCurrentPositionRequest(requestId: String) {
        runCurrentPositionOperationOnMain {
            self.cancelCurrentPositionRequestOnMain(requestId: requestId)
        }
    }

    private func cancelCurrentPositionRequestOnMain(requestId: String) {
        guard let request = pendingPositionRequests.removeValue(forKey: requestId) else {
            return
        }

        request.timer?.cancel()
        updateMonitoringAfterPositionRequestRemoval()
    }

    private func runCurrentPositionOperationOnMain(_ operation: @escaping () -> Void) {
        if Thread.isMainThread {
            operation()
        } else {
            DispatchQueue.main.async(execute: operation)
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
