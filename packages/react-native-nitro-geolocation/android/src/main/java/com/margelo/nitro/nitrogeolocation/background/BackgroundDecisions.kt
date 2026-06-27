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

/**
 * Resolves the effective store cap (rows), preserving the library's original opt-out for unbounded
 * storage while adding a safe default when the option is unset:
 *  - unset (null) → [default] (a safety cap so the store can't grow without bound by accident)
 *  - explicit <= 0 → 0, meaning UNBOUNDED — pruneRows treats <= 0 as no-prune, the same opt-out the
 *    original code gave for any non-positive value
 *  - explicit > 0 → that cap
 */
internal fun resolveMaxStored(configured: Int?, default: Int): Int {
    return when {
        configured == null -> default
        configured <= 0 -> 0
        else -> configured
    }
}

/**
 * Headless JS is the fallback path when no in-process JS listener received the native event. If a
 * live listener already handled the event, starting Headless JS duplicates delivery and React
 * Native warns when the app did not register NitroBackgroundLocationTask.
 */
internal fun shouldDispatchHeadlessTask(deliveredToInProcessListener: Boolean): Boolean {
    return !deliveredToInProcessListener
}
