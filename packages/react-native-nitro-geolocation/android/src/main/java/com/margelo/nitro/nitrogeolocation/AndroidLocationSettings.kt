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
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.LocationRequest as GmsLocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationSettingsRequest
import com.google.android.gms.location.LocationSettingsStatusCodes
import com.google.android.gms.location.Priority
import java.util.concurrent.atomic.AtomicBoolean

private const val LOCATION_SETTINGS_REQUEST_CODE = 8948
private const val GOOGLE_LOCATION_ACCURACY_TIMEOUT_MS = 2_000L

internal class AndroidLocationSettings(
    private val reactContext: ReactApplicationContext,
    private val locationManager: AndroidLocationManager,
    private val createLocationError: (Double, String) -> LocationError
) {
    private data class ParsedSettingsOptions(
        val androidAccuracy: AndroidAccuracyResolution,
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
                    androidAccuracy = resolveAndroidAccuracy(
                        options?.accuracy,
                        enableHighAccuracy = true
                    ),
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
        val success: (LocationSettingsResult) -> Unit,
        val error: ((LocationError) -> Unit)?,
        val options: ParsedSettingsOptions
    )

    private val locationSettingsRequestGate =
        LocationSettingsRequestGate<PendingLocationSettingsRequest>()
    private val mainHandler = Handler(Looper.getMainLooper())

    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?
        ) {
            if (requestCode != LOCATION_SETTINGS_REQUEST_CODE) return

            val pendingRequest =
                locationSettingsRequestGate.consumeResolutionResult() ?: return

            if (resultCode == Activity.RESULT_OK) {
                checkLocationSettings(pendingRequest, shouldShowResolution = false)
                return
            }

            completeRequest(pendingRequest, LocationSettingsOutcome.CANCELLED)
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
        val googlePlayServicesAvailable = isGooglePlayServicesAvailable()

        return LocationProviderStatus(
            locationServicesEnabled = hasServicesEnabled(),
            backgroundModeEnabled = hasBackgroundLocationPermission(),
            gpsAvailable = isProviderEnabled(AndroidLocationManager.GPS_PROVIDER),
            networkAvailable = isProviderEnabled(AndroidLocationManager.NETWORK_PROVIDER),
            passiveAvailable = isProviderEnabled(AndroidLocationManager.PASSIVE_PROVIDER),
            googlePlayServicesAvailable = googlePlayServicesAvailable,
            googleLocationAccuracyEnabled = googleLocationAccuracyEnabled
        )
    }

    fun requestLocationSettings(
        success: (LocationSettingsResult) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: LocationSettingsOptions?
    ) {
        val pendingRequest = PendingLocationSettingsRequest(
            success = success,
            error = error,
            options = ParsedSettingsOptions.parse(options)
        )

        if (!locationSettingsRequestGate.tryBegin(pendingRequest)) {
            error?.invoke(createLocationError(
                INTERNAL_ERROR,
                "A location settings request is already in progress."
            ))
            return
        }

        if (!isGooglePlayServicesAvailable()) {
            completeRequest(pendingRequest, LocationSettingsOutcome.UNAVAILABLE)
            return
        }

        checkLocationSettings(pendingRequest, shouldShowResolution = true)
    }

    private fun checkLocationSettings(
        pendingRequest: PendingLocationSettingsRequest,
        shouldShowResolution: Boolean
    ) {
        try {
            val settingsClient = LocationServices.getSettingsClient(reactContext)
            settingsClient
                .checkLocationSettings(buildLocationSettingsRequest(pendingRequest.options))
                .addOnSuccessListener {
                    completeRequest(pendingRequest, LocationSettingsOutcome.SATISFIED)
                }
                .addOnFailureListener { exception ->
                    handleLocationSettingsFailure(
                        pendingRequest = pendingRequest,
                        shouldShowResolution = shouldShowResolution,
                        failureKind = classifyLocationSettingsFailure(exception),
                        exception = exception
                    )
                }
                .addOnCanceledListener {
                    handleLocationSettingsFailure(
                        pendingRequest = pendingRequest,
                        shouldShowResolution = shouldShowResolution,
                        failureKind = LocationSettingsFailureKind.CANCELLED
                    )
                }
        } catch (exception: Exception) {
            rejectRequest(
                pendingRequest,
                "Failed to start the location settings check: ${exception.message ?: exception.javaClass.simpleName}"
            )
        }
    }

    private fun handleLocationSettingsFailure(
        pendingRequest: PendingLocationSettingsRequest,
        shouldShowResolution: Boolean,
        failureKind: LocationSettingsFailureKind,
        exception: Exception? = null
    ) {
        val activity = reactContext.currentActivity
        when (selectLocationSettingsFailureAction(
            shouldShowResolution = shouldShowResolution,
            failureKind = failureKind,
            hasActivity = activity != null
        )) {
            LocationSettingsFailureAction.SHOW_RESOLUTION -> {
                showResolutionDialog(
                    exception as ResolvableApiException,
                    activity!!,
                    pendingRequest
                )
            }
            LocationSettingsFailureAction.COMPLETE_ACTIVITY_MISSING -> {
                completeRequest(
                    pendingRequest,
                    LocationSettingsOutcome.ACTIVITYMISSING
                )
            }
            LocationSettingsFailureAction.COMPLETE_UNAVAILABLE -> {
                completeRequest(
                    pendingRequest,
                    LocationSettingsOutcome.UNAVAILABLE
                )
            }
            LocationSettingsFailureAction.REJECT_REQUEST -> {
                val message = if (failureKind == LocationSettingsFailureKind.CANCELLED) {
                    "The location settings check was cancelled before it completed."
                } else {
                    "Failed to check location settings: ${exception?.message ?: exception?.javaClass?.simpleName ?: "unknown error"}"
                }
                rejectRequest(pendingRequest, message)
            }
        }
    }

    private fun showResolutionDialog(
        exception: ResolvableApiException,
        activity: Activity,
        pendingRequest: PendingLocationSettingsRequest
    ) {
        if (!locationSettingsRequestGate.beginAwaitingResolution(pendingRequest)) return

        try {
            exception.startResolutionForResult(activity, LOCATION_SETTINGS_REQUEST_CODE)
        } catch (_: IntentSender.SendIntentException) {
            completeRequest(pendingRequest, LocationSettingsOutcome.UNAVAILABLE)
        }
    }

    private fun completeRequest(
        pendingRequest: PendingLocationSettingsRequest,
        outcome: LocationSettingsOutcome
    ) {
        if (!locationSettingsRequestGate.beginCompleting(pendingRequest)) return

        getProviderStatus { providerStatus ->
            if (!locationSettingsRequestGate.finish(pendingRequest)) return@getProviderStatus

            pendingRequest.success(LocationSettingsResult(
                outcome = outcome,
                providerStatus = providerStatus
            ))
        }
    }

    private fun rejectRequest(
        pendingRequest: PendingLocationSettingsRequest,
        message: String
    ) {
        if (!locationSettingsRequestGate.finish(pendingRequest)) return

        pendingRequest.error?.invoke(createLocationError(INTERNAL_ERROR, message))
    }

    private fun buildLocationSettingsRequest(
        options: ParsedSettingsOptions
    ): LocationSettingsRequest {
        val priority = when (options.androidAccuracy.mode) {
            AndroidAccuracyMode.HIGH -> Priority.PRIORITY_HIGH_ACCURACY
            AndroidAccuracyMode.BALANCED -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
            AndroidAccuracyMode.LOW -> Priority.PRIORITY_LOW_POWER
            AndroidAccuracyMode.PASSIVE -> Priority.PRIORITY_PASSIVE
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
    }
}

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
