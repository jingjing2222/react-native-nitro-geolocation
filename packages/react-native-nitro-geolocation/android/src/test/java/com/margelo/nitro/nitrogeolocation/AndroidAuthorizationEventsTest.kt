package com.margelo.nitro.nitrogeolocation

import android.app.AppOpsManager
import android.app.Application
import android.content.Context
import android.content.BroadcastReceiver
import android.content.IntentFilter
import android.os.Looper
import android.os.Process
import androidx.test.core.app.ApplicationProvider
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.LifecycleEventListener
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class AndroidAuthorizationEventsTest {
    @Test
    fun appOpChangesTriggerSnapshotsWithoutAProviderBroadcast() {
        val app = ApplicationProvider.getApplicationContext<Application>()
        val context = BridgeReactContext(app)
        var status = LocationProviderStatus(
            LocationAuthorizationStatus.DENIED, true, false, true, true, true, false, null
        )
        val watcher = AndroidProviderStatusWatcher(ReactProviderObservationContext(context)) { it(status) }
        val appOps = app.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        for (op in listOf(AppOpsManager.OPSTR_COARSE_LOCATION, AppOpsManager.OPSTR_FINE_LOCATION)) {
            shadowOf(appOps).setMode(op, Process.myUid(), app.packageName, AppOpsManager.MODE_IGNORED)
        }
        val received = mutableListOf<LocationAuthorizationStatus?>()
        val token = watcher.watch { received.add(it.authorizationStatus) }
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(listOf(LocationAuthorizationStatus.DENIED), received)

        status = status.copy(authorizationStatus = LocationAuthorizationStatus.WHENINUSE)
        shadowOf(appOps).setMode(AppOpsManager.OPSTR_COARSE_LOCATION, Process.myUid(), app.packageName, AppOpsManager.MODE_ALLOWED)
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(LocationAuthorizationStatus.WHENINUSE, received.last())

        status = status.copy(authorizationStatus = LocationAuthorizationStatus.ALWAYS)
        shadowOf(appOps).setMode(AppOpsManager.OPSTR_FINE_LOCATION, Process.myUid(), app.packageName, AppOpsManager.MODE_ALLOWED)
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(LocationAuthorizationStatus.ALWAYS, received.last())

        watcher.unwatch(token)
        val deliveredCount = received.size
        status = status.copy(authorizationStatus = LocationAuthorizationStatus.DENIED)
        shadowOf(appOps).setMode(AppOpsManager.OPSTR_COARSE_LOCATION, Process.myUid(), app.packageName, AppOpsManager.MODE_IGNORED)
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(deliveredCount, received.size)
    }

    @Test
    fun permissionOnlyChangesAreDeliveredOnceAndCleanupCancelsQueuedEvents() {
        var lifecycle: LifecycleEventListener? = null
        var unregisters = 0
        val context = object : AndroidProviderObservationContext {
            override fun registerProviderReceiver(receiver: BroadcastReceiver, filter: IntentFilter) = Unit
            override fun unregisterProviderReceiver(receiver: BroadcastReceiver) { unregisters++ }
            override fun addLifecycleListener(listener: LifecycleEventListener) { lifecycle = listener }
            override fun removeLifecycleListener(listener: LifecycleEventListener) { lifecycle = null }
        }
        var status = LocationProviderStatus(
            LocationAuthorizationStatus.ALWAYS, true, false, true, true, true, false, null
        )
        val watcher = AndroidProviderStatusWatcher(context) { it(status) }
        val received = mutableListOf<LocationAuthorizationStatus?>()
        val token = watcher.watch { received.add(it.authorizationStatus) }
        assertTrue(received.isEmpty())
        shadowOf(Looper.getMainLooper()).idle()
        for (authorization in listOf(
            LocationAuthorizationStatus.WHENINUSE,
            LocationAuthorizationStatus.DENIED,
            LocationAuthorizationStatus.WHENINUSE,
            LocationAuthorizationStatus.ALWAYS
        )) {
            status = status.copy(authorizationStatus = authorization)
            lifecycle!!.onHostResume()
            shadowOf(Looper.getMainLooper()).idle()
            lifecycle!!.onHostResume()
            shadowOf(Looper.getMainLooper()).idle()
        }
        assertEquals(listOf(
            LocationAuthorizationStatus.ALWAYS, LocationAuthorizationStatus.WHENINUSE,
            LocationAuthorizationStatus.DENIED, LocationAuthorizationStatus.WHENINUSE,
            LocationAuthorizationStatus.ALWAYS
        ), received)
        status = status.copy(authorizationStatus = LocationAuthorizationStatus.DENIED)
        lifecycle!!.onHostResume()
        watcher.unwatch(token)
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(5, received.size)
        assertEquals(1, unregisters)
        assertNull(lifecycle)
    }
}
