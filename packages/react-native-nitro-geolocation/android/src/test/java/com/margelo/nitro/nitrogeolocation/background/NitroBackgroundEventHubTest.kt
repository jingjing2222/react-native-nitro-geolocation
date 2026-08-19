package com.margelo.nitro.nitrogeolocation.background

import com.margelo.nitro.nitrogeolocation.BackgroundEventEnvelope
import com.margelo.nitro.nitrogeolocation.BackgroundEventType
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

class NitroBackgroundEventHubTest {
    @Test
    fun removeWaitsForAnActiveListenerAndPreventsFutureDelivery() {
        val hub = NitroBackgroundEventHub()
        val callbackStarted = CountDownLatch(1)
        val releaseCallback = CountDownLatch(1)
        val removeStarted = CountDownLatch(1)
        val removeFinished = CountDownLatch(1)
        val token = hub.addEventListener {
            callbackStarted.countDown()
            releaseCallback.await(1, TimeUnit.SECONDS)
        }

        val emitter = thread { hub.emit(event()) }
        assertTrue(callbackStarted.await(1, TimeUnit.SECONDS))
        val remover = thread {
            removeStarted.countDown()
            hub.removeEventListener(token)
            removeFinished.countDown()
        }

        assertTrue(removeStarted.await(1, TimeUnit.SECONDS))
        assertFalse(removeFinished.await(100, TimeUnit.MILLISECONDS))
        releaseCallback.countDown()
        assertTrue(removeFinished.await(1, TimeUnit.SECONDS))
        emitter.join()
        remover.join()
        assertFalse(hub.emit(event()))
    }

    private fun event() = BackgroundEventEnvelope(
        null,
        null,
        null,
        null,
        null,
        null,
        "event-id",
        BackgroundEventType.PROVIDERCHANGE,
        1.0,
        false
    )
}
