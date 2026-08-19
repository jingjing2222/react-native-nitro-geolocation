package com.margelo.nitro.nitrogeolocation.background

import android.content.SharedPreferences

internal const val PREF_SERVICE_GENERATION = "serviceGeneration"
private const val PREF_LOCATION_REGISTRATION_GENERATION = "locationRegistrationGeneration"
private const val PREF_LOCATION_REGISTRATION_ACTIVE = "locationRegistrationActive"
private const val PREF_LOCATION_REGISTRATION_OWNER = "locationRegistrationOwner"
private const val PREF_ACTIVITY_REGISTRATION_GENERATION = "activityRegistrationGeneration"
private const val PREF_ACTIVITY_CONFIRMED_GENERATION = "activityConfirmedGeneration"
private const val PREF_ACTIVITY_REGISTRATION_ACTIVE = "activityRegistrationActive"
private const val PREF_ACTIVITY_REGISTRATION_OWNER = "activityRegistrationOwner"
private const val PREF_ACTIVITY_STANDALONE_REQUESTED = "activityStandaloneRequested"
private const val NO_SERVICE_OWNER = Long.MIN_VALUE

internal data class BackgroundRegistration(
    val generation: Long,
    val ownerServiceGeneration: Long?
)

internal data class BackgroundActivityRegistration(
    val generation: Long,
    val backgroundOwner: Long?,
    val standaloneRequested: Boolean
)

internal data class BackgroundActivityRequest(
    val generation: Long,
    val owner: Long?,
    val ownerVersion: Long,
    val introducedOwner: Boolean
)

internal data class BackgroundActivityConfirmation(
    val accepted: Boolean,
    val previous: BackgroundActivityRegistration?
)

/** Registration identities survive process restarts and change on every provider registration. */
internal class NitroBackgroundRegistrations(private val prefs: SharedPreferences) {
    @Volatile
    private var serviceGeneration = prefs.getLong(PREF_SERVICE_GENERATION, 0L)
    private var locationGeneration = prefs.getLong(PREF_LOCATION_REGISTRATION_GENERATION, 0L)
    private var locationActive = prefs.getBoolean(PREF_LOCATION_REGISTRATION_ACTIVE, false)
    private var locationOwner = prefs.owner(PREF_LOCATION_REGISTRATION_OWNER)
    private var activityGeneration = prefs.getLong(PREF_ACTIVITY_REGISTRATION_GENERATION, 0L)
    private var activityConfirmedGeneration = prefs.getLong(
        PREF_ACTIVITY_CONFIRMED_GENERATION,
        activityGeneration
    )
    private var latestActivityRequestGeneration = 0L
    private var activityActive = prefs.getBoolean(PREF_ACTIVITY_REGISTRATION_ACTIVE, false)
    private var activityBackgroundOwner = prefs.owner(PREF_ACTIVITY_REGISTRATION_OWNER)
    private var activityStandaloneRequested = prefs.getBoolean(
        PREF_ACTIVITY_STANDALONE_REQUESTED,
        activityActive && activityBackgroundOwner == null
    )
    private var activityBackgroundOwnerVersion = 0L
    private var activityStandaloneOwnerVersion = 0L

    @Synchronized
    fun nextServiceGeneration(): Long {
        serviceGeneration = nextRegistrationGeneration(serviceGeneration)
        prefs.edit().putLong(PREF_SERVICE_GENERATION, serviceGeneration).commit()
        return serviceGeneration
    }

    fun currentServiceGeneration(): Long = serviceGeneration

    @Synchronized
    fun replaceLocation(owner: Long): Pair<BackgroundRegistration?, BackgroundRegistration> {
        val previous = currentLocation()
        locationGeneration = nextRegistrationGeneration(locationGeneration)
        locationActive = true
        locationOwner = owner
        persistLocation()
        return previous to BackgroundRegistration(locationGeneration, owner)
    }

    @Synchronized
    fun removeLocation(
        expectedOwner: Long? = null,
        expectedGeneration: Long? = null
    ): BackgroundRegistration? {
        val current = currentLocation() ?: return null
        if (expectedOwner != null && current.ownerServiceGeneration != expectedOwner) return null
        if (expectedGeneration != null && current.generation != expectedGeneration) return null
        locationActive = false
        locationOwner = null
        persistLocation()
        return current
    }

    @Synchronized
    fun isCurrentLocation(generation: Long, owner: Long): Boolean =
        locationActive && locationGeneration == generation && locationOwner == owner

    @Synchronized
    fun <T> withCurrentLocation(generation: Long, owner: Long, work: () -> T): T? {
        if (!isCurrentLocation(generation, owner)) return null
        return work()
    }

    @Synchronized
    fun requestActivity(owner: Long?): BackgroundActivityRequest {
        activityGeneration = nextRegistrationGeneration(activityGeneration)
        latestActivityRequestGeneration = activityGeneration
        val ownerVersion: Long
        val introducedOwner: Boolean
        if (owner == null) {
            introducedOwner = !activityStandaloneRequested
            activityStandaloneRequested = true
            activityStandaloneOwnerVersion += 1L
            ownerVersion = activityStandaloneOwnerVersion
        } else {
            introducedOwner = activityBackgroundOwner != owner
            activityBackgroundOwner = owner
            activityBackgroundOwnerVersion += 1L
            ownerVersion = activityBackgroundOwnerVersion
        }
        persistActivity()
        return BackgroundActivityRequest(
            activityGeneration,
            owner,
            ownerVersion,
            introducedOwner
        )
    }

