# Native HTTP Sync

```ts
await startBackgroundLocation({
  interval: 10_000,
  distanceFilter: 25,
  android: {
    foregroundService: {
      notificationTitle: 'Tracking active',
      notificationText: 'Uploading location updates',
    },
  },
  sync: {
    url: 'https://api.example.com/locations',
    method: 'POST',
    headers: { Authorization: 'Bearer token' },
    batch: true,
    batchSize: 50,
    syncThreshold: 5,
    retry: true,
    maxRetries: 5,
    autoClear: false,
  },
});
```

When `sync` is configured, native code attempts a flush after stored locations
reach `syncThreshold`, respecting `syncInterval`. Failed flushes can retry up to
`maxRetries` when `retry` is enabled. Call `syncStoredLocations()` to manually
flush the native queue.
