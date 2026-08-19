import CoreLocation
import Foundation
import UIKit

final class IOSProviderStatusWatcher: NSObject, CLLocationManagerDelegate {
    private var callbacks: [String: (LocationProviderStatus) -> Void] = [:]
    private var lastStatuses: [String: LocationProviderStatus] = [:]
    private var locationManager: CLLocationManager?
    private var activeObserver: NSObjectProtocol?
    private var refreshGeneration = 0
    private let statusQueue = DispatchQueue(
        label: "com.nitrogeolocation.provider-status",
        qos: .utility
    )

    func watch(
        success: @escaping (LocationProviderStatus) -> Void
    ) -> String {
        let token = UUID().uuidString
        onMain {
            self.callbacks[token] = success
            if self.callbacks.count == 1 { self.startObserving() }
            self.refreshOnMain()
        }
        return token
    }

    func unwatch(token: String) {
        onMain {
            self.callbacks.removeValue(forKey: token)
            self.lastStatuses.removeValue(forKey: token)
            if self.callbacks.isEmpty { self.stopObservingOnMain() }
        }
    }

    func stopObserving() {
        onMain {
            self.callbacks.removeAll()
            self.lastStatuses.removeAll()
            self.stopObservingOnMain()
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        refreshOnMain()
    }

    deinit {
        if let activeObserver {
            NotificationCenter.default.removeObserver(activeObserver)
        }
        locationManager?.delegate = nil
    }

    private func startObserving() {
        let manager = CLLocationManager()
        manager.delegate = self
        locationManager = manager
        activeObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.refreshOnMain()
        }
    }

    private func stopObservingOnMain() {
        refreshGeneration += 1
        if let activeObserver {
            NotificationCenter.default.removeObserver(activeObserver)
            self.activeObserver = nil
        }
        locationManager?.delegate = nil
        locationManager = nil
    }

    private func refreshOnMain() {
        dispatchPrecondition(condition: .onQueue(.main))
        refreshGeneration += 1
        let generation = refreshGeneration
        statusQueue.async { [weak self] in
            let status = createLocationProviderStatus(
                locationServicesEnabled: CLLocationManager.locationServicesEnabled()
            )
            DispatchQueue.main.async {
                self?.deliver(status, generation: generation)
            }
        }
    }

    private func deliver(
        _ status: LocationProviderStatus,
        generation: Int
    ) {
        guard generation == refreshGeneration else { return }
        var pending: [(LocationProviderStatus) -> Void] = []
        for (token, callback) in callbacks {
            guard !sameStatus(lastStatuses[token], status) else { continue }
            lastStatuses[token] = status
            pending.append(callback)
        }
        pending.forEach { $0(status) }
    }

    private func sameStatus(
        _ first: LocationProviderStatus?,
        _ second: LocationProviderStatus
    ) -> Bool {
        return first?.locationServicesEnabled == second.locationServicesEnabled
            && first?.backgroundModeEnabled == second.backgroundModeEnabled
            && first?.gpsAvailable == second.gpsAvailable
            && first?.networkAvailable == second.networkAvailable
            && first?.passiveAvailable == second.passiveAvailable
            && first?.googlePlayServicesAvailable == second.googlePlayServicesAvailable
            && first?.googleLocationAccuracyEnabled == second.googleLocationAccuracyEnabled
    }

    private func onMain(_ action: @escaping () -> Void) {
        if Thread.isMainThread {
            action()
        } else {
            DispatchQueue.main.sync(execute: action)
        }
    }
}

extension NitroGeolocation {
    func watchProviderStatus(
        success: @escaping (LocationProviderStatus) -> Void
    ) -> String {
        return providerStatusWatcher.watch(success: success)
    }
}
