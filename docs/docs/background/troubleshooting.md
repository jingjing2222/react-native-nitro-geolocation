# Troubleshooting

## Android tracking does not start

Check foreground location, background location, Android 13+ notification permission, and device location services. Continuous background tracking requires `android.foregroundService`.

## Android starts but stops after swipe-away

Set `stopOnTerminate: false`. Vendor battery restrictions can still stop services.

## iOS killed-app behavior differs

iOS and Android have different background execution models. Authorization level, Low Power Mode, and termination state affect delivery.

## JS callback missed events

Read native storage with `getStoredBackgroundLocations()` or `getStoredBackgroundEvents()`.
