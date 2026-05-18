package com.margelo.nitro.nitrogeolocation

import com.google.android.gms.location.LocationRequest as GmsLocationRequest

internal fun buildFusedLocationRequest(
    options: ParsedOptions,
    maxUpdatesOverride: Int? = null,
    includeDistanceFilter: Boolean = true
): GmsLocationRequest {
    val builder = GmsLocationRequest
        .Builder(options.androidAccuracy.gmsPriority(), coercePositiveMillis(options.interval))
        .setMinUpdateIntervalMillis(coercePositiveMillis(options.fastestInterval))
        .setGranularity(options.granularity.gmsGranularity())
        .setWaitForAccurateLocation(options.waitForAccurateLocation)
        .setMaxUpdateDelayMillis(coerceNonNegativeMillis(options.maxUpdateDelay))

    if (includeDistanceFilter) {
        builder.setMinUpdateDistanceMeters(options.distanceFilter.toFloat())
    }

    options.maxUpdateAge?.let { value ->
        builder.setMaxUpdateAgeMillis(coerceNonNegativeMillis(value))
    }

    val maxUpdates = maxUpdatesOverride ?: options.maxUpdates
    if (maxUpdates != null) {
        builder.setMaxUpdates(maxUpdates)
    }

    return builder.build()
}
