package com.margelo.nitro.nitrogeolocation.background

/** Process-local observation of the actual Android foreground-service lifecycle. */
internal object NitroBackgroundServiceState {
    @Volatile
    var isForeground: Boolean = false
        private set

    fun promoted() {
        isForeground = true
    }

    fun stopped() {
        isForeground = false
    }
}
