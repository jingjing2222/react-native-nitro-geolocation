package com.margelo.nitro.nitrogeolocation

import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.margelo.nitro.nitrogeolocation.background.NitroBackgroundLocationController

@DoNotStrip
class NitroBackgroundLocation(
    private val reactContext: ReactApplicationContext = NitroModules.applicationContext!!
) : HybridNitroBackgroundLocationSpec() {

    private val controller by lazy {
        NitroBackgroundLocationController.getInstance(reactContext)
    }

    override fun checkBackgroundPermission(): Promise<BackgroundPermissionResult> {
        return Promise.async { controller.checkBackgroundPermission() }
    }

    override fun requestBackgroundPermission(): Promise<BackgroundPermissionResult> {
        return Promise.async { controller.requestBackgroundPermission(reactContext) }
    }

    override fun openAppLocationSettings(): Promise<Unit> {
        return Promise.async { controller.openAppLocationSettings() }
    }

    override fun configureBackgroundLocation(options: BackgroundLocationOptions): Promise<Unit> {
        return Promise.async { controller.configure(options) }
    }

    override fun getBackgroundConfiguration(): Promise<BackgroundLocationOptions?> {
        return Promise.async { controller.getConfigOrNull() }
    }

    override fun startBackgroundLocation(options: BackgroundLocationOptions?): Promise<Unit> {
        return Promise.async { controller.start(options) }
    }

    override fun stopBackgroundLocation(): Promise<Unit> {
        return Promise.async { controller.stop() }
    }

    override fun resetBackgroundLocation(): Promise<Unit> {
        return Promise.async { controller.reset() }
    }

    override fun getBackgroundLocationStatus(): Promise<BackgroundLocationStatus> {
        return Promise.async { controller.getStatus() }
    }

    override fun addBackgroundEventListener(listener: (event: BackgroundEventEnvelope) -> Unit): String {
        return controller.eventHub.addEventListener(listener)
    }

    override fun removeBackgroundEventListener(token: String) {
        controller.eventHub.removeEventListener(token)
    }

    override fun addBackgroundLocationListener(listener: (location: BackgroundLocation) -> Unit): String {
        return controller.eventHub.addLocationListener(listener)
    }

    override fun removeBackgroundLocationListener(token: String) {
        controller.eventHub.removeLocationListener(token)
    }

    override fun addBackgroundErrorListener(listener: (error: LocationError) -> Unit): String {
        return controller.eventHub.addErrorListener(listener)
    }

    override fun removeBackgroundErrorListener(token: String) {
        controller.eventHub.removeErrorListener(token)
    }

    override fun getStoredBackgroundLocations(
        options: GetStoredBackgroundLocationsOptions?
    ): Promise<Array<StoredBackgroundLocation>> {
        return Promise.async { controller.store.getLocations(options) }
    }

    override fun clearStoredBackgroundLocations(ids: Array<String>?): Promise<Unit> {
        return Promise.async { controller.store.clearLocations(ids) }
    }

    override fun markStoredBackgroundLocationsDelivered(ids: Array<String>): Promise<Unit> {
        return Promise.async { controller.store.markLocationsDelivered(ids) }
    }

    override fun getStoredBackgroundEvents(
        options: GetStoredBackgroundEventsOptions?
    ): Promise<Array<StoredBackgroundEventEnvelope>> {
        return Promise.async { controller.store.getEvents(options) }
    }

    override fun clearStoredBackgroundEvents(ids: Array<String>?): Promise<Unit> {
        return Promise.async { controller.store.clearEvents(ids) }
    }

    override fun markStoredBackgroundEventsDelivered(ids: Array<String>): Promise<Unit> {
        return Promise.async { controller.store.markEventsDelivered(ids) }
    }

    override fun addGeofences(
        regions: Array<GeofenceRegion>,
        options: GeofencingOptions?
    ): Promise<Unit> {
        return Promise.async { controller.addGeofences(regions, options) }
    }

    override fun removeGeofences(identifiers: Array<String>?): Promise<Unit> {
        return Promise.async { controller.removeGeofences(identifiers) }
    }

    override fun getRegisteredGeofences(): Promise<Array<GeofenceRegion>> {
        return Promise.async { controller.store.getGeofences() }
    }

    override fun startActivityRecognition(options: ActivityRecognitionOptions?): Promise<Unit> {
        return Promise.async { controller.startActivityRecognition(options) }
    }

    override fun stopActivityRecognition(): Promise<Unit> {
        return Promise.async { controller.stopActivityRecognition() }
    }

    override fun syncStoredLocations(): Promise<BackgroundHttpSyncResult> {
        return Promise.async { controller.syncStoredLocations() }
    }
}
