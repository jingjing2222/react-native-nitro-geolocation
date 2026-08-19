import Foundation

private struct IOSBackgroundSyncBatch {
    let locations: [StoredBackgroundLocation]
    let sync: BackgroundHttpSyncOptions
    let configRevision: UInt64
}

extension NitroBackgroundLocation {
    func scheduleSyncIfNeeded(
        runGeneration: UInt64,
        locationSessionGeneration: UInt64
    ) {
        let scheduledConfigRevision = withStoreLock { () -> UInt64? in
            guard runGeneration == storeGeneration,
                self.locationSessionGeneration == locationSessionGeneration,
                locationSessionActive,
                let sync = options?.sync
            else { return nil }
            let threshold = positiveFiniteInt(sync.syncThreshold, defaultValue: 1)
            guard storedLocations.filter({ !$0.synced }).count >= threshold else { return nil }
            return syncConfigRevision
        }
        guard let scheduledConfigRevision else { return }

        var continuationConfigRevision: UInt64?
        syncScheduler.scheduleAutomatic(
            key: IOSBackgroundSyncKey(
                runGeneration: runGeneration,
                locationSessionGeneration: locationSessionGeneration,
                configRevision: scheduledConfigRevision
            )
        ) {
            guard let batch = self.reserveAutomaticSyncBatch(
                runGeneration: runGeneration,
                locationSessionGeneration: locationSessionGeneration,
                continuationConfigRevision: continuationConfigRevision
            ) else { return nil }
            let result = self.performSyncBatch(batch, runGeneration: runGeneration)
            let event = BackgroundEventEnvelope(
                location: nil,
                geofence: nil,
                activity: nil,
                providerStatus: nil,
                result: result,
                error: nil,
                id: UUID().uuidString,
                type: .httpsync,
                timestamp: Date().timeIntervalSince1970 * 1000,
                deliveredToJS: false
            )
            let storedForRun: Bool = self.withStoreLock {
                guard runGeneration == self.storeGeneration,
                    self.locationSessionGeneration == locationSessionGeneration,
                    self.locationSessionActive,
                    self.options != nil
                else { return false }
                self.appendStoredEvent(
                    StoredBackgroundEventEnvelope(
                        event: event,
                        createdAt: Date().timeIntervalSince1970 * 1000,
                        id: event.id,
                        type: event.type,
                        timestamp: event.timestamp,
                        deliveredToJS: false
                    )
                )
                self.persistStore()
                return true
            }
            guard storedForRun else { return nil }
            self.dispatchInProcess(
                event: event,
                runGeneration: runGeneration,
                locationSessionGeneration: locationSessionGeneration
            )
            let shouldContinue = result.success && !result.syncedLocationIds.isEmpty
            if shouldContinue {
                continuationConfigRevision = batch.configRevision
                return IOSBackgroundSyncKey(
                    runGeneration: runGeneration,
                    locationSessionGeneration: locationSessionGeneration,
                    configRevision: batch.configRevision
                )
            }
            return nil
        }
    }

    func performSyncStoredLocations(runGeneration: UInt64) -> BackgroundHttpSyncResult {
        guard let batch = withStoreLock({ syncBatch(runGeneration: runGeneration) }) else {
            return emptySyncResult()
        }
        return performSyncBatch(batch, runGeneration: runGeneration)
    }

    private func reserveAutomaticSyncBatch(
        runGeneration: UInt64,
        locationSessionGeneration: UInt64,
        continuationConfigRevision: UInt64?
    ) -> IOSBackgroundSyncBatch? {
        return withStoreLock {
            guard runGeneration == storeGeneration,
                self.locationSessionGeneration == locationSessionGeneration,
                locationSessionActive,
                let sync = options?.sync
            else { return nil }
            let allUnsynced = storedLocations.filter { !$0.synced }
            let threshold = positiveFiniteInt(sync.syncThreshold, defaultValue: 1)
            guard allUnsynced.count >= threshold else { return nil }
            let now = Date().timeIntervalSince1970 * 1000
            let interval = sync.syncInterval ?? 0
            let sameConfigContinuation = continuationConfigRevision == syncConfigRevision
            guard sameConfigContinuation || interval <= 0 || now - lastSyncAt >= interval else {
                return nil
            }
            let count = safePrefixCount(
                sync.batchSize,
                defaultValue: 50,
                upperBound: allUnsynced.count
            )
            guard count > 0 else { return nil }
            lastSyncAt = now
            return IOSBackgroundSyncBatch(
                locations: Array(allUnsynced.prefix(count)),
                sync: sync,
                configRevision: syncConfigRevision
            )
        }
    }

    private func syncBatch(runGeneration: UInt64) -> IOSBackgroundSyncBatch? {
        guard runGeneration == storeGeneration, let sync = options?.sync else { return nil }
        let allUnsynced = storedLocations.filter { !$0.synced }
        let count = safePrefixCount(
            sync.batchSize,
            defaultValue: 50,
            upperBound: allUnsynced.count
        )
        guard count > 0 else { return nil }
        return IOSBackgroundSyncBatch(
            locations: Array(allUnsynced.prefix(count)),
            sync: sync,
            configRevision: syncConfigRevision
        )
    }

    private func performSyncBatch(
        _ batch: IOSBackgroundSyncBatch,
        runGeneration: UInt64
    ) -> BackgroundHttpSyncResult {
        let result = httpSync.uploadWithRetry(locations: batch.locations, sync: batch.sync)
        if !result.success && result.syncedLocationIds.isEmpty {
            return result
        }
        let syncedIds = result.syncedLocationIds
        withStoreLock {
            guard runGeneration == storeGeneration else { return }
            storedLocations = storedLocations.map { location in
                syncedIds.contains(location.id)
                    ? StoredBackgroundLocation(
                        id: location.id,
                        deliveredToJS: location.deliveredToJS,
                        synced: true,
                        createdAt: location.createdAt,
                        source: location.source,
                        isFromBackground: location.isFromBackground,
                        provider: location.provider,
                        mocked: location.mocked,
                        recordedAt: location.recordedAt,
                        activity: location.activity,
                        battery: location.battery,
                        coords: location.coords,
                        timestamp: location.timestamp
                    )
                    : location
            }
            if batch.sync.autoClear == true {
                storedLocations.removeAll { syncedIds.contains($0.id) }
            }
            persistStore()
        }
        return result
    }

    private func emptySyncResult() -> BackgroundHttpSyncResult {
        return BackgroundHttpSyncResult(
            success: true,
            statusCode: nil,
            syncedLocationIds: [],
            failedLocationIds: [],
            error: nil
        )
    }
}
