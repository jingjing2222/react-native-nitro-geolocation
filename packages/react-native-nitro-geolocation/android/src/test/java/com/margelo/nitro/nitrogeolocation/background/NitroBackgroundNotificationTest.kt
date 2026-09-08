package com.margelo.nitro.nitrogeolocation.background

import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import androidx.test.core.app.ApplicationProvider
import com.margelo.nitro.nitrogeolocation.AndroidForegroundServiceOptions
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class NitroBackgroundNotificationTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()

    private fun options(color: String? = null, stop: String? = null) =
        AndroidForegroundServiceOptions(null, "Tracking", "Active", null, null, null, null, color, stop)

    @Test
    fun notificationAppliesColorAndGenerationScopedImmutableStopAction() {
        val notification = NitroBackgroundNotificationFactory.create(context, options("#123456", "Stop"), 9L)
        assertEquals(Color.rgb(0x12, 0x34, 0x56), notification.color)
        val action = notification.actions.single()
        assertEquals("Stop", action.title)
        assertTrue(action.actionIntent.isImmutable)
        val intent = shadowOf(action.actionIntent).savedIntent
        assertEquals(ACTION_STOP_BACKGROUND_LOCATION, intent.action)
        assertEquals(9L, intent.backgroundServiceGeneration())
        assertEquals(NitroBackgroundLocationService::class.java.name, intent.component?.className)
        val newer = NitroBackgroundNotificationFactory.create(context, options(stop = "Stop"), 10L)
        assertNotEquals(action.actionIntent, newer.actions.single().actionIntent)
    }

    @Test
    fun omittedOrBlankActionsAndInvalidColorsDoNotBreakTracking() {
        for (title in listOf(null, " ")) {
            val notification = NitroBackgroundNotificationFactory.create(context, options("bad-color", title), 9L)
            assertTrue(notification.actions.isNullOrEmpty())
            assertEquals(0, notification.color)
        }
    }

    @Test
    fun nativeStopActionStopsOnlyTheMatchingDurableRunWithoutPromotingOrRestarting() {
        val prefs = context.getSharedPreferences(BACKGROUND_LOCATION_PREFS, Context.MODE_PRIVATE)
        prefs.edit().putBoolean("running", true).putLong(PREF_SERVICE_GENERATION, 9L).commit()
        val service = Robolectric.buildService(NitroBackgroundLocationService::class.java).create().get()
        fun stopIntent(generation: Long) = Intent(context, NitroBackgroundLocationService::class.java)
            .setAction(ACTION_STOP_BACKGROUND_LOCATION)
            .putExtra(EXTRA_SERVICE_GENERATION, generation)

        assertEquals(Service.START_NOT_STICKY, service.onStartCommand(stopIntent(8L), 0, 1))
        assertTrue(prefs.getBoolean("running", false))
        assertEquals(Service.START_NOT_STICKY, service.onStartCommand(stopIntent(9L), 0, 2))
        assertFalse(prefs.getBoolean("running", true))
        assertNull(shadowOf(service).lastForegroundNotification)
    }
}
