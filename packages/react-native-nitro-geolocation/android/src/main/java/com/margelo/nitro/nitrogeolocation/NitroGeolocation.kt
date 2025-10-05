package com.margelo.nitro.nitrogeolocation

import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class NitroGeolocation : HybridNitroGeolocationSpec() {
    private var configuration: RNConfiguration = RNConfiguration(
        skipPermissionRequests = false,
        authorizationLevel = null,
        enableBackgroundLocationUpdates = null,
        locationProvider = null
    )

    override fun setRNConfiguration(config: RNConfiguration) {
        configuration = config
    }
}
