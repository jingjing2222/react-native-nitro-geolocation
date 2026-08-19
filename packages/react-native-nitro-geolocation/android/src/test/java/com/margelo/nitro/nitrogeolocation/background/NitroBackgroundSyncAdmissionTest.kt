package com.margelo.nitro.nitrogeolocation.background

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NitroBackgroundSyncAdmissionTest {
    @Test
    fun releasesTheStorageSnapshotLockBeforeReservingTheRegistrationGate() {
        val storageLock = Any()
        var gateSawStorageLocked = true
        val admission = NitroBackgroundSyncAdmission()

        val result = admission.reserve(
            snapshot = { synchronized(storageLock) { "batch" } },
            reserveGate = {
                gateSawStorageLocked = Thread.holdsLock(storageLock)
                true
            }
        )

        assertEquals("batch", result)
        assertFalse(gateSawStorageLocked)
    }

    @Test
    fun continuationBypassesTheIntervalOnlyForTheSameConfigRevision() {
        assertFalse(shouldEnforceSyncInterval(7, 7))
        assertTrue(shouldEnforceSyncInterval(7, 8))
        assertTrue(shouldEnforceSyncInterval(null, 8))
    }
}
