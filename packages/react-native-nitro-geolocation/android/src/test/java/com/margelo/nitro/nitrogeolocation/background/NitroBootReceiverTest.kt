package com.margelo.nitro.nitrogeolocation.background

import android.app.job.JobScheduler
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import com.margelo.nitro.nitrogeolocation.GeofenceRegion
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLog

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [27, 34])
class NitroBootReceiverTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val scheduler = context.getSystemService(JobScheduler::class.java)

    @Before
    fun setUp() {
        context.deleteDatabase("nitro_background_location.db")
        context.getSharedPreferences(BACKGROUND_LOCATION_PREFS, Context.MODE_PRIVATE)
            .edit().clear().commit()
        scheduler.cancelAll()
        ShadowLog.clear()
    }

    @Test
    fun foregroundOnlyInstallDoesNotScheduleWorkOrCreateBackgroundStorage() {
        NitroBootReceiver().onReceive(context, Intent(Intent.ACTION_BOOT_COMPLETED))

        assertTrue(scheduler.allPendingJobs.isEmpty())
        assertFalse(context.getDatabasePath("nitro_background_location.db").exists())
    }

    @Test
    fun emptyBackgroundStoreDoesNotScheduleRestoration() {
        withStore { it.writableDatabase }

        NitroBootReceiver().onReceive(context, Intent(Intent.ACTION_BOOT_COMPLETED))

        assertTrue(scheduler.allPendingJobs.isEmpty())
    }

    @Test
    fun persistedGeofencesAreRestoredEvenWhenStartOnBootIsDisabled() {
        saveGeofence()
        context.getSharedPreferences(BACKGROUND_LOCATION_PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean("startOnBoot", false).commit()

        NitroBootReceiver().onReceive(context, Intent(Intent.ACTION_BOOT_COMPLETED))

        assertEquals(
            NitroBootRestoreJobService::class.java.name,
            scheduler.allPendingJobs.single().service.className
        )
    }

    @Test
    fun removingTheLastGeofenceStopsBootRestoration() {
        saveGeofence()
        withStore { it.removeGeofences(null) }

        NitroBootReceiver().onReceive(context, Intent(Intent.ACTION_BOOT_COMPLETED))

        assertTrue(scheduler.allPendingJobs.isEmpty())
    }

    @Test
    fun unrelatedBroadcastDoesNotScheduleRestoration() {
        saveGeofence()

        NitroBootReceiver().onReceive(context, Intent(Intent.ACTION_TIME_CHANGED))

        assertTrue(scheduler.allPendingJobs.isEmpty())
    }

    @Test
    fun schedulerExceptionDoesNotEscapeTheBootReceiver() {
        saveGeofence()
        val failure = SecurityException("JobScheduler unavailable")
        val failingContext = object : ContextWrapper(context) {
            override fun getApplicationContext(): Context = this

            override fun getSystemService(name: String): Any? {
                if (name == Context.JOB_SCHEDULER_SERVICE) throw failure
                return super.getSystemService(name)
            }
        }

        NitroBootReceiver().onReceive(failingContext, Intent(Intent.ACTION_BOOT_COMPLETED))

        assertTrue(scheduler.allPendingJobs.isEmpty())
        assertTrue(ShadowLog.getLogsForTag(NitroGeoLog.TAG).any { it.throwable === failure })
    }

    @Test
    fun rejectedJobIsLoggedWithoutCrashing() {
        saveGeofence()
        assertTrue(NitroBootRestoreJobService.schedule(context))
        val jobId = scheduler.allPendingJobs.single().id
        scheduler.cancelAll()
        shadowOf(scheduler).failOnJob(jobId)

        NitroBootReceiver().onReceive(context, Intent(Intent.ACTION_BOOT_COMPLETED))

        assertTrue(scheduler.allPendingJobs.isEmpty())
        assertTrue(ShadowLog.getLogsForTag(NitroGeoLog.TAG).any {
            it.msg == "Failed to schedule background restoration after boot"
        })
    }

    @Test
    fun unavailableStorageDoesNotCrashOnLockedBoot() {
        val failure = IllegalStateException("Credential encrypted storage is locked")
        val lockedContext = object : ContextWrapper(context) {
            override fun getApplicationContext(): Context = this

            override fun getDatabasePath(name: String): java.io.File = throw failure

            override fun getSharedPreferences(name: String, mode: Int): android.content.SharedPreferences =
                throw failure
        }

        NitroBootReceiver().onReceive(lockedContext, Intent(Intent.ACTION_LOCKED_BOOT_COMPLETED))

        assertTrue(scheduler.allPendingJobs.isEmpty())
        assertEquals(2, ShadowLog.getLogsForTag(NitroGeoLog.TAG).count { it.throwable === failure })
    }

    private fun saveGeofence() {
        withStore {
            it.saveGeofences(arrayOf(
                GeofenceRegion("home", 37.0, 127.0, 100.0, true, true, false, null, null, null)
            ))
        }
    }

    private fun withStore(action: (NitroBackgroundStore) -> Unit) {
        val store = NitroBackgroundStore(context)
        try {
            action(store)
        } finally {
            store.close()
        }
    }
}