    @Synchronized
    fun confirmActivity(request: BackgroundActivityRequest): BackgroundActivityConfirmation {
        val requesterIsCurrent = if (request.owner == null) {
            activityStandaloneRequested &&
                activityStandaloneOwnerVersion == request.ownerVersion
        } else {
            activityBackgroundOwner == request.owner &&
                activityBackgroundOwnerVersion == request.ownerVersion
        }
        if (latestActivityRequestGeneration != request.generation || !requesterIsCurrent) {
            return BackgroundActivityConfirmation(false, null)
        }
        val previous = currentActivity()
        activityConfirmedGeneration = request.generation
        activityActive = true
        latestActivityRequestGeneration = 0L
        persistActivity()
        return BackgroundActivityConfirmation(true, previous)
    }

    @Synchronized
    fun removeActivity(
        expectedOwner: Long? = null
    ): BackgroundActivityRegistration? {
        val current = currentActivity()
        if (expectedOwner == null) {
            if (!activityStandaloneRequested) return null
            activityStandaloneRequested = false
            activityStandaloneOwnerVersion += 1L
        } else {
            if (activityBackgroundOwner != expectedOwner) return null
            activityBackgroundOwner = null
            activityBackgroundOwnerVersion += 1L
        }
        if (hasActivityOwner()) {
            persistActivity()
            return null
        }
        activityActive = false
        persistActivity()
        return current
    }

    @Synchronized
    fun failActivity(request: BackgroundActivityRequest): BackgroundActivityRegistration? {
        if (request.owner == null) {
            if (request.introducedOwner &&
                activityStandaloneOwnerVersion == request.ownerVersion) {
                activityStandaloneRequested = false
                activityStandaloneOwnerVersion += 1L
            }
        } else if (request.introducedOwner &&
            activityBackgroundOwnerVersion == request.ownerVersion &&
            activityBackgroundOwner == request.owner) {
            activityBackgroundOwner = null
            activityBackgroundOwnerVersion += 1L
        }
        if (latestActivityRequestGeneration == request.generation) {
            latestActivityRequestGeneration = 0L
        }
        val remove = currentActivity()?.takeUnless { hasActivityOwner() }
        if (remove != null) activityActive = false
        persistActivity()
        return remove
    }

    @Synchronized
    fun isCurrentActivity(generation: Long, activeServiceGeneration: Long?): Boolean =
        activityActive &&
            activityConfirmedGeneration == generation &&
            (activityStandaloneRequested || activityBackgroundOwner == activeServiceGeneration)

    @Synchronized
    fun <T> withCurrentActivity(
        generation: Long,
        activeServiceGeneration: Long?,
        work: (ownerServiceGeneration: Long?) -> T
    ): T? {
        if (!isCurrentActivity(generation, activeServiceGeneration)) return null
        val activeOwner = activityBackgroundOwner?.takeIf { it == activeServiceGeneration }
        return work(activeOwner)
    }

    @Synchronized
    fun invalidateForReset(editor: SharedPreferences.Editor) {
        locationActive = false
        locationOwner = null
        activityActive = false
        activityBackgroundOwner = null
        activityStandaloneRequested = false
        latestActivityRequestGeneration = 0L
        activityBackgroundOwnerVersion += 1L
        activityStandaloneOwnerVersion += 1L
        editor
            .putLong(PREF_SERVICE_GENERATION, serviceGeneration)
            .putLong(PREF_LOCATION_REGISTRATION_GENERATION, locationGeneration)
            .putBoolean(PREF_LOCATION_REGISTRATION_ACTIVE, false)
            .putLong(PREF_LOCATION_REGISTRATION_OWNER, NO_SERVICE_OWNER)
            .putLong(PREF_ACTIVITY_REGISTRATION_GENERATION, activityGeneration)
            .putLong(PREF_ACTIVITY_CONFIRMED_GENERATION, activityConfirmedGeneration)
            .putBoolean(PREF_ACTIVITY_REGISTRATION_ACTIVE, false)
            .putLong(PREF_ACTIVITY_REGISTRATION_OWNER, NO_SERVICE_OWNER)
            .putBoolean(PREF_ACTIVITY_STANDALONE_REQUESTED, false)
    }

    private fun currentLocation(): BackgroundRegistration? =
        if (locationActive) BackgroundRegistration(locationGeneration, locationOwner) else null

    private fun currentActivity(): BackgroundActivityRegistration? =
        if (activityActive) {
            BackgroundActivityRegistration(
                activityConfirmedGeneration,
                activityBackgroundOwner,
                activityStandaloneRequested
            )
        } else {
            null
        }

    private fun persistLocation() {
        prefs.edit()
            .putLong(PREF_LOCATION_REGISTRATION_GENERATION, locationGeneration)
            .putBoolean(PREF_LOCATION_REGISTRATION_ACTIVE, locationActive)
            .putLong(PREF_LOCATION_REGISTRATION_OWNER, locationOwner ?: NO_SERVICE_OWNER)
            .apply()
    }

    private fun persistActivity() {
        prefs.edit()
            .putLong(PREF_ACTIVITY_REGISTRATION_GENERATION, activityGeneration)
            .putLong(PREF_ACTIVITY_CONFIRMED_GENERATION, activityConfirmedGeneration)
            .putBoolean(PREF_ACTIVITY_REGISTRATION_ACTIVE, activityActive)
            .putLong(PREF_ACTIVITY_REGISTRATION_OWNER, activityBackgroundOwner ?: NO_SERVICE_OWNER)
            .putBoolean(PREF_ACTIVITY_STANDALONE_REQUESTED, activityStandaloneRequested)
            .apply()
    }

    private fun hasActivityOwner(): Boolean =
        activityStandaloneRequested || activityBackgroundOwner != null

    private fun SharedPreferences.owner(key: String): Long? =
        getLong(key, NO_SERVICE_OWNER).takeUnless { it == NO_SERVICE_OWNER }
}
