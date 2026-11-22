import ExpoModulesCore
import Network

#if os(tvOS)
import DeviceDiscoveryUI
import UIKit
#endif

@Record
struct WatchLinkEvent {
  var json: String = ""
}

/// Pipe between the Apple TV timer and one Apple Watch.
/// The watch advertises Americana-Timer. This side presents the system picker and connects.
/// Android and iPhone builds compile the same module as a no-op.
@ExpoModule("AmericanaWatchLink")
public class AmericanaWatchLinkModule: Module {
  @Event
  var onCommand: (WatchLinkEvent) -> Void

  @Event
  var onLink: (WatchLinkEvent) -> Void

  @JS
  func start() {
    WatchTvLink.shared.onCommand = { [weak self] json in
      self?.onCommand(WatchLinkEvent(json: json))
    }
    WatchTvLink.shared.onLink = { [weak self] json in
      self?.onLink(WatchLinkEvent(json: json))
    }
    WatchTvLink.shared.noteLaunchStatus()
  }

  @JS
  func stop() {
    WatchTvLink.shared.stop()
  }

  @JS
  func send(_ message: String) {
    WatchTvLink.shared.send(message)
  }

  @JS
  func presentPicker() async -> Bool {
    await WatchTvLink.shared.presentPicker()
  }
}

final class WatchTvLink: @unchecked Sendable {
  static let shared = WatchTvLink()

  var onCommand: ((String) -> Void)?
  var onLink: ((String) -> Void)?

  private let queue = DispatchQueue(label: "americana.watch-link")
  private var connection: NWConnection?
  private let framer = WatchFramer()

  func send(_ message: String) {
    let line = message.hasSuffix("\n") ? message : message + "\n"
    guard let data = line.data(using: .utf8) else { return }
    queue.async { [weak self] in
      self?.connection?.send(content: data, completion: .contentProcessed { _ in })
    }
  }

  func stop() {
    queue.async { [weak self] in
      self?.connection?.cancel()
      self?.connection = nil
      self?.emitLink("stopped")
    }
  }

  /// UI tests pass `-AmericanaWatchStatus unsupported` to show the HD message
  /// without presenting DeviceDiscoveryUI. TestFlight launches do not.
  func noteLaunchStatus() {
    guard let name = Self.launchStatus() else { return }
    log("launch status \(name)")
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
      self?.emitLink(name)
    }
  }

  func presentPicker() async -> Bool {
    #if os(tvOS)
    if #available(tvOS 16.0, *) {
      return await MainActor.run {
        // DeviceDiscoveryUI needs no extra entitlement. Apple documents it for
        // Apple TV 4K on tvOS 16 and later. Apple TV HD, including A1625,
        // makes isSupported return false. The Info.plist Browses entry is the
        // declaration on tvOS; the watch Advertises the same service name.
        let supported = DDDevicePickerViewController.isSupported(
          .applicationService(name: WatchWire.serviceName),
          using: .applicationService
        )
        log("isSupported=\(supported) service=\(WatchWire.serviceName)")
        guard supported else {
          self.emitLink("unsupported")
          return false
        }
        guard let picker = DDDevicePickerViewController(
          browseDescriptor: .applicationService(name: WatchWire.serviceName),
          parameters: .applicationService
        ) else {
          self.emitLink("picker-unavailable")
          return false
        }
        picker.modalPresentationStyle = .fullScreen
        picker.modalTransitionStyle = .coverVertical
        guard let host = Self.topViewController() else {
          self.emitLink("unavailable")
          return false
        }
        log("presenting on \(type(of: host))")
        host.present(picker, animated: true)
        Task { @MainActor in
          do {
            let endpoint = try await picker.endpoint
            self.connect(to: endpoint)
          } catch {
            self.emitLink("cancelled")
          }
        }
        return true
      }
    }
    #endif
    emitLink("unsupported")
    return false
  }

  #if os(tvOS)
  private func connect(to endpoint: NWEndpoint) {
    let next = NWConnection(to: endpoint, using: .applicationService)
    queue.async { [weak self] in
      guard let self else { return }
      self.framer.reset()
      self.connection?.cancel()
      self.connection = next
      next.stateUpdateHandler = { [weak self] state in
        self?.handleState(state)
      }
      next.start(queue: self.queue)
      self.receive(on: next)
    }
  }

  /// React Native on tvOS often has no foreground-active scene yet. Walk every
  /// window scene, then the app delegate window, and skip a controller that is
  /// already on its way out.
  @MainActor
  private static func topViewController() -> UIViewController? {
    var found: [UIViewController] = []
    for window in candidateWindows() {
      if let presenter = topPresenter(from: window.rootViewController) {
        found.append(presenter)
      }
    }
    if let visible = found.first(where: { $0.viewIfLoaded?.window != nil && !$0.isBeingDismissed }) {
      return visible
    }
    return found.first(where: { !$0.isBeingDismissed }) ?? found.first
  }

  @MainActor
  private static func candidateWindows() -> [UIWindow] {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let active = scenes.filter { $0.activationState == .foregroundActive }
    let rest = scenes.filter { $0.activationState != .foregroundActive }
    var windows: [UIWindow] = []
    func take(_ group: [UIWindowScene]) {
      for scene in group {
        let key = scene.windows.first(where: \.isKeyWindow)
        if let key {
          windows.append(key)
        }
        for window in scene.windows {
          if let key, window === key { continue }
          windows.append(window)
        }
      }
    }
    take(active)
    take(rest)
    if let window = UIApplication.shared.delegate?.window ?? nil {
      if !windows.contains(where: { $0 === window }) {
        windows.append(window)
      }
    }
    return windows
  }

  @MainActor
  private static func topPresenter(from root: UIViewController?) -> UIViewController? {
    guard var current = root else { return nil }
    var steps = 0
    while steps < 8, let presented = current.presentedViewController, !presented.isBeingDismissed {
      current = presented
      steps += 1
    }
    if current.isBeingDismissed, let host = current.presentingViewController, !host.isBeingDismissed {
      return host
    }
    return current
  }
  #endif

  private static func launchStatus() -> String? {
    let args = ProcessInfo.processInfo.arguments
    guard let index = args.firstIndex(of: "-AmericanaWatchStatus"), index + 1 < args.count else {
      return nil
    }
    switch args[index + 1] {
    case "unsupported", "picker-unavailable", "unavailable", "cancelled", "connected", "disconnected":
      return args[index + 1]
    default:
      return nil
    }
  }

  private func handleState(_ state: NWConnection.State) {
    switch state {
    case .ready:
      emitLink("connected")
    case .failed:
      emitLink("disconnected")
    case .cancelled:
      emitLink("disconnected")
    case .setup, .preparing:
      break
    case .waiting(_):
      break
    @unknown default:
      break
    }
  }

  private func receive(on connection: NWConnection) {
    connection.receive(minimumIncompleteLength: 1, maximumLength: WatchWire.maxBytes) { [weak self] data, _, isComplete, error in
      guard let self else { return }
      if let data {
        for line in self.framer.append(data) {
          self.onCommand?(line)
        }
      }
      if isComplete || error != nil {
        self.emitLink("disconnected")
        return
      }
      self.receive(on: connection)
    }
  }

  private func emitLink(_ json: String) {
    log("link \(json)")
    DispatchQueue.main.async { [weak self] in
      self?.onLink?(json)
    }
  }

  private func log(_ message: String) {
    print("AmericanaWatchLink \(message)")
  }
}
