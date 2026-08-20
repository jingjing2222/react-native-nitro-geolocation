package com.margelo.nitro.nitrogeolocation.background

import androidx.test.core.app.ApplicationProvider
import com.margelo.nitro.nitrogeolocation.AndroidForegroundServiceOptions
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class NitroBackgroundServiceIntentTest {
    @Test
    fun stickyRestartFallsBackToTheDurableRunningGeneration() {
        assertEquals(12L, resolveBackgroundServiceGeneration(null, 12L))
        assertEquals(13L, resolveBackgroundServiceGeneration(13L, 12L))
        assertNull(resolveBackgroundServiceGeneration(null, null))
    }

    @Test
    fun serviceIntentCarriesTheNotificationSnapshotNeededBeforeControllerLocks() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val options = AndroidForegroundServiceOptions(
            42.0,
            "Tracking",
            "Waiting for provider registration",
            "background-test",
            "Background test",
            "Description",
            "location_icon",
            "#123456",
            "Stop"
        )

        val intent = backgroundServiceIntent(context, 9L, options)

        assertEquals(9L, intent.backgroundServiceGeneration())
        assertEquals(options, intent.backgroundNotificationOptions())
    }
}
