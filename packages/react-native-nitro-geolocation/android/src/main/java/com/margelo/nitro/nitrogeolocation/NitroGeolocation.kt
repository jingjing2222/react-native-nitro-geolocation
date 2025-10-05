package com.margelo.nitro.nitrogeolocation

import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class NitroGeolocation : HybridNitroGeolocationSpec() {
    private var configuration: RNConfigurationInternal = RNConfigurationInternal(
        skipPermissionRequests = false,
        authorizationLevel = null,
        enableBackgroundLocationUpdates = null,
        locationProvider = null
    )

    override fun setRNConfiguration(config: RNConfigurationInternal) {
        configuration = config
    }
}
