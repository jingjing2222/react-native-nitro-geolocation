package com.margelo.nitro.nitrogeolocation.background

import androidx.test.core.app.ApplicationProvider
import android.content.BroadcastReceiver
import android.content.IntentFilter
import android.os.Looper
import com.facebook.react.bridge.LifecycleEventListener
import com.margelo.nitro.nitrogeolocation.AndroidProviderObservationContext
import com.margelo.nitro.nitrogeolocation.AndroidProviderStatusWatcher
import com.margelo.nitro.nitrogeolocation.BackgroundEventEnvelope
import com.margelo.nitro.nitrogeolocation.BackgroundEventType
import com.margelo.nitro.nitrogeolocation.GetStoredBackgroundEventsOptions
import com.margelo.nitro.nitrogeolocation.LocationLifecycleEvent
import com.margelo.nitro.nitrogeolocation.LocationLifecycleState
import com.margelo.nitro.nitrogeolocation.LocationProviderStatus
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
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

    @Test
    fun `provider watcher serializes stop with native source startup`() {
        val registrationStarted = CountDownLatch(1)
        val releaseRegistration = CountDownLatch(1)
        val stopStarted = CountDownLatch(1)
        val stopReturned = CountDownLatch(1)
        val unregisterCalls = AtomicInteger(0)
        val removeLifecycleCalls = AtomicInteger(0)
        val observationContext = object : AndroidProviderObservationContext {
            override fun registerProviderReceiver(
                receiver: BroadcastReceiver,
                filter: IntentFilter
            ) {
                registrationStarted.countDown()
                assertTrue(releaseRegistration.await(2, TimeUnit.SECONDS))
            }

            override fun unregisterProviderReceiver(receiver: BroadcastReceiver) {
                unregisterCalls.incrementAndGet()
            }

            override fun addLifecycleListener(listener: LifecycleEventListener) = Unit

            override fun removeLifecycleListener(listener: LifecycleEventListener) {
                removeLifecycleCalls.incrementAndGet()
            }
        }
        val watcher = AndroidProviderStatusWatcher(
            observationContext = observationContext,
            loadProviderStatus = {}
        )
        val watchThread = thread { watcher.watch {} }

        assertTrue(registrationStarted.await(2, TimeUnit.SECONDS))
        val stopThread = thread {
            stopStarted.countDown()
            watcher.stopObserving()
            stopReturned.countDown()
        }
        assertTrue(stopStarted.await(2, TimeUnit.SECONDS))
        val stoppedBeforeStartupCompleted = stopReturned.await(200, TimeUnit.MILLISECONDS)
        releaseRegistration.countDown()
        watchThread.join(2_000)
        stopThread.join(2_000)

        assertFalse(stoppedBeforeStartupCompleted)
        assertFalse(watchThread.isAlive)
        assertFalse(stopThread.isAlive)
        assertEquals(0, watcher.activeWatchCount)
        assertEquals(1, unregisterCalls.get())
        assertEquals(1, removeLifecycleCalls.get())
    }

    @Test
    fun `second provider watch retries startup after first startup fails`() {
        val firstRegistrationStarted = CountDownLatch(1)
        val releaseFirstRegistration = CountDownLatch(1)
        val secondWatchStarted = CountDownLatch(1)
        val secondWatchReturned = CountDownLatch(1)
        val registrationCalls = AtomicInteger(0)
        val firstFailure = AtomicReference<Throwable?>()
        val secondFailure = AtomicReference<Throwable?>()
        val secondToken = AtomicReference<String?>()
        val observationContext = object : AndroidProviderObservationContext {
            override fun registerProviderReceiver(
                receiver: BroadcastReceiver,
                filter: IntentFilter
            ) {
                if (registrationCalls.incrementAndGet() == 1) {
                    firstRegistrationStarted.countDown()
                    assertTrue(releaseFirstRegistration.await(2, TimeUnit.SECONDS))
                    throw IllegalStateException("receiver unavailable")
                }
            }

            override fun unregisterProviderReceiver(receiver: BroadcastReceiver) = Unit
            override fun addLifecycleListener(listener: LifecycleEventListener) = Unit
            override fun removeLifecycleListener(listener: LifecycleEventListener) = Unit
        }
        val watcher = AndroidProviderStatusWatcher(
            observationContext = observationContext,
            loadProviderStatus = {}
        )
        val firstThread = thread {
            firstFailure.set(runCatching { watcher.watch {} }.exceptionOrNull())
        }

        assertTrue(firstRegistrationStarted.await(2, TimeUnit.SECONDS))
        val secondThread = thread {
            secondWatchStarted.countDown()
            val result = runCatching { watcher.watch {} }
            secondToken.set(result.getOrNull())
            secondFailure.set(result.exceptionOrNull())
            secondWatchReturned.countDown()
        }
        assertTrue(secondWatchStarted.await(2, TimeUnit.SECONDS))
        val secondReturnedBeforeFirstCompleted =
            secondWatchReturned.await(200, TimeUnit.MILLISECONDS)
        releaseFirstRegistration.countDown()
        firstThread.join(2_000)
        secondThread.join(2_000)

        assertFalse(firstThread.isAlive)
        assertFalse(secondThread.isAlive)
        assertFalse(secondReturnedBeforeFirstCompleted)
        assertTrue(firstFailure.get() is IllegalStateException)
        assertNull(secondFailure.get())
        assertTrue(secondToken.get()?.isNotBlank() == true)
        assertEquals(2, registrationCalls.get())
        assertEquals(1, watcher.activeWatchCount)
        watcher.stopObserving()
    }

    @Test
    fun `failed refresh cannot discard a snapshot completed during startup`() {
        val initialStatus = LocationProviderStatus(
            locationServicesEnabled = true,
            backgroundModeEnabled = false,
            gpsAvailable = true,
            networkAvailable = false,
            passiveAvailable = true,
            googlePlayServicesAvailable = true,
            googleLocationAccuracyEnabled = true
        )
        val loadCalls = AtomicInteger(0)
        val secondLoadStarted = CountDownLatch(1)
        val releaseSecondLoad = CountDownLatch(1)
        val firstCompletionStarted = CountDownLatch(1)
        val firstCompletion = AtomicReference<((LocationProviderStatus) -> Unit)?>()
        val secondFailure = AtomicReference<Throwable?>()
        val received = mutableListOf<LocationProviderStatus>()
        val observationContext = object : AndroidProviderObservationContext {
            override fun registerProviderReceiver(
                receiver: BroadcastReceiver,
                filter: IntentFilter
            ) = Unit

            override fun unregisterProviderReceiver(receiver: BroadcastReceiver) = Unit
            override fun addLifecycleListener(listener: LifecycleEventListener) = Unit
            override fun removeLifecycleListener(listener: LifecycleEventListener) = Unit
        }
        val watcher = AndroidProviderStatusWatcher(
            observationContext = observationContext,
            loadProviderStatus = { completion ->
                when (loadCalls.incrementAndGet()) {
                    1 -> firstCompletion.set(completion)
                    2 -> {
                        secondLoadStarted.countDown()
                        assertTrue(releaseSecondLoad.await(2, TimeUnit.SECONDS))
                        throw IllegalStateException("status load unavailable")
                    }
                    else -> completion(initialStatus)
                }
            }
        )
        watcher.watch(received::add)

        val secondThread = thread {
            secondFailure.set(runCatching { watcher.watch {} }.exceptionOrNull())
        }
        assertTrue(secondLoadStarted.await(2, TimeUnit.SECONDS))
        val completionThread = thread {
            firstCompletionStarted.countDown()
            firstCompletion.get()?.invoke(initialStatus)
        }
        assertTrue(firstCompletionStarted.await(2, TimeUnit.SECONDS))
        releaseSecondLoad.countDown()
        secondThread.join(2_000)
        completionThread.join(2_000)
        shadowOf(Looper.getMainLooper()).idle()

        assertFalse(secondThread.isAlive)
        assertFalse(completionThread.isAlive)
        assertTrue(secondFailure.get() is IllegalStateException)
        assertEquals(2, loadCalls.get())
        assertEquals(listOf(initialStatus), received)
        watcher.stopObserving()
    }

    @Test
    fun `concurrent failed refreshes cannot leave a phantom generation`() {
        val initialStatus = LocationProviderStatus(
            locationServicesEnabled = true,
            backgroundModeEnabled = false,
            gpsAvailable = true,
            networkAvailable = true,
            passiveAvailable = true,
            googlePlayServicesAvailable = true,
            googleLocationAccuracyEnabled = true
        )
        val loadCalls = AtomicInteger(0)
        val secondLoadStarted = CountDownLatch(1)
        val thirdWatchStarted = CountDownLatch(1)
        val thirdLoadStarted = CountDownLatch(1)
        val releaseSecondLoad = CountDownLatch(1)
        val releaseThirdLoad = CountDownLatch(1)
        val firstCompletion = AtomicReference<((LocationProviderStatus) -> Unit)?>()
        val observationContext = object : AndroidProviderObservationContext {
            override fun registerProviderReceiver(
                receiver: BroadcastReceiver,
                filter: IntentFilter
            ) = Unit

            override fun unregisterProviderReceiver(receiver: BroadcastReceiver) = Unit
            override fun addLifecycleListener(listener: LifecycleEventListener) = Unit
            override fun removeLifecycleListener(listener: LifecycleEventListener) = Unit
        }
        val watcher = AndroidProviderStatusWatcher(
            observationContext = observationContext,
            loadProviderStatus = { completion ->
                when (loadCalls.incrementAndGet()) {
                    1 -> firstCompletion.set(completion)
                    2 -> {
                        secondLoadStarted.countDown()
                        assertTrue(releaseSecondLoad.await(2, TimeUnit.SECONDS))
                        throw IllegalStateException("second load unavailable")
                    }
                    3 -> {
                        thirdLoadStarted.countDown()
                        assertTrue(releaseThirdLoad.await(2, TimeUnit.SECONDS))
                        throw IllegalStateException("third load unavailable")
                    }
                }
            }
        )
        val received = mutableListOf<LocationProviderStatus>()
        watcher.watch(received::add)
        val secondThread = thread { runCatching { watcher.watch {} } }

        assertTrue(secondLoadStarted.await(2, TimeUnit.SECONDS))
        val thirdThread = thread {
            thirdWatchStarted.countDown()
            runCatching { watcher.watch {} }
        }
        assertTrue(thirdWatchStarted.await(2, TimeUnit.SECONDS))
        val thirdEnteredBeforeSecondSettled =
            thirdLoadStarted.await(200, TimeUnit.MILLISECONDS)
        releaseSecondLoad.countDown()
        assertTrue(thirdLoadStarted.await(2, TimeUnit.SECONDS))
        releaseThirdLoad.countDown()
        secondThread.join(2_000)
        thirdThread.join(2_000)
        firstCompletion.get()?.invoke(initialStatus)
        shadowOf(Looper.getMainLooper()).idle()

        assertFalse(thirdEnteredBeforeSecondSettled)
        assertEquals(3, loadCalls.get())
        assertEquals(listOf(initialStatus), received)
        assertEquals(1, watcher.activeWatchCount)
        watcher.stopObserving()
    }
}
