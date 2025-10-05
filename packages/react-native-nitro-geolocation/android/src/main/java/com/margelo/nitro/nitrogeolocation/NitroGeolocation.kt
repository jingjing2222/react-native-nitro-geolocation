package com.margelo.nitro.nitrogeolocation

import com.facebook.proguard.annotations.DoNotStrip
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

    private val requestAuthorizationHandler by lazy {
        RequestAuthorization(
                reactContext = NitroModules.applicationContext!!,
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

    override fun setRNConfiguration(config: RNConfigurationInternal) {
        configuration = config
    }

    override fun requestAuthorization(
            success: (() -> Unit)?,
            error: ((error: GeolocationError) -> Unit)?
    ) {
        requestAuthorizationHandler.execute(success, error)
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
