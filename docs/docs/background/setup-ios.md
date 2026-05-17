# iOS Setup

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Allow this app to use your location.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Allow this app to use your location in the background.</string>

<key>UIBackgroundModes</key>
<array>
  <string>location</string>
</array>
```

For activity-aware tracking:

```xml
<key>NSMotionUsageDescription</key>
<string>Allow this app to detect your movement activity.</string>
```

iOS does not provide Android-style Headless JS. Events are stored natively and can be drained after app initialization.
