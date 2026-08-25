package com.margelo.nitro.nitrogeolocation.background

import androidx.test.core.app.ApplicationProvider
import android.content.BroadcastReceiver
import android.content.IntentFilter
import com.facebook.react.bridge.LifecycleEventListener
import com.margelo.nitro.nitrogeolocation.AndroidProviderObservationContext
import com.margelo.nitro.nitrogeolocation.AndroidProviderStatusWatcher
import com.margelo.nitro.nitrogeolocation.BackgroundEventEnvelope
import com.margelo.nitro.nitrogeolocation.BackgroundEventType
import com.margelo.nitro.nitrogeolocation.GetStoredBackgroundEventsOptions
import com.margelo.nitro.nitrogeolocation.LocationLifecycleEvent
import com.margelo.nitro.nitrogeolocation.LocationLifecycleState
import com.margelo.nitro.nitrogeolocation.LocationProviderStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class UnifiedBackgroundEventsTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()

    @Test
    fun `provider status becomes a typed unified event`() {
        val status = LocationProviderStatus(
            locationServicesEnabled = true,
            backgroundModeEnabled = false,
            gpsAvailable = true,
            networkAvailable = false,
            passiveAvailable = true,
            googlePlayServicesAvailable = true,
            googleLocationAccuracyEnabled = false
        )

        val event = createProviderChangeBackgroundEvent(
            status = status,
            id = "provider-1",
            timestamp = 123.0
        )

        assertEquals("provider-1", event.id)
        assertEquals(123.0, event.timestamp, 0.0)
        assertEquals(BackgroundEventType.PROVIDERCHANGE, event.type)
        assertEquals(status, event.providerStatus)
        assertNull(event.lifecycle)
        assertNull(event.location)
    }

    @Test
    fun `persisted lifecycle events retain their typed payload`() {
        val store = NitroBackgroundStore(context)
        store.clearEvents(null)
        store.insertEvent(
            BackgroundEventEnvelope(
                location = null,
                geofence = null,
                activity = null,
                providerStatus = null,
                lifecycle = LocationLifecycleEvent(
                    state = LocationLifecycleState.PAUSED,
                    timestamp = 456.0
                ),
                result = null,
                error = null,
                id = "lifecycle-1",
                type = BackgroundEventType.LIFECYCLE,
                timestamp = 456.0,
                deliveredToJS = false
            )
        )

        val events = store.getEvents(
            GetStoredBackgroundEventsOptions(
                types = arrayOf(BackgroundEventType.LIFECYCLE),
                limit = 1.0,
                since = null,
                includeDelivered = true
            )
        )

        assertEquals(1, events.size)
        assertEquals("lifecycle-1", events.single().id)
        assertEquals(LocationLifecycleState.PAUSED, events.single().event.lifecycle?.state)
        assertEquals(456.0, events.single().event.lifecycle?.timestamp)
        assertNull(events.single().event.providerStatus)
        store.clearEvents(null)
        store.close()
    }

    @Test
    fun `failed provider registration rolls back its event listener`() {
        val registered = mutableSetOf<String>()

        assertThrows(IllegalStateException::class.java) {
            registerUnifiedEventListener(
                addEventListener = {
                    registered += "event-1"
                    "event-1"
                },
                removeEventListener = registered::remove,
                addProviderListener = { throw IllegalStateException("receiver unavailable") }
            )
        }

        assertTrue(registered.isEmpty())
    }

    @Test
    fun `disposing an untouched lazy resource does not initialize it`() {
        var created = 0
        var disposed = 0
        val resource = lazy {
            created += 1
            Any()
        }

        assertFalse(resource.disposeIfInitialized { disposed += 1 })
        assertEquals(0, created)
        assertEquals(0, disposed)

        resource.value
        assertTrue(resource.disposeIfInitialized { disposed += 1 })
        assertEquals(1, created)
        assertEquals(1, disposed)
    }

    @Test
    fun `provider watcher rolls back callback when native source registration fails`() {
        val observationContext = object : AndroidProviderObservationContext {
            override fun registerProviderReceiver(
                receiver: BroadcastReceiver,
                filter: IntentFilter
            ) {
                throw IllegalStateException("receiver unavailable")
            }

            override fun unregisterProviderReceiver(receiver: BroadcastReceiver) = Unit
            override fun addLifecycleListener(listener: LifecycleEventListener) = Unit
            override fun removeLifecycleListener(listener: LifecycleEventListener) = Unit
        }
        val watcher = AndroidProviderStatusWatcher(
            observationContext = observationContext,
            loadProviderStatus = {}
        )

        assertThrows(IllegalStateException::class.java) {
            watcher.watch {}
        }

        assertEquals(0, watcher.activeWatchCount)
    }
}
