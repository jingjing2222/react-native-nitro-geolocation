import CoreLocation
import Foundation

final class IOSGeocoder {
    private var activeGeocoders: [UUID: CLGeocoder] = [:]

    func geocode(
        address: String,
        success: @escaping ([GeocodedLocation]) -> Void,
        error: ((LocationError) -> Void)?
    ) {
        let query = address.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            error?(createLocationError(
                code: INTERNAL_ERROR,
                message: "address must not be empty."
            ))
            return
        }

        DispatchQueue.main.async {
            let id = UUID()
            let geocoder = CLGeocoder()
            self.activeGeocoders[id] = geocoder
            geocoder.geocodeAddressString(query) { [weak self] placemarks, geocodeError in
                guard let self else { return }
                DispatchQueue.main.async {
                    self.activeGeocoders.removeValue(forKey: id)
                    if let geocodeError {
                        if self.isNoResult(geocodeError) {
                            success([])
                        } else {
                            error?(self.createError(
                                geocodeError,
                                messagePrefix: "Unable to geocode address"
                            ))
                        }
                        return
                    }
                    success((placemarks ?? []).compactMap { $0.toGeocodedLocation() })
                }
            }
        }
    }

    func reverseGeocode(
        coords: GeocodingCoordinates,
        success: @escaping ([ReverseGeocodedAddress]) -> Void,
        error: ((LocationError) -> Void)?
    ) {
        if let validationError = validate(coords) {
            error?(validationError)
            return
        }

        DispatchQueue.main.async {
            let id = UUID()
            let geocoder = CLGeocoder()
            self.activeGeocoders[id] = geocoder
            let location = CLLocation(
                latitude: coords.latitude,
                longitude: coords.longitude
            )
            geocoder.reverseGeocodeLocation(location) { [weak self] placemarks, geocodeError in
                guard let self else { return }
                DispatchQueue.main.async {
                    self.activeGeocoders.removeValue(forKey: id)
                    if let geocodeError {
                        if self.isNoResult(geocodeError) {
                            success([])
                        } else {
                            error?(self.createError(
                                geocodeError,
                                messagePrefix: "Unable to reverse geocode coordinates"
                            ))
                        }
                        return
                    }
                    success((placemarks ?? []).map { $0.toReverseGeocodedAddress() })
                }
            }
        }
    }

    private func validate(_ coords: GeocodingCoordinates) -> LocationError? {
        if !coords.latitude.isFinite || coords.latitude < -90 || coords.latitude > 90 {
            return createLocationError(
                code: INTERNAL_ERROR,
                message: "latitude must be a finite number between -90 and 90."
            )
        }
        if !coords.longitude.isFinite || coords.longitude < -180 || coords.longitude > 180 {
            return createLocationError(
                code: INTERNAL_ERROR,
                message: "longitude must be a finite number between -180 and 180."
            )
        }
        return nil
    }

    private func isNoResult(_ error: Error) -> Bool {
        guard let clError = error as? CLError else { return false }
        return clError.code == .geocodeFoundNoResult
    }

    private func createError(_ error: Error, messagePrefix: String) -> LocationError {
        guard let clError = error as? CLError else {
            return createLocationError(
                code: POSITION_UNAVAILABLE,
                message: "\(messagePrefix): \(error.localizedDescription)"
            )
        }
        switch clError.code {
        case .denied:
            return createLocationError(
                code: PERMISSION_DENIED,
                message: "\(messagePrefix): geocoder access denied."
            )
        case .network:
            return createLocationError(
                code: POSITION_UNAVAILABLE,
                message: "\(messagePrefix): network unavailable."
            )
        default:
            return createLocationError(
                code: POSITION_UNAVAILABLE,
                message: "\(messagePrefix): \(error.localizedDescription)"
            )
        }
    }
}
