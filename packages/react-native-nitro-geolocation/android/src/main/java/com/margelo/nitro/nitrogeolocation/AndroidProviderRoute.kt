package com.margelo.nitro.nitrogeolocation

internal enum class AndroidProviderRoute {
    FUSED,
    PLATFORM
}

internal fun selectAndroidProviderRoute(
    locationProvider: LocationProvider?,
    googlePlayServicesAvailable: Boolean
): AndroidProviderRoute {
    if (locationProvider == LocationProvider.ANDROID_PLATFORM) {
        return AndroidProviderRoute.PLATFORM
    }

    return if (googlePlayServicesAvailable) {
        AndroidProviderRoute.FUSED
    } else {
        AndroidProviderRoute.PLATFORM
    }
}

internal fun selectAndroidFallbackRouteAfterFusedFailure(
    @Suppress("UNUSED_PARAMETER") locationProvider: LocationProvider?
): AndroidProviderRoute {
    return AndroidProviderRoute.PLATFORM
}

private fun runAndroidProviderFallbackAfterFusedFailure(
    locationProvider: LocationProvider?,
    runPlatformFallback: () -> Unit,
    failWithoutFallback: () -> Unit
) {
    when (selectAndroidFallbackRouteAfterFusedFailure(locationProvider)) {
        AndroidProviderRoute.PLATFORM -> runPlatformFallback()
        AndroidProviderRoute.FUSED -> failWithoutFallback()
    }
}

internal fun runAndroidCurrentPositionFallbackAfterFusedFailure(
    locationProvider: LocationProvider?,
    runPlatformFallback: () -> Unit,
    failWithoutFallback: () -> Unit
) {
    runAndroidProviderFallbackAfterFusedFailure(
        locationProvider = locationProvider,
        runPlatformFallback = runPlatformFallback,
        failWithoutFallback = failWithoutFallback
    )
}

internal fun runAndroidLastKnownPositionFallbackAfterFusedFailure(
    locationProvider: LocationProvider?,
    runPlatformFallback: () -> Unit,
    failWithoutFallback: () -> Unit
) {
    runAndroidProviderFallbackAfterFusedFailure(
        locationProvider = locationProvider,
        runPlatformFallback = runPlatformFallback,
        failWithoutFallback = failWithoutFallback
    )
}

internal fun runAndroidWatchPositionFallbackAfterFusedFailure(
    locationProvider: LocationProvider?,
    runPlatformFallback: () -> Unit,
    failWithoutFallback: () -> Unit
) {
    runAndroidProviderFallbackAfterFusedFailure(
        locationProvider = locationProvider,
        runPlatformFallback = runPlatformFallback,
        failWithoutFallback = failWithoutFallback
    )
}
