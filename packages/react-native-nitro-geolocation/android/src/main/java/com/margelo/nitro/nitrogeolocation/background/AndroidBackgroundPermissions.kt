package com.margelo.nitro.nitrogeolocation.background

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import com.margelo.nitro.nitrogeolocation.*
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

internal class AndroidBackgroundPermissions(
    private val appContext: Context,
    private val configProvider: () -> BackgroundLocationOptions?
) {
    fun checkBackgroundPermission(): BackgroundPermissionResult {
        val foreground = foregroundPermission()
        val background = backgroundPermission()
        return BackgroundPermissionResult(
            foreground,
            background,
            accuracyAuthorization(),
            Build.VERSION.SDK_INT < Build.VERSION_CODES.R,
            background != BackgroundPermissionStatus.GRANTED
        )
    }

    fun requestBackgroundPermission(reactContext: ReactApplicationContext): BackgroundPermissionResult {
        val activity = reactContext.currentActivity
        if (activity != null) {
            val permissions = mutableListOf<String>()
            if (foregroundPermission() != PermissionStatus.GRANTED) {
                permissions += Manifest.permission.ACCESS_FINE_LOCATION
                permissions += Manifest.permission.ACCESS_COARSE_LOCATION
            }
            if (Build.VERSION.SDK_INT == Build.VERSION_CODES.Q &&
                backgroundPermission() != BackgroundPermissionStatus.GRANTED) {
                permissions += Manifest.permission.ACCESS_BACKGROUND_LOCATION
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                configProvider()?.android?.requestNotificationPermission != false &&
                notificationPermission() != PermissionStatus.GRANTED) {
                permissions += Manifest.permission.POST_NOTIFICATIONS
            }
            if (permissions.isNotEmpty()) {
                requestPermissionsAndWait(activity, permissions.toTypedArray())
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
            backgroundPermission() != BackgroundPermissionStatus.GRANTED) {
            openAppLocationSettings()
        }
        return checkBackgroundPermission()
    }

    fun openAppLocationSettings() {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            .setData(Uri.fromParts("package", appContext.packageName, null))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        appContext.startActivity(intent)
    }

    fun foregroundPermission(): PermissionStatus {
        val fine = ContextCompat.checkSelfPermission(
            appContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            appContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return if (fine || coarse) PermissionStatus.GRANTED else PermissionStatus.DENIED
    }

    fun backgroundPermission(): BackgroundPermissionStatus {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return BackgroundPermissionStatus.GRANTED
        }
        return if (
            ContextCompat.checkSelfPermission(
                appContext,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            BackgroundPermissionStatus.GRANTED
        } else {
            BackgroundPermissionStatus.DENIED
        }
    }

    fun notificationPermission(): PermissionStatus? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return null
        return if (
            ContextCompat.checkSelfPermission(
                appContext,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            PermissionStatus.GRANTED
        } else {
            PermissionStatus.DENIED
        }
    }

    fun accuracyAuthorization(): AccuracyAuthorization {
        val fine = ContextCompat.checkSelfPermission(
            appContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            appContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return when {
            fine -> AccuracyAuthorization.FULL
            coarse -> AccuracyAuthorization.REDUCED
            else -> AccuracyAuthorization.UNKNOWN
        }
    }

    private fun requestPermissionsAndWait(
        activity: android.app.Activity,
        permissions: Array<String>
    ) {
        val permissionAware = activity as? PermissionAwareActivity
        val latch = CountDownLatch(1)
        var lifecycleCallbacks: android.app.Application.ActivityLifecycleCallbacks? = null
        fun finishNonPermissionAwareRequest() {
            latch.countDown()
            lifecycleCallbacks?.let {
                runCatching {
                    activity.application.unregisterActivityLifecycleCallbacks(it)
                }
                lifecycleCallbacks = null
            }
        }
        if (permissionAware == null) {
            lifecycleCallbacks = object : android.app.Application.ActivityLifecycleCallbacks {
                override fun onActivityCreated(
                    activity: android.app.Activity,
                    savedInstanceState: android.os.Bundle?
                ) = Unit
                override fun onActivityStarted(activity: android.app.Activity) = Unit
                override fun onActivityResumed(resumedActivity: android.app.Activity) {
                    if (resumedActivity === activity) {
                        finishNonPermissionAwareRequest()
                    }
                }
                override fun onActivityPaused(activity: android.app.Activity) = Unit
                override fun onActivityStopped(activity: android.app.Activity) = Unit
                override fun onActivitySaveInstanceState(
                    activity: android.app.Activity,
                    outState: android.os.Bundle
                ) = Unit
                override fun onActivityDestroyed(activity: android.app.Activity) = Unit
            }
            activity.application.registerActivityLifecycleCallbacks(lifecycleCallbacks)
        }
        Handler(Looper.getMainLooper()).post {
            if (permissionAware == null) {
                androidx.core.app.ActivityCompat.requestPermissions(activity, permissions, 9473)
                Handler(Looper.getMainLooper()).postDelayed(
                    { finishNonPermissionAwareRequest() },
                    60_000
                )
            } else {
                permissionAware.requestPermissions(
                    permissions,
                    9473,
                    PermissionListener { requestCode, _, _ ->
                        if (requestCode == 9473) {
                            latch.countDown()
                            true
                        } else {
                            false
                        }
                    }
                )
            }
        }
        if (Looper.myLooper() != Looper.getMainLooper()) {
            latch.await(60, TimeUnit.SECONDS)
        }
        if (permissionAware == null && Looper.myLooper() != Looper.getMainLooper()) {
            finishNonPermissionAwareRequest()
        }
    }
}
