package com.margelo.nitro.nitrogeolocation

import android.location.LocationManager

internal enum class AndroidAccuracyMode {
    HIGH,
    BALANCED,
    LOW,
    PASSIVE
}

internal data class AndroidAccuracyResolution(
    val mode: AndroidAccuracyMode,
    val explicitPreset: AndroidAccuracyPreset?
)

internal fun resolveAndroidAccuracy(
    accuracy: LocationAccuracyOptions?,
    enableHighAccuracy: Boolean
): AndroidAccuracyResolution {
    val preset = accuracy?.android
    val mode = when (preset) {
        AndroidAccuracyPreset.HIGH -> AndroidAccuracyMode.HIGH
        AndroidAccuracyPreset.BALANCED -> AndroidAccuracyMode.BALANCED
        AndroidAccuracyPreset.LOW -> AndroidAccuracyMode.LOW
        AndroidAccuracyPreset.PASSIVE -> AndroidAccuracyMode.PASSIVE
        null -> if (enableHighAccuracy) AndroidAccuracyMode.HIGH else AndroidAccuracyMode.BALANCED
    }

    return AndroidAccuracyResolution(mode = mode, explicitPreset = preset)
}

internal fun AndroidAccuracyResolution.providerOrder(): List<String> {
    return when (mode) {
        AndroidAccuracyMode.HIGH -> listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER
        )
        AndroidAccuracyMode.BALANCED -> if (explicitPreset == null) {
            listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER)
        } else {
            listOf(LocationManager.NETWORK_PROVIDER)
        }
        AndroidAccuracyMode.LOW -> listOf(
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        )
        AndroidAccuracyMode.PASSIVE -> listOf(LocationManager.PASSIVE_PROVIDER)
    }
}

internal fun mostDemandingAndroidAccuracy(
    current: AndroidAccuracyResolution?,
    next: AndroidAccuracyResolution
): AndroidAccuracyResolution {
    if (current == null) return next

    val currentRank = current.mode.demandRank()
    val nextRank = next.mode.demandRank()

    return when {
        nextRank > currentRank -> next
        nextRank < currentRank -> current
        current.explicitPreset == null && next.explicitPreset != null -> next
        else -> current
    }
}

private fun AndroidAccuracyMode.demandRank(): Int {
    return when (this) {
        AndroidAccuracyMode.PASSIVE -> 0
        AndroidAccuracyMode.LOW -> 1
        AndroidAccuracyMode.BALANCED -> 2
        AndroidAccuracyMode.HIGH -> 3
    }
}
