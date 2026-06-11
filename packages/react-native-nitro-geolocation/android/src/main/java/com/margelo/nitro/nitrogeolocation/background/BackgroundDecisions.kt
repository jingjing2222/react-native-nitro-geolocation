package com.margelo.nitro.nitrogeolocation.background

import android.app.PendingIntent
import android.os.Build

/**
 * Pure decision helpers for the background pipeline, extracted so they can be unit-tested with
 * plain JUnit (no Android framework instances) — see BackgroundDecisionsTest. They take their
 * inputs explicitly instead of reading global state. The Android constants used here
 * (PendingIntent.FLAG_*, Build.VERSION_CODES.*) are compile-time `static final int` values, so the
 * logic is fully evaluable on a plain JVM.
 */

/**
 * Flags for the broadcast PendingIntents the OS fills in at delivery time (location / geofence /
 * activity). The result MUST be mutable on API 31+ (S), otherwise FusedLocationProviderClient
 * rejects registration with "PendingIntent must be mutable" and zero updates are ever delivered.
 * Pre-S PendingIntents are mutable by default, so no immutability flag is set there.
 */
internal fun mutablePendingIntentFlags(sdkInt: Int): Int {
    return if (sdkInt >= Build.VERSION_CODES.S) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
    } else {
        PendingIntent.FLAG_UPDATE_CURRENT
    }
}

/**
 * Capped exponential backoff base (without jitter): baseMs * 2^attempt, clamped to [baseMs, maxMs].
 * Callers add jitter on top to avoid synchronized retries across devices.
 */
internal fun backoffBaseDelayMs(attempt: Int, baseMs: Long, maxMs: Long): Long {
    if (attempt <= 0) return baseMs
    val grown = if (attempt >= 31) maxMs else baseMs shl attempt
    return grown.coerceIn(baseMs, maxMs)
}

/** Resolves the effective store cap: a configured positive value, otherwise the default. */
internal fun resolveMaxStored(configured: Int?, default: Int): Int {
    return configured?.takeIf { it > 0 } ?: default
}
