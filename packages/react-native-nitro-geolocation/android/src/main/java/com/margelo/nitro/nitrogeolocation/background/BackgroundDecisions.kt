package com.margelo.nitro.nitrogeolocation.background

import android.app.PendingIntent
import android.os.Build
import com.google.android.gms.location.Priority
import com.margelo.nitro.nitrogeolocation.AndroidAccuracyPreset
import com.margelo.nitro.nitrogeolocation.BackgroundLocationOptions
import com.margelo.nitro.nitrogeolocation.BackgroundTrackingMode
import com.margelo.nitro.nitrogeolocation.DetectedActivity
import com.margelo.nitro.nitrogeolocation.DetectedActivityType
import com.margelo.nitro.nitrogeolocation.LocationErrorCode

internal const val DEFAULT_MAX_STORED_LOCATIONS = 10_000
internal const val DEFAULT_MAX_STORED_EVENTS = 10_000
internal const val PREF_RUN_GENERATION = "runGeneration"

internal val ERROR_CODE_PERMISSION_DENIED = LocationErrorCode.PERMISSIONDENIED
internal val ERROR_CODE_POSITION_UNAVAILABLE = LocationErrorCode.POSITIONUNAVAILABLE

internal enum class ActivityTrackingAction { NONE, START, STOP }

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

internal fun maxStoredLocations(options: BackgroundLocationOptions?): Int =
    resolveMaxStored(options?.maxStoredLocations?.toInt(), DEFAULT_MAX_STORED_LOCATIONS)

internal fun maxStoredEvents(options: BackgroundLocationOptions?): Int =
    resolveMaxStored(options?.maxStoredEvents?.toInt(), DEFAULT_MAX_STORED_EVENTS)

/**
 * Headless JS is the fallback path when no in-process JS listener received the native event. If a
 * live listener already handled the event, starting Headless JS duplicates delivery and React
 * Native warns when the app did not register NitroBackgroundLocationTask.
 */
internal fun shouldDispatchHeadlessTask(deliveredToInProcessListener: Boolean): Boolean {
    return !deliveredToInProcessListener
}

/** Rejects stale native callbacks after reset and never persists without configuration. */
internal fun shouldPersistForGeneration(
    isConfigured: Boolean,
    persist: Boolean?,
    currentGeneration: Long,
    callbackGeneration: Long,
    allowUnconfigured: Boolean = false
): Boolean {
    return (isConfigured || allowUnconfigured) &&
        persist != false &&
        currentGeneration == callbackGeneration
}

internal fun nextRegistrationGeneration(current: Long): Long = current + 1L

internal fun isCurrentRegistration(
    currentRunGeneration: Long,
    currentRegistrationGeneration: Long,
    callbackRunGeneration: Long,
    callbackRegistrationGeneration: Long
): Boolean = currentRunGeneration == callbackRunGeneration &&
    currentRegistrationGeneration == callbackRegistrationGeneration

internal fun shouldApplyStartupFailure(
    activeServiceGeneration: Long?,
    failedServiceGeneration: Long
): Boolean = activeServiceGeneration == failedServiceGeneration

internal fun requiresActivityRecognition(options: BackgroundLocationOptions): Boolean =
    options.trackingMode == BackgroundTrackingMode.ACTIVITYAWARE ||
        options.activityRecognition?.enabled == true

internal fun validateAndroidBackgroundOptions(options: BackgroundLocationOptions) {
    if (options.android?.foregroundService == null) {
        throw IllegalArgumentException(
            "Android background tracking requires android.foregroundService notification options"
        )
    }
}

internal fun resolvePriority(options: BackgroundLocationOptions): Int =
    when (options.accuracy?.android) {
        AndroidAccuracyPreset.HIGH -> Priority.PRIORITY_HIGH_ACCURACY
        AndroidAccuracyPreset.LOW -> Priority.PRIORITY_LOW_POWER
        AndroidAccuracyPreset.PASSIVE -> Priority.PRIORITY_PASSIVE
        else -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
    }

internal fun activityTrackingAction(
    options: BackgroundLocationOptions,
    activity: DetectedActivity,
    isRunning: Boolean
): ActivityTrackingAction {
    val recognition = options.activityRecognition
    if (options.trackingMode != BackgroundTrackingMode.ACTIVITYAWARE &&
        recognition?.stopOnStill != true) return ActivityTrackingAction.NONE
    if (activity.confidence < (recognition?.minimumConfidence ?: 0.0)) {
        return ActivityTrackingAction.NONE
    }
    val stopOnStill = recognition?.stopOnStill ?: true
    if (activity.type == DetectedActivityType.STILL && stopOnStill) {
        return ActivityTrackingAction.STOP
    }
    return if (isRunning && activity.type != DetectedActivityType.STILL &&
        activity.type != DetectedActivityType.UNKNOWN) {
        ActivityTrackingAction.START
    } else {
        ActivityTrackingAction.NONE
    }
}
