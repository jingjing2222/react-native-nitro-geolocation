package com.margelo.nitro.nitrogeolocation

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

// ===== Data Models =====
sealed class PermissionState {
    object LegacyAndroid : PermissionState()
    object AlreadyGranted : PermissionState()
    object NeedsRequest : PermissionState()
    data class Error(val message: String) : PermissionState()
}

sealed class PermissionResult {
    object Granted : PermissionResult()
    object Denied : PermissionResult()
}

class RequestAuthorization(
        private val reactContext: ReactApplicationContext,
        private val onPermissionResult:
                (PermissionResult, (() -> Unit)?, ((GeolocationError) -> Unit)?) -> Unit
) {
    private var pendingAuthSuccess: (() -> Unit)? = null
    private var pendingAuthError: ((error: GeolocationError) -> Unit)? = null

    fun execute(success: (() -> Unit)?, error: ((error: GeolocationError) -> Unit)?) {
        val state = determinePermissionState()
        executePermissionAction(state, success, error)
    }

    // ===== State Determination (Pure Functions) =====
    private fun determinePermissionState(): PermissionState =
            when {
                isLegacyAndroid() -> PermissionState.LegacyAndroid
                else -> determineModernAndroidState()
            }

    private fun determineModernAndroidState(): PermissionState =
            when {
                hasLocationPermission(reactContext) -> PermissionState.AlreadyGranted
                reactContext.currentActivity == null ->
                        PermissionState.Error("Current activity is null")
                else -> PermissionState.NeedsRequest
            }

    private fun isLegacyAndroid(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.M

    private fun hasLocationPermission(context: ReactApplicationContext): Boolean =
            LOCATION_PERMISSIONS.any { permission ->
                ContextCompat.checkSelfPermission(context, permission) ==
                        PackageManager.PERMISSION_GRANTED
            }

    private fun determinePermissionResult(
            permissions: Array<String>,
            grantResults: IntArray
    ): PermissionResult {
        val hasGrantedPermission =
                permissions.indices.any { i ->
                    isLocationPermission(permissions[i]) &&
                            grantResults[i] == PackageManager.PERMISSION_GRANTED
                }

        return when {
            hasGrantedPermission -> PermissionResult.Granted
            else -> PermissionResult.Denied
        }
    }

    private fun isLocationPermission(permission: String): Boolean =
            permission in LOCATION_PERMISSIONS

    // ===== Actions (Side Effects) =====
    private fun executePermissionAction(
            state: PermissionState,
            success: (() -> Unit)?,
            error: ((error: GeolocationError) -> Unit)?
    ) {
        when (state) {
            is PermissionState.LegacyAndroid -> success?.invoke()
            is PermissionState.AlreadyGranted -> success?.invoke()
            is PermissionState.NeedsRequest -> showPermissionDialog(success, error)
            is PermissionState.Error -> error?.invoke(createPermissionError(state.message))
        }
    }

    private fun showPermissionDialog(
            success: (() -> Unit)?,
            error: ((error: GeolocationError) -> Unit)?
    ) {
        pendingAuthSuccess = success
        pendingAuthError = error

        reactContext.currentActivity?.let { activity ->
            requestPermissionsFromActivity(activity)
        }
    }

    private fun requestPermissionsFromActivity(activity: android.app.Activity) {
        val permissions = LOCATION_PERMISSIONS.toTypedArray()

        when (val permissionAware = activity as? PermissionAwareActivity) {
            null ->
                    ActivityCompat.requestPermissions(
                            activity,
                            permissions,
                            PERMISSION_REQUEST_CODE
                    )
            else ->
                    permissionAware.requestPermissions(
                            permissions,
                            PERMISSION_REQUEST_CODE,
                            createPermissionListener()
                    )
        }
    }

    private fun createPermissionListener() =
            PermissionListener { requestCode, permissions, grantResults ->
                when (requestCode) {
                    PERMISSION_REQUEST_CODE -> {
                        val result = determinePermissionResult(permissions, grantResults)
                        onPermissionResult(result, pendingAuthSuccess, pendingAuthError)
                        clearPendingCallbacks()
                        true
                    }
                    else -> false
                }
            }

    private fun clearPendingCallbacks() {
        pendingAuthSuccess = null
        pendingAuthError = null
    }

    private fun createPermissionError(message: String) =
            GeolocationError(
                    code = PERMISSION_DENIED.toDouble(),
                    message = message,
                    PERMISSION_DENIED = PERMISSION_DENIED.toDouble(),
                    POSITION_UNAVAILABLE = POSITION_UNAVAILABLE.toDouble(),
                    TIMEOUT = TIMEOUT.toDouble()
            )

    companion object {
        const val PERMISSION_DENIED = 1
        const val POSITION_UNAVAILABLE = 2
        const val TIMEOUT = 3
        const val PERMISSION_REQUEST_CODE = 2025

        private val LOCATION_PERMISSIONS =
                listOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                )
    }
}
