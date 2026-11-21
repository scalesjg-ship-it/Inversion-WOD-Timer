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

  func presentPicker() async -> Bool {
    #if os(tvOS)
    if #available(tvOS 16.0, *) {
      return await MainActor.run {
        guard DDDevicePickerViewController.isSupported(
          .applicationService(name: WatchWire.serviceName),
          using: .applicationService
        ) else {
          self.emitLink("unsupported")
          return false
        }
        let picker = DDDevicePickerViewController(
          browseDescriptor: .applicationService(name: WatchWire.serviceName),
          parameters: .applicationService
        )
        picker.modalPresentationStyle = .fullScreen
        picker.modalTransitionStyle = .coverVertical
        guard let host = Self.topViewController() else {
          self.emitLink("unavailable")
          return false
        }
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

  @MainActor
  private static func topViewController() -> UIViewController? {
    let scene = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first { $0.activationState == .foregroundActive }
    let root = scene?.windows.first(where: \.isKeyWindow)?.rootViewController
      ?? scene?.windows.first?.rootViewController
    var current = root
    while let presented = current?.presentedViewController {
      current = presented
    }
    return current
  }
  #endif

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
    DispatchQueue.main.async { [weak self] in
      self?.onLink?(json)
    }
  }
}
