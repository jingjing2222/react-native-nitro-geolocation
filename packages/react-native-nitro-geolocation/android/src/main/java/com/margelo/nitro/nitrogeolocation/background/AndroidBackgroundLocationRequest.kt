package com.margelo.nitro.nitrogeolocation.background

import com.google.android.gms.location.LocationRequest
import com.margelo.nitro.nitrogeolocation.AndroidGranularity
import com.margelo.nitro.nitrogeolocation.BackgroundLocationOptions
import com.margelo.nitro.nitrogeolocation.gmsGranularity

internal fun buildBackgroundLocationRequest(options: BackgroundLocationOptions): LocationRequest =
    LocationRequest.Builder(resolvePriority(options), options.interval?.toLong() ?: 10_000L)
        .setMinUpdateIntervalMillis(options.fastestInterval?.toLong() ?: 5_000L)
        .setMinUpdateDistanceMeters((options.distanceFilter ?: 0.0).toFloat())
        .setGranularity((options.granularity ?: AndroidGranularity.PERMISSION).gmsGranularity())
        .setWaitForAccurateLocation(options.waitForAccurateLocation == true)
        .setMaxUpdateDelayMillis(options.maxUpdateDelay?.toLong() ?: 0L)
        .build()
