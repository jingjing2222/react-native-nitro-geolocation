package com.margelo.nitro.nitrogeolocation

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.IntentSender
import android.content.pm.PackageManager
import android.location.LocationManager as AndroidLocationManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.LocationRequest as GmsLocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationSettingsRequest
import com.google.android.gms.location.Priority
import java.util.concurrent.atomic.AtomicBoolean

private const val LOCATION_SETTINGS_REQUEST_CODE = 8948
private const val GOOGLE_LOCATION_ACCURACY_TIMEOUT_MS = 2_000L

internal class AndroidLocationSettings(
    private val reactContext: ReactApplicationContext,
    private val locationManager: AndroidLocationManager,
    private val createLocationError: (Double, String) -> LocationError,
    private val createPlayServicesUnavailableError: () -> LocationError
) {
    private data class ParsedSettingsOptions(
        val enableHighAccuracy: Boolean,
        val intervalMillis: Long,
        val fastestIntervalMillis: Long,
        val distanceFilterMeters: Float,
        val alwaysShow: Boolean,
        val needBle: Boolean
    ) {
        companion object {
            private const val DEFAULT_INTERVAL_MS = 5_000.0
            private const val DEFAULT_FASTEST_INTERVAL_MS = 1_000.0
            private const val DEFAULT_DISTANCE_FILTER_METERS = 0.0

            fun parse(options: LocationSettingsOptions?): ParsedSettingsOptions {
                return ParsedSettingsOptions(
                    enableHighAccuracy = options?.enableHighAccuracy ?: true,
                    intervalMillis = coercePositiveMillis(
                        options?.interval,
                        DEFAULT_INTERVAL_MS
                    ),
                    fastestIntervalMillis = coercePositiveMillis(
                        options?.fastestInterval,
                        DEFAULT_FASTEST_INTERVAL_MS
                    ),
                    distanceFilterMeters = (options?.distanceFilter
                        ?: DEFAULT_DISTANCE_FILTER_METERS)
                        .coerceAtLeast(0.0)
                        .toFloat(),
                    alwaysShow = options?.alwaysShow ?: true,
                    needBle = options?.needBle ?: false
                )
            }

            private fun coercePositiveMillis(value: Double?, defaultValue: Double): Long {
                val nextValue = value ?: defaultValue
                return when {
                    nextValue.isNaN() || nextValue <= 0.0 -> defaultValue.toLong()
                    nextValue.isInfinite() || nextValue >= Long.MAX_VALUE.toDouble() -> Long.MAX_VALUE
                    else -> nextValue.toLong()
                }
            }
        }
    }

    private data class PendingLocationSettingsRequest(
        val success: (LocationProviderStatus) -> Unit,
        val error: ((LocationError) -> Unit)?,
        val options: ParsedSettingsOptions
    )

    private var pendingLocationSettingsRequest: PendingLocationSettingsRequest? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?
        ) {
            if (requestCode != LOCATION_SETTINGS_REQUEST_CODE) return

            val pendingRequest = pendingLocationSettingsRequest ?: return
            pendingLocationSettingsRequest = null

            if (resultCode == Activity.RESULT_OK) {
                checkLocationSettings(pendingRequest, shouldShowResolution = false)
                return
            }

            pendingRequest.error?.invoke(createLocationError(
                SETTINGS_NOT_SATISFIED,
                "Location settings change was cancelled."
            ))
        }
    }

    init {
        reactContext.addActivityEventListener(activityEventListener)
    }

    fun hasServicesEnabled(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            locationManager.isLocationEnabled
        } else {
            isProviderEnabled(AndroidLocationManager.GPS_PROVIDER) ||
                isProviderEnabled(AndroidLocationManager.NETWORK_PROVIDER)
        }
    }

    fun getProviderStatus(success: (LocationProviderStatus) -> Unit) {
        getGoogleLocationAccuracyEnabled { googleLocationAccuracyEnabled ->
            success(createProviderStatus(googleLocationAccuracyEnabled))
        }
    }

    private fun createProviderStatus(
        googleLocationAccuracyEnabled: Boolean?
    ): LocationProviderStatus {
        return LocationProviderStatus(
            locationServicesEnabled = hasServicesEnabled(),
            backgroundModeEnabled = hasBackgroundLocationPermission(),
            gpsAvailable = isProviderEnabled(AndroidLocationManager.GPS_PROVIDER),
            networkAvailable = isProviderEnabled(AndroidLocationManager.NETWORK_PROVIDER),
            passiveAvailable = isProviderEnabled(AndroidLocationManager.PASSIVE_PROVIDER),
            googleLocationAccuracyEnabled = googleLocationAccuracyEnabled
        )
    }

    fun requestLocationSettings(
        success: (LocationProviderStatus) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: LocationSettingsOptions?
    ) {
        if (!isGooglePlayServicesAvailable()) {
            error?.invoke(createPlayServicesUnavailableError())
            return
        }

        if (pendingLocationSettingsRequest != null) {
            error?.invoke(createLocationError(
                INTERNAL_ERROR,
                "A location settings request is already in progress."
            ))
            return
        }

        val pendingRequest = PendingLocationSettingsRequest(
            success = success,
            error = error,
            options = ParsedSettingsOptions.parse(options)
        )

        checkLocationSettings(pendingRequest, shouldShowResolution = true)
    }

    private fun checkLocationSettings(
        pendingRequest: PendingLocationSettingsRequest,
        shouldShowResolution: Boolean
    ) {
        val settingsClient = LocationServices.getSettingsClient(reactContext)
        settingsClient
            .checkLocationSettings(buildLocationSettingsRequest(pendingRequest.options))
            .addOnSuccessListener {
                getProviderStatus(pendingRequest.success)
            }
            .addOnFailureListener { exception ->
                if (shouldShowResolution && exception is ResolvableApiException) {
                    showResolutionDialog(exception, pendingRequest)
                    return@addOnFailureListener
                }

                pendingRequest.error?.invoke(createLocationError(
                    SETTINGS_NOT_SATISFIED,
                    "Location settings do not satisfy the requested options."
                ))
            }
    }

    private fun showResolutionDialog(
        exception: ResolvableApiException,
        pendingRequest: PendingLocationSettingsRequest
    ) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            pendingRequest.error?.invoke(createLocationError(
                INTERNAL_ERROR,
                "No activity available to request location settings."
            ))
            return
        }

        pendingLocationSettingsRequest = pendingRequest

        try {
            exception.startResolutionForResult(activity, LOCATION_SETTINGS_REQUEST_CODE)
        } catch (e: IntentSender.SendIntentException) {
            pendingLocationSettingsRequest = null
            pendingRequest.error?.invoke(createLocationError(
                INTERNAL_ERROR,
                "Failed to show location settings dialog: ${e.message}"
            ))
        }
    }

    private fun buildLocationSettingsRequest(
        options: ParsedSettingsOptions
    ): LocationSettingsRequest {
        val priority = if (options.enableHighAccuracy) {
            Priority.PRIORITY_HIGH_ACCURACY
        } else {
            Priority.PRIORITY_BALANCED_POWER_ACCURACY
        }

        val request = GmsLocationRequest
            .Builder(priority, options.intervalMillis)
            .setMinUpdateIntervalMillis(options.fastestIntervalMillis)
            .setMinUpdateDistanceMeters(options.distanceFilterMeters)
            .build()

        return LocationSettingsRequest
            .Builder()
            .addLocationRequest(request)
            .setAlwaysShow(options.alwaysShow)
            .setNeedBle(options.needBle)
            .build()
    }

    private fun isProviderEnabled(provider: String): Boolean {
        return try {
            locationManager.isProviderEnabled(provider)
        } catch (e: Exception) {
            false
        }
    }

    private fun hasBackgroundLocationPermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true

        return ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_BACKGROUND_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun getGoogleLocationAccuracyEnabled(success: (Boolean?) -> Unit) {
        if (!isGooglePlayServicesAvailable()) {
            success(null)
            return
        }

        val didComplete = AtomicBoolean(false)
        val timeoutRunnable = Runnable {
            if (didComplete.compareAndSet(false, true)) {
                success(null)
            }
        }

        fun complete(value: Boolean?) {
            if (didComplete.compareAndSet(false, true)) {
                mainHandler.removeCallbacks(timeoutRunnable)
                success(value)
            }
        }

        mainHandler.postDelayed(timeoutRunnable, GOOGLE_LOCATION_ACCURACY_TIMEOUT_MS)

        try {
            LocationServices
                .getSettingsClient(reactContext)
                .isGoogleLocationAccuracyEnabled
                .addOnSuccessListener { enabled ->
                    complete(enabled)
                }
                .addOnFailureListener {
                    complete(null)
                }
                .addOnCanceledListener {
                    complete(null)
                }
        } catch (e: Exception) {
            complete(null)
        }
    }

    private fun isGooglePlayServicesAvailable(): Boolean {
        return GoogleApiAvailability.getInstance()
            .isGooglePlayServicesAvailable(reactContext) == ConnectionResult.SUCCESS
    }

    private companion object {
        private const val INTERNAL_ERROR = -1.0
        private const val SETTINGS_NOT_SATISFIED = 5.0
    }
}
