import CoreLocation
import CoreMotion
import Foundation

internal func motionActivityType(_ activity: CMMotionActivity) -> DetectedActivityType {
    if activity.automotive {
        return .invehicle
    }
    if activity.cycling {
        return .onbicycle
    }
    if activity.running {
        return .running
    }
    if activity.walking {
        return .walking
    }
    if activity.stationary {
        return .still
    }
    return .unknown
}

internal func motionConfidence(_ confidence: CMMotionActivityConfidence) -> Double {
    switch confidence {
    case .low:
        return 25
    case .medium:
        return 60
    case .high:
        return 95
    @unknown default:
        return 0
    }
}

internal func mapActivityType(_ activityType: IOSBackgroundActivityType?) -> CLActivityType {
    switch activityType {
    case .automotivenavigation:
        return .automotiveNavigation
    case .fitness:
        return .fitness
    case .othernavigation:
        return .otherNavigation
    case .airborne:
        if #available(iOS 12.0, *) {
            return .airborne
        }
        return .other
    case .other, nil:
        return .other
    @unknown default:
        return .other
    }
}
