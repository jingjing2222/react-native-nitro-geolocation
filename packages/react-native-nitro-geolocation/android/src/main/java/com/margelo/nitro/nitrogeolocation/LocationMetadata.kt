package com.margelo.nitro.nitrogeolocation

import android.location.Location
import android.location.LocationManager
import android.os.Build

private const val FUSED_PROVIDER = "fused"

internal fun Location.isMocked(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        isMock
    } else {
        @Suppress("DEPRECATION")
        isFromMockProvider
    }
}

internal fun Location.providerUsed(): LocationProviderUsed {
    return when (provider) {
        FUSED_PROVIDER -> LocationProviderUsed.FUSED
        LocationManager.GPS_PROVIDER -> LocationProviderUsed.GPS
        LocationManager.NETWORK_PROVIDER -> LocationProviderUsed.NETWORK
        LocationManager.PASSIVE_PROVIDER -> LocationProviderUsed.PASSIVE
        else -> LocationProviderUsed.UNKNOWN
    }
}
