package com.margelo.nitro.nitrogeolocation

import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.LocationSettingsStatusCodes

internal class LocationSettingsRequestGate<T : Any> {
    private data class ActiveRequest<T>(
        val request: T,
        var phase: LocationSettingsRequestPhase
    )

    private var activeRequest: ActiveRequest<T>? = null

    @Synchronized
    fun tryBegin(request: T): Boolean {
        if (activeRequest != null) return false

        activeRequest = ActiveRequest(
            request = request,
            phase = LocationSettingsRequestPhase.CHECKING
        )
        return true
    }

    @Synchronized
    fun current(): T? = activeRequest?.request

    @Synchronized
    fun beginAwaitingResolution(request: T): Boolean {
        val active = activeRequest ?: return false
        if (active.request !== request ||
            active.phase != LocationSettingsRequestPhase.CHECKING) {
            return false
        }

        active.phase = LocationSettingsRequestPhase.AWAITING_RESOLUTION
        return true
    }

    @Synchronized
    fun consumeResolutionResult(): T? {
        val active = activeRequest ?: return null
        if (active.phase != LocationSettingsRequestPhase.AWAITING_RESOLUTION) return null

        active.phase = LocationSettingsRequestPhase.CHECKING
        return active.request
    }

    @Synchronized
    fun beginCompleting(request: T): Boolean {
        val active = activeRequest ?: return false
        if (active.request !== request ||
            active.phase == LocationSettingsRequestPhase.COMPLETING) {
            return false
        }

        active.phase = LocationSettingsRequestPhase.COMPLETING
        return true
    }

    @Synchronized
    fun finish(request: T): Boolean {
        if (activeRequest?.request !== request) return false

        activeRequest = null
        return true
    }
}

internal enum class LocationSettingsRequestPhase {
    CHECKING,
    AWAITING_RESOLUTION,
    COMPLETING
}

internal enum class LocationSettingsFailureAction {
    SHOW_RESOLUTION,
    COMPLETE_UNAVAILABLE,
    COMPLETE_ACTIVITY_MISSING,
    REJECT_REQUEST
}

internal enum class LocationSettingsFailureKind {
    RESOLVABLE,
    SETTINGS_CHANGE_UNAVAILABLE,
    CANCELLED,
    UNEXPECTED
}

internal fun selectLocationSettingsFailureAction(
    shouldShowResolution: Boolean,
    failureKind: LocationSettingsFailureKind,
    hasActivity: Boolean
): LocationSettingsFailureAction {
    if (failureKind == LocationSettingsFailureKind.CANCELLED ||
        failureKind == LocationSettingsFailureKind.UNEXPECTED) {
        return LocationSettingsFailureAction.REJECT_REQUEST
    }

    if (failureKind == LocationSettingsFailureKind.SETTINGS_CHANGE_UNAVAILABLE ||
        !shouldShowResolution) {
        return LocationSettingsFailureAction.COMPLETE_UNAVAILABLE
    }

    return if (hasActivity) {
        LocationSettingsFailureAction.SHOW_RESOLUTION
    } else {
        LocationSettingsFailureAction.COMPLETE_ACTIVITY_MISSING
    }
}

internal fun classifyLocationSettingsFailure(
    exception: Exception
): LocationSettingsFailureKind {
    if (exception is ResolvableApiException) {
        return LocationSettingsFailureKind.RESOLVABLE
    }

    if (exception is ApiException &&
        exception.statusCode == LocationSettingsStatusCodes.SETTINGS_CHANGE_UNAVAILABLE) {
        return LocationSettingsFailureKind.SETTINGS_CHANGE_UNAVAILABLE
    }

    return LocationSettingsFailureKind.UNEXPECTED
}

internal fun <T : Any> runLocationSettingsOperation(
    onFailure: (Exception) -> Unit,
    operation: () -> T
): T? {
    return try {
        operation()
    } catch (exception: Exception) {
        onFailure(exception)
        null
    }
}
