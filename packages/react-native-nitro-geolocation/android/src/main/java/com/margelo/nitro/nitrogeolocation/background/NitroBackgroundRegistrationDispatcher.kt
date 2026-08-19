package com.margelo.nitro.nitrogeolocation.background

import com.margelo.nitro.nitrogeolocation.BackgroundEventEnvelope

internal class NitroBackgroundRegistrationDispatcher(
    private val registrations: NitroBackgroundRegistrations,
    private val eventDispatcher: NitroBackgroundEventDispatcher,
    private val activeServiceGeneration: () -> Long?
) {
    fun dispatchLocation(
        event: BackgroundEventEnvelope,
        callbackGeneration: Long,
        registrationGeneration: Long,
        beforeDispatch: () -> Unit
    ): Boolean {
        val owner = activeServiceGeneration() ?: return false
        return registrations.withCurrentLocation(registrationGeneration, owner) {
            beforeDispatch()
            eventDispatcher.dispatch(event, callbackGeneration, owner)
            true
        } ?: false
    }

    fun dispatchActivity(
        event: BackgroundEventEnvelope,
        callbackGeneration: Long,
        registrationGeneration: Long,
        beforeDispatch: () -> Unit
    ): Boolean {
        val activeService = activeServiceGeneration()
        return registrations.withCurrentActivity(registrationGeneration, activeService) { owner ->
            beforeDispatch()
            eventDispatcher.dispatch(event, callbackGeneration, owner)
            true
        } ?: false
    }
}
