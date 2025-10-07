package com.margelo.nitro.nitrogeolocation

import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.NitroModules

@DoNotStrip
class NitroGeolocation(
        private val reactContext: ReactApplicationContext = NitroModules.applicationContext!!
) : HybridNitroGeolocationSpec() {
    private var configuration: RNConfigurationInternal =
            RNConfigurationInternal(
                    skipPermissionRequests = false,
                    authorizationLevel = null,
                    enableBackgroundLocationUpdates = null,
                    locationProvider = null
            )

    private val requestAuthorizationHandler by lazy {
        RequestAuthorization(
                reactContext = reactContext,
                onPermissionResult = { result, success, error ->
                    when (result) {
                        is PermissionResult.Granted -> success?.invoke()
                        is PermissionResult.Denied ->
                                error?.invoke(
                                        createPermissionError(
                                                "Location permission was not granted."
                                        )
                                )
                    }
                }
        )
    }

    private val watchPositionHandler by lazy { WatchPosition(reactContext) }

    override fun setRNConfiguration(config: RNConfigurationInternal) {
        configuration = config
    }

    override fun requestAuthorization(
            success: (() -> Unit)?,
            error: ((error: GeolocationError) -> Unit)?
    ) {
        requestAuthorizationHandler.execute(success, error)
    }

    override fun getCurrentPosition(
            success: (position: GeolocationResponse) -> Unit,
            error: ((error: GeolocationError) -> Unit)?,
            options: GeolocationOptions?
    ) {
        GetCurrentPosition(reactContext).execute(success, error, options)
    }

    override fun watchPosition(
            success: (position: GeolocationResponse) -> Unit,
            error: ((error: GeolocationError) -> Unit)?,
            options: GeolocationOptions?
    ): Double {
        return watchPositionHandler.watch(success, error, options).toDouble()
    }

    override fun clearWatch(watchId: Double) {
        watchPositionHandler.clearWatch(watchId.toInt())
    }

    override fun stopObserving() {
        watchPositionHandler.stopObserving()
    }

    private fun createPermissionError(message: String) =
            GeolocationError(
                    code = RequestAuthorization.PERMISSION_DENIED.toDouble(),
                    message = message,
                    PERMISSION_DENIED = RequestAuthorization.PERMISSION_DENIED.toDouble(),
                    POSITION_UNAVAILABLE = RequestAuthorization.POSITION_UNAVAILABLE.toDouble(),
                    TIMEOUT = RequestAuthorization.TIMEOUT.toDouble()
            )
}
