package com.margelo.nitro.nitrogeolocation

import android.location.Address
import android.location.Location

internal fun Location.toGeolocationResponse(
    providerOverride: LocationProviderUsed? = null
): GeolocationResponse {
    val coords = GeolocationCoordinates(
        latitude = latitude,
        longitude = longitude,
        altitude = altitudeValue(),
        accuracy = accuracy.toDouble(),
        altitudeAccuracy = altitudeAccuracyValue(),
        heading = headingValue(),
        speed = speedValue()
    )

    return GeolocationResponse(
        coords = coords,
        timestamp = time.toDouble(),
        mocked = isMocked(),
        provider = providerOverride ?: providerUsed()
    )
}

internal fun Address.toGeocodedLocation(): GeocodedLocation? {
    if (!hasLatitude() || !hasLongitude()) {
        return null
    }

    return GeocodedLocation(
        latitude = latitude,
        longitude = longitude,
        accuracy = null
    )
}

internal fun Address.toReverseGeocodedAddress(): ReverseGeocodedAddress {
    return ReverseGeocodedAddress(
        country = countryName.nonBlankOrNull(),
        region = adminArea.nonBlankOrNull(),
        city = (locality ?: subAdminArea).nonBlankOrNull(),
        district = subLocality.nonBlankOrNull(),
        street = formatStreet(),
        postalCode = postalCode.nonBlankOrNull(),
        formattedAddress = formatAddressLines()
    )
}

internal fun Address.formatStreet(): String? {
    return listOf(subThoroughfare, thoroughfare)
        .mapNotNull { it.nonBlankOrNull() }
        .joinToString(" ")
        .nonBlankOrNull()
}

internal fun Address.formatAddressLines(): String? {
    if (maxAddressLineIndex < 0) {
        return null
    }

    return (0..maxAddressLineIndex)
        .mapNotNull { index -> getAddressLine(index).nonBlankOrNull() }
        .joinToString(", ")
        .nonBlankOrNull()
}

internal fun String?.nonBlankOrNull(): String? {
    return this?.trim()?.takeIf { it.isNotEmpty() }
}
