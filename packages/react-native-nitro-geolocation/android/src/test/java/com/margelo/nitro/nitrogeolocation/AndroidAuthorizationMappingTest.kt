package com.margelo.nitro.nitrogeolocation

import android.Manifest
import android.app.AppOpsManager
import android.app.Application
import android.content.Context
import android.location.LocationManager
import android.os.Looper
import android.os.Process
import androidx.test.core.app.ApplicationProvider
import com.facebook.react.bridge.BridgeReactContext
import com.google.android.gms.common.GooglePlayServicesUtilLight
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class AndroidAuthorizationMappingTest {
    @Before
    fun allowTheLibraryTestContextWithoutAConsumerAppManifest() {
        GooglePlayServicesUtilLight.enableUsingApkIndependentContext()
    }

    @Test
    fun backgroundPermissionTransitionsUseTheExistingLocationAppOp() {
        val app = ApplicationProvider.getApplicationContext<Application>()
        val context = BridgeReactContext(app)
        val settings = AndroidLocationSettings(
            context,
            app.getSystemService(Context.LOCATION_SERVICE) as LocationManager,
            ::LocationError
        )
        val watcher = AndroidProviderStatusWatcher(ReactProviderObservationContext(context)) {
            settings.getProviderStatus(success = it)
        }
        val appOps = app.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val received = mutableListOf<LocationAuthorizationStatus?>()
        shadowOf(app).denyPermissions(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.ACCESS_BACKGROUND_LOCATION
        )
        shadowOf(appOps).setMode(
            AppOpsManager.OPSTR_COARSE_LOCATION, Process.myUid(), app.packageName,
            AppOpsManager.MODE_IGNORED
        )
        val token = watcher.watch { received.add(it.authorizationStatus) }
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(listOf(LocationAuthorizationStatus.DENIED), received)

        // Approximate-only foreground permission must also map to whenInUse.
        shadowOf(app).grantPermissions(Manifest.permission.ACCESS_COARSE_LOCATION)
        shadowOf(appOps).setMode(
            AppOpsManager.OPSTR_COARSE_LOCATION, Process.myUid(), app.packageName,
            AppOpsManager.MODE_FOREGROUND
        )
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(LocationAuthorizationStatus.WHENINUSE, received.last())

        // Android represents background access as ALLOWED versus FOREGROUND
        // on the location op; there is no separate BACKGROUND_LOCATION app-op.
        shadowOf(app).grantPermissions(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        shadowOf(appOps).setMode(
            AppOpsManager.OPSTR_COARSE_LOCATION, Process.myUid(), app.packageName,
            AppOpsManager.MODE_ALLOWED
        )
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(LocationAuthorizationStatus.ALWAYS, received.last())

        shadowOf(app).denyPermissions(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        shadowOf(appOps).setMode(
            AppOpsManager.OPSTR_COARSE_LOCATION, Process.myUid(), app.packageName,
            AppOpsManager.MODE_FOREGROUND
        )
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(listOf(
            LocationAuthorizationStatus.DENIED, LocationAuthorizationStatus.WHENINUSE,
            LocationAuthorizationStatus.ALWAYS, LocationAuthorizationStatus.WHENINUSE
        ), received)

        watcher.unwatch(token)
        settings.dispose()
    }

    @Test
    @Config(sdk = [28])
    fun foregroundPermissionImpliesAlwaysBeforeAndroidTen() {
        val app = ApplicationProvider.getApplicationContext<Application>()
        val settings = AndroidLocationSettings(
            BridgeReactContext(app),
            app.getSystemService(Context.LOCATION_SERVICE) as LocationManager,
            ::LocationError
        )
        shadowOf(app).grantPermissions(Manifest.permission.ACCESS_COARSE_LOCATION)
        var actual: LocationAuthorizationStatus? = null
        settings.getProviderStatus { actual = it.authorizationStatus }
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(LocationAuthorizationStatus.ALWAYS, actual)
        settings.dispose()
    }
}
