import Foundation

final class IOSBackgroundHttpSync {
    func uploadWithRetry(
        locations: [StoredBackgroundLocation],
        sync: BackgroundHttpSyncOptions
    ) -> BackgroundHttpSyncResult {
        if sync.batch == false {
            return uploadSingleLocationsWithRetry(locations: locations, sync: sync)
        }
        let maxAttempts = sync.retry == true
            ? Int(sync.maxRetries ?? 3) + 1
            : 1
        var lastResult: BackgroundHttpSyncResult?
        for attempt in 0..<max(maxAttempts, 1) {
            let result = upload(locations: locations, sync: sync)
            if result.success {
                return result
            }
            lastResult = result
            if attempt < maxAttempts - 1 {
                Thread.sleep(forTimeInterval: 1)
            }
        }
        return lastResult ?? BackgroundHttpSyncResult(
            success: false,
            statusCode: nil,
            syncedLocationIds: [],
            failedLocationIds: locations.map(\.id),
            error: "HTTP sync failed"
        )
    }

    private func uploadSingleLocationsWithRetry(
        locations: [StoredBackgroundLocation],
        sync: BackgroundHttpSyncOptions
    ) -> BackgroundHttpSyncResult {
        let maxAttempts = sync.retry == true
            ? Int(sync.maxRetries ?? 3) + 1
            : 1
        var synced: [String] = []
        var failed: [String] = []
        var lastStatusCode: Double?
        var lastError: String?

        for location in locations {
            var didSync = false
            for attempt in 0..<max(maxAttempts, 1) {
                let result = upload(locations: [location], sync: sync)
                lastStatusCode = result.statusCode
                lastError = result.error
                if result.success {
                    synced.append(location.id)
                    didSync = true
                    break
                }
                if attempt < maxAttempts - 1 {
                    Thread.sleep(forTimeInterval: 1)
                }
            }
            if !didSync {
                failed.append(location.id)
            }
        }

        return BackgroundHttpSyncResult(
            success: failed.isEmpty,
            statusCode: lastStatusCode,
            syncedLocationIds: synced,
            failedLocationIds: failed,
            error: failed.isEmpty ? nil : (lastError ?? "HTTP sync failed")
        )
    }

    private func upload(
        locations: [StoredBackgroundLocation],
        sync: BackgroundHttpSyncOptions
    ) -> BackgroundHttpSyncResult {
        guard let url = URL(string: sync.url) else {
            return BackgroundHttpSyncResult(
                success: false,
                statusCode: nil,
                syncedLocationIds: [],
                failedLocationIds: locations.map(\.id),
                error: "Invalid sync URL"
            )
        }
        var request = URLRequest(url: url)
        request.httpMethod = sync.method?.stringValue ?? "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        sync.headers?.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }
        let body: Any
        if sync.batch == false, let location = locations.first {
            if var template = sync.bodyTemplate.map(bodyTemplateDictionary) {
                template["location"] = storedLocationDictionary(location)
                body = template
            } else {
                body = storedLocationDictionary(location)
            }
        } else {
            var template = sync.bodyTemplate.map(bodyTemplateDictionary) ?? [:]
            template["locations"] = locations.map(storedLocationDictionary)
            body = template
        }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        let semaphore = DispatchSemaphore(value: 0)
        var statusCode: Int?
        var requestError: String?
        URLSession.shared.dataTask(with: request) { _, response, error in
            statusCode = (response as? HTTPURLResponse)?.statusCode
            requestError = error?.localizedDescription
            semaphore.signal()
        }.resume()
        semaphore.wait()

        let success = statusCode.map { (200..<300).contains($0) } ?? false
        return BackgroundHttpSyncResult(
            success: success,
            statusCode: statusCode.map(Double.init),
            syncedLocationIds: success ? locations.map(\.id) : [],
            failedLocationIds: success ? [] : locations.map(\.id),
            error: success ? nil : (requestError ?? "HTTP sync failed")
        )
    }
}
