package com.margelo.nitro.nitrogeolocation

import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise

@DoNotStrip
class NitroGeolocation : HybridNitroGeolocationSpec() {
    override fun helloWorld(): Promise<String> {
        return Promise.async {
            "Hello World from Android!"
        }
    }
}
