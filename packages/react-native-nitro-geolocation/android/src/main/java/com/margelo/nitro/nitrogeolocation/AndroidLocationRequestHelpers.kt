package com.margelo.nitro.nitrogeolocation

import android.location.Location

private const val TWO_MINUTES_MS = 2 * 60 * 1000L

internal fun validateParsedOptions(options: ParsedOptions): LocationError? {
    if (!options.timeout.isFinite() || options.timeout < 0.0) {
        return createLocationError(
            INTERNAL_ERROR,
            "timeout must be a finite number greater than or equal to 0."
        )
    }

    if (!options.maximumAge.isFinite() && options.maximumAge != Double.POSITIVE_INFINITY) {
        return createLocationError(
            INTERNAL_ERROR,
            "maximumAge must be a finite number greater than or equal to 0."
        )
    }

    if (options.maximumAge < 0.0) {
        return createLocationError(
            INTERNAL_ERROR,
            "maximumAge must be greater than or equal to 0."
        )
    }

    if (!options.interval.isFinite() || options.interval <= 0.0) {
        return createLocationError(
            INTERNAL_ERROR,
            "interval must be a finite number greater than 0."
        )
    }

    if (!options.fastestInterval.isFinite() || options.fastestInterval <= 0.0) {
        return createLocationError(
            INTERNAL_ERROR,
            "fastestInterval must be a finite number greater than 0."
        )
    }

    if (!options.distanceFilter.isFinite() || options.distanceFilter < 0.0) {
        return createLocationError(
            INTERNAL_ERROR,
            "distanceFilter must be a finite number greater than or equal to 0."
        )
    }

    val maxUpdateAge = options.maxUpdateAge
    if (maxUpdateAge != null && (!maxUpdateAge.isFinite() || maxUpdateAge < 0.0)) {
        return createLocationError(
            INTERNAL_ERROR,
            "maxUpdateAge must be a finite number greater than or equal to 0."
        )
    }

    if (!options.maxUpdateDelay.isFinite() || options.maxUpdateDelay < 0.0) {
        return createLocationError(
            INTERNAL_ERROR,
            "maxUpdateDelay must be a finite number greater than or equal to 0."
        )
    }

    val maxUpdates = options.maxUpdates
    if (maxUpdates != null && maxUpdates < 1) {
        return createLocationError(
            INTERNAL_ERROR,
            "maxUpdates must be greater than or equal to 1."
        )
    }

    return null
}

internal fun selectBestLocation(newLocation: Location, currentBest: Location?): Location {
    if (currentBest == null) return newLocation

    val timeDelta = newLocation.time - currentBest.time
    val isSignificantlyNewer = timeDelta > TWO_MINUTES_MS
    val isSignificantlyOlder = timeDelta < -TWO_MINUTES_MS

    if (isSignificantlyNewer) return newLocation
    if (isSignificantlyOlder) return currentBest

    val accuracyDelta = (newLocation.accuracy - currentBest.accuracy).toInt()
    val isMoreAccurate = accuracyDelta < 0
    val isSignificantlyLessAccurate = accuracyDelta > 200
    val isNewer = timeDelta > 0
    val isLessAccurate = accuracyDelta > 0
    val isFromSameProvider = newLocation.provider == currentBest.provider

    return when {
        isMoreAccurate -> newLocation
        isNewer && !isLessAccurate -> newLocation
        isNewer && !isSignificantlyLessAccurate && isFromSameProvider -> newLocation
        else -> currentBest
    }
}

internal fun mergeNullableMinimum(current: Double?, next: Double?): Double? {
    return when {
        current == null -> next
        next == null -> current
        else -> minOf(current, next)
    }
}
