import CoreLocation
import Foundation

func headingToResponse(_ clHeading: CLHeading) -> Heading {
    let trueHeading = clHeading.trueHeading >= 0
        ? clHeading.trueHeading
        : nil
    let accuracy = clHeading.headingAccuracy >= 0
        ? clHeading.headingAccuracy
        : nil

    return Heading(
        magneticHeading: normalizeHeading(clHeading.magneticHeading),
        trueHeading: trueHeading.map(normalizeHeading),
        accuracy: accuracy,
        timestamp: clHeading.timestamp.timeIntervalSince1970 * 1000
    )
}

func angularDistance(_ first: Double, _ second: Double) -> Double {
    let distance = Swift.abs(first - second).truncatingRemainder(dividingBy: 360)
    return distance > 180 ? 360 - distance : distance
}

func normalizeHeading(_ value: Double) -> Double {
    let normalized = value.truncatingRemainder(dividingBy: 360)
    return normalized < 0 ? normalized + 360 : normalized
}

extension CLLocation {
    func toGeolocationResponse() -> GeolocationResponse {
        let coords = GeolocationCoordinates(
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            altitude: nitroGeolocationAltitude,
            accuracy: horizontalAccuracy,
            altitudeAccuracy: nitroGeolocationAltitudeAccuracy,
            heading: nitroGeolocationHeading,
            speed: nitroGeolocationSpeed
        )

        return GeolocationResponse(
            coords: coords,
            timestamp: timestamp.timeIntervalSince1970 * 1000,
            mocked: nitroGeolocationMocked,
            provider: nitroGeolocationProvider
        )
    }
}

extension CLPlacemark {
    func toGeocodedLocation() -> GeocodedLocation? {
        guard let location else {
            return nil
        }

        let accuracy = location.horizontalAccuracy >= 0
            ? location.horizontalAccuracy
            : nil

        return GeocodedLocation(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            accuracy: accuracy
        )
    }

    func toReverseGeocodedAddress() -> ReverseGeocodedAddress {
        return ReverseGeocodedAddress(
            country: country.nonEmptyTrimmed,
            region: administrativeArea.nonEmptyTrimmed,
            city: locality.nonEmptyTrimmed,
            district: subLocality.nonEmptyTrimmed,
            street: formatStreet(),
            postalCode: postalCode.nonEmptyTrimmed,
            formattedAddress: formatAddress()
        )
    }

    func formatStreet() -> String? {
        return [
            subThoroughfare.nonEmptyTrimmed,
            thoroughfare.nonEmptyTrimmed
        ]
            .compactMap { $0 }
            .joined(separator: " ")
            .nonEmptyTrimmed
    }

    func formatAddress() -> String? {
        var parts: [String] = []

        appendDistinct(name.nonEmptyTrimmed, to: &parts)
        appendDistinct(formatStreet(), to: &parts)
        appendDistinct(subLocality.nonEmptyTrimmed, to: &parts)
        appendDistinct(locality.nonEmptyTrimmed, to: &parts)
        appendDistinct(administrativeArea.nonEmptyTrimmed, to: &parts)
        appendDistinct(postalCode.nonEmptyTrimmed, to: &parts)
        appendDistinct(country.nonEmptyTrimmed, to: &parts)

        return parts.joined(separator: ", ").nonEmptyTrimmed
    }

    private func appendDistinct(_ value: String?, to parts: inout [String]) {
        guard let value, !parts.contains(value) else {
            return
        }

        parts.append(value)
    }
}

extension Optional where Wrapped == String {
    var nonEmptyTrimmed: String? {
        guard let trimmed = self?.trimmingCharacters(in: .whitespacesAndNewlines) else {
            return nil
        }

        return trimmed.isEmpty ? nil : trimmed
    }
}

extension String {
    var nonEmptyTrimmed: String? {
        return trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    }

    var nilIfEmpty: String? {
        return isEmpty ? nil : self
    }
}
