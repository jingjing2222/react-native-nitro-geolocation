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
flush the native queue. Manual and automatic flushes share one serial native
queue. Automatic work rechecks the active run, current sync options, threshold,
batch, and interval when its turn begins, so queued work cannot reuse a stale
batch or upload the same stored locations alongside a manual flush.
While an automatic upload is running, further location callbacks coalesce into
one latest pending check instead of growing an unbounded upload backlog.
Pending work from an older run cannot replace a newer run's check. After a
successful upload, native code continues one batch at a time until the unsynced
count falls below `syncThreshold`; each batch returns to the serial queue first,
so manual sync and a newer run can take precedence.
Calling `configureBackgroundLocation()` starts a new sync-config revision. An
older upload may finish, but its continuation must reapply the replacement
config's `syncInterval` before starting another batch.
