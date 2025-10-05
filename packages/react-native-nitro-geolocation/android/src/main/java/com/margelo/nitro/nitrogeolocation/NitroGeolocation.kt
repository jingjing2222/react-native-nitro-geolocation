package com.margelo.nitro.nitrogeolocation

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import com.margelo.nitro.NitroModules

@DoNotStrip
class NitroGeolocation : HybridNitroGeolocationSpec() {
    private var configuration: RNConfigurationInternal =
            RNConfigurationInternal(
                    skipPermissionRequests = false,
                    authorizationLevel = null,
                    enableBackgroundLocationUpdates = null,
                    locationProvider = null
            )

    private var pendingAuthSuccess: (() -> Unit)? = null
    private var pendingAuthError: ((error: GeolocationError) -> Unit)? = null

    override fun setRNConfiguration(config: RNConfigurationInternal) {
        configuration = config
    }

    override fun requestAuthorization(
            success: (() -> Unit)?,
            error: ((error: GeolocationError) -> Unit)?
    ) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            success?.invoke()
            return
        }

        val context = NitroModules.applicationContext
        if (context == null) {
            error?.invoke(buildError(PERMISSION_DENIED, "ReactApplicationContext is null"))
            return
        }

        val finePermission =
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
        val coarsePermission =
                ContextCompat.checkSelfPermission(
                        context,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                )

        // Already granted
        if (finePermission == PackageManager.PERMISSION_GRANTED ||
                        coarsePermission == PackageManager.PERMISSION_GRANTED
        ) {
            success?.invoke()
            return
        }

        // Request permissions
        val currentActivity = context.currentActivity
        if (currentActivity == null) {
            error?.invoke(buildError(PERMISSION_DENIED, "Current activity is null"))
            return
        }

        pendingAuthSuccess = success
        pendingAuthError = error

        val permissionAwareActivity = currentActivity as? PermissionAwareActivity
        if (permissionAwareActivity != null) {
            permissionAwareActivity.requestPermissions(
                    arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                    ),
                    PERMISSION_REQUEST_CODE,
                    permissionListener
            )
        } else {
            ActivityCompat.requestPermissions(
                    currentActivity,
                    arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                    ),
                    PERMISSION_REQUEST_CODE
            )
        }
    }

    private val permissionListener =
            PermissionListener { requestCode, permissions, grantResults ->
                if (requestCode == PERMISSION_REQUEST_CODE) {
                    var granted = false
                    for (i in permissions.indices) {
                        if (permissions[i] == Manifest.permission.ACCESS_FINE_LOCATION ||
                                        permissions[i] == Manifest.permission.ACCESS_COARSE_LOCATION
                        ) {
                            if (grantResults[i] == PackageManager.PERMISSION_GRANTED) {
                                granted = true
                                break
                            }
                        }
                    }

                    if (granted) {
                        pendingAuthSuccess?.invoke()
                    } else {
                        pendingAuthError?.invoke(
                                buildError(PERMISSION_DENIED, "Location permission was not granted.")
                        )
                    }

                    pendingAuthSuccess = null
                    pendingAuthError = null
                    return@PermissionListener true
                }
                return@PermissionListener false
            }

    private fun buildError(code: Int, message: String): GeolocationError {
        return GeolocationError(
                code = code.toDouble(),
                message = message,
                PERMISSION_DENIED = PERMISSION_DENIED.toDouble(),
                POSITION_UNAVAILABLE = POSITION_UNAVAILABLE.toDouble(),
                TIMEOUT = TIMEOUT.toDouble()
        )
    }

    companion object {
        const val PERMISSION_DENIED = 1
        const val POSITION_UNAVAILABLE = 2
        const val TIMEOUT = 3
        const val PERMISSION_REQUEST_CODE = 2025
    }
}
