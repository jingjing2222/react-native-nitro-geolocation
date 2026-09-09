package com.margelo.nitro.nitrogeolocation.background

import android.app.Service
import android.content.Context
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import com.margelo.nitro.nitrogeolocation.*
import org.junit.Assert.*
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class NitroNotificationActionsTest {
    // Robolectric recreates application preferences between tests, but the
    // controller's process singleton can otherwise retain the previous app.
    @Before
    @After
    fun clearControllerSingleton() {
        NitroBackgroundLocationController::class.java.getDeclaredField("instance").apply {
            isAccessible = true
            set(null, null)
        }
    }

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val actions = arrayOf(AndroidNotificationAction("pause", "Pause"), AndroidNotificationAction("mark", "Mark"))
    private fun options() = AndroidForegroundServiceOptions(
        null, "Tracking", "Active", null, null, null, null, null, "Stop", actions
    )

    @Test
    fun buttonsHaveDistinctImmutableIdentitiesAndRetainTheirRunAndId() {
        val notification = NitroBackgroundNotificationFactory.create(context, options(), 9L)
        assertEquals(listOf("Stop", "Pause", "Mark"), notification.actions.map { it.title.toString() })
        val custom = notification.actions.drop(1)
        assertNotEquals(custom[0].actionIntent, custom[1].actionIntent)
        custom.forEachIndexed { index, action ->
            assertTrue(action.actionIntent.isImmutable)
            val intent = shadowOf(action.actionIntent).savedIntent
            assertEquals(ACTION_NOTIFICATION_ACTION, intent.action)
            assertEquals(actions[index].id, intent.getStringExtra(EXTRA_NOTIFICATION_ACTION_ID))
            assertEquals(9L, intent.backgroundServiceGeneration())
        }
        val newer = NitroBackgroundNotificationFactory.create(context, options(), 10L)
        assertNotEquals(custom[0].actionIntent, newer.actions[1].actionIntent)
        assertEquals(options(), backgroundServiceIntent(context, 9L, options()).backgroundNotificationOptions())
        assertArrayEquals(actions, notificationActionsFromJson(notificationActionsJson(actions)))
    }

    @Test
    fun invalidButtonsFailBeforePostingANotification() {
        for (invalid in listOf(
            arrayOf(AndroidNotificationAction("", "Empty")),
            arrayOf(AndroidNotificationAction("id", " ")),
            arrayOf(AndroidNotificationAction("id", "One"), AndroidNotificationAction("id", "Two")),
            actions + AndroidNotificationAction("third", "Third")
        )) {
            assertThrows(IllegalArgumentException::class.java) {
                NitroBackgroundNotificationFactory.create(context, options().copy(actions = invalid), 9L)
            }
        }
    }

    @Test
    fun matchingActionIsDeliveredAndPersistedWithoutStartingOrStoppingTracking() {
        val prefs = context.getSharedPreferences(BACKGROUND_LOCATION_PREFS, Context.MODE_PRIVATE)
        prefs.edit().putBoolean("running", true).putLong(PREF_SERVICE_GENERATION, 9L)
            .putBoolean("configured", true).putBoolean("stopOnTerminate", false)
            .putString("notificationTitle", "Tracking").putString("notificationText", "Active")
            .putString("notificationActions", notificationActionsJson(actions)).commit()
        assertArrayEquals(actions, NitroBackgroundConfigStore(prefs).restore()!!.android!!.foregroundService.actions)
        val controller = NitroBackgroundLocationController.getInstance(context)
        assertEquals(9L, controller.runningServiceGeneration())
        assertEquals(false, controller.getConfigOrNull()!!.stopOnTerminate)
        controller.store.clearEvents(null)
        val received = mutableListOf<BackgroundEventEnvelope>()
        val token = controller.eventHub.addEventListener(received::add)
        val service = Robolectric.buildService(NitroBackgroundLocationService::class.java).create().get()
        fun tap(generation: Long, id: String) = Intent(context, NitroBackgroundLocationService::class.java)
            .setAction(ACTION_NOTIFICATION_ACTION).putExtra(EXTRA_SERVICE_GENERATION, generation)
            .putExtra(EXTRA_NOTIFICATION_ACTION_ID, id)

        service.onStartCommand(tap(8L, "pause"), 0, 1)
        service.onStartCommand(tap(9L, "unknown"), 0, 2)
        assertEquals(9L, controller.runningServiceGeneration())
        assertTrue(received.isEmpty())
        assertEquals(Service.START_STICKY, service.onStartCommand(tap(9L, "pause"), 0, 3))
        val event = received.single()
        assertEquals(BackgroundEventType.NOTIFICATIONACTION, event.type)
        assertEquals("pause", event.notificationAction!!.actionId)
        assertEquals("notificationAction", event.toJson().getString("type"))
        assertEquals("pause", event.toJson().getJSONObject("notificationAction").getString("actionId"))
        assertEquals(event.notificationAction, controller.store.getEvents(null).single().event.notificationAction)
        assertTrue(prefs.getBoolean("running", false))
        assertNull(shadowOf(service).lastForegroundNotification)
        controller.eventHub.removeEventListener(token)
    }
}
