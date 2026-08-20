package com.margelo.nitro.nitrogeolocation.background

import androidx.test.core.app.ApplicationProvider
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class NitroBackgroundErrorStateTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()

    @Test
    fun resetBarrierSerializesAConcurrentPersistedErrorRestore() {
        val prefs = context.getSharedPreferences("background-error-state-test", 0)
        prefs.edit().clear().putInt("lastErrorCode", 2)
            .putString("lastErrorMessage", "old error").commit()
        val state = NitroBackgroundErrorState(prefs)
        val started = CountDownLatch(1)
        val finished = CountDownLatch(1)
        val executor = Executors.newSingleThreadExecutor()

        synchronized(state) {
            executor.execute {
                started.countDown()
                state.current()
                finished.countDown()
            }
            assertTrue(started.await(1, TimeUnit.SECONDS))
            assertFalse(finished.await(100, TimeUnit.MILLISECONDS))
        }
        assertTrue(finished.await(1, TimeUnit.SECONDS))
        state.clear()
        assertNull(state.current())
        executor.shutdownNow()
    }
}
