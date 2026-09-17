import AppKit
import AVFoundation
import CoreGraphics
import ScreenCaptureKit

enum TrulyCaptureError: LocalizedError {
    case permissionRequired
    case noDisplayAvailable
    case imageCreationFailed

    var errorDescription: String? {
        switch self {
        case .permissionRequired:
            "Allow Screen Recording so Truly can see the screen you choose to share."
        case .noDisplayAvailable:
            "Truly could not find a screen to share."
        case .imageCreationFailed:
            "Truly could not prepare that screen. Please try again."
        }
    }
}

struct CapturedScreen {
    let image: NSImage
    let displayFrame: CGRect
}

@MainActor
final class ScreenCaptureService {
    var hasPermission: Bool {
        CGPreflightScreenCaptureAccess()
    }

    func requestPermission() -> Bool {
        CGRequestScreenCaptureAccess()
    }

    func captureCurrentDisplay(at point: CGPoint? = nil) async throws -> CapturedScreen {
        guard hasPermission else {
            throw TrulyCaptureError.permissionRequired
        }

        let shareableContent = try await SCShareableContent.excludingDesktopWindows(
            false,
            onScreenWindowsOnly: true
        )

        guard !shareableContent.displays.isEmpty else {
            throw TrulyCaptureError.noDisplayAvailable
        }

        let screenByDisplayID: [CGDirectDisplayID: NSScreen] = Dictionary(
            uniqueKeysWithValues: NSScreen.screens.compactMap { screen in
                guard let screenNumber = screen.deviceDescription[
                    NSDeviceDescriptionKey("NSScreenNumber")
                ] as? NSNumber else {
                    return nil
                }
                return (CGDirectDisplayID(screenNumber.uint32Value), screen)
            }
        )

        let mouseLocation = point ?? NSEvent.mouseLocation
        let selectedDisplay = shareableContent.displays.first { display in
            screenByDisplayID[display.displayID]?.frame.contains(mouseLocation) == true
        } ?? shareableContent.displays[0]

        let selectedFrame = screenByDisplayID[selectedDisplay.displayID]?.frame
            ?? CGRect(
                x: selectedDisplay.frame.origin.x,
                y: selectedDisplay.frame.origin.y,
                width: CGFloat(selectedDisplay.width),
                height: CGFloat(selectedDisplay.height)
            )

        let ownBundleIdentifier = Bundle.main.bundleIdentifier
        let ownWindows = shareableContent.windows.filter {
            guard let application = $0.owningApplication else { return false }
            return application.processID == ProcessInfo.processInfo.processIdentifier
                || (ownBundleIdentifier != nil && application.bundleIdentifier == ownBundleIdentifier)
        }
        let contentFilter = SCContentFilter(display: selectedDisplay, excludingWindows: ownWindows)

        let configuration = SCStreamConfiguration()
        let maximumDimension = 1440
        let aspectRatio = CGFloat(selectedDisplay.width) / CGFloat(selectedDisplay.height)
        if selectedDisplay.width >= selectedDisplay.height {
            configuration.width = maximumDimension
            configuration.height = Int(CGFloat(maximumDimension) / aspectRatio)
        } else {
            configuration.height = maximumDimension
            configuration.width = Int(CGFloat(maximumDimension) * aspectRatio)
        }
        configuration.showsCursor = true

        let capturedImage = try await SCScreenshotManager.captureImage(
            contentFilter: contentFilter,
            configuration: configuration
        )
        let previewImage = NSImage(
            cgImage: capturedImage,
            size: NSSize(width: capturedImage.width, height: capturedImage.height)
        )

        guard previewImage.isValid else {
            throw TrulyCaptureError.imageCreationFailed
        }

        return CapturedScreen(image: previewImage, displayFrame: selectedFrame)
    }
}

enum MicrophonePermissionState {
    case notDetermined
    case granted
    case denied

    var isGranted: Bool {
        self == .granted
    }
}

enum MicrophonePermissionService {
    static var state: MicrophonePermissionState {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            .granted
        case .notDetermined:
            .notDetermined
        default:
            .denied
        }
    }

    static func requestPermission() async -> Bool {
        await AVCaptureDevice.requestAccess(for: .audio)
    }
}
