import Foundation
import Network
import SwiftUI
import WatchKit

struct WatchFaceModel: Equatable {
  var phase: String
  var phaseText: String
  var timeText: String
  var roundText: String
  var primaryTitle: String
  var primaryCommand: String
  var canReset: Bool
  var status: String
  var connected: Bool

  static let waiting = WatchFaceModel(
    phase: "idle",
    phaseText: "READY",
    timeText: "--:--",
    roundText: "Round",
    primaryTitle: "Start",
    primaryCommand: "start",
    canReset: false,
    status: "Waiting for Apple TV",
    connected: false
  )
}

/// Listens for the Apple TV. The TV presents DeviceDiscoveryUI and connects here.
/// A tap fires when a phase, round, or the finish arrives. No health data is read.
@MainActor
final class WatchSession: ObservableObject {
  @Published private(set) var model = WatchFaceModel.waiting

  private var listener: NWListener?
  private var connection: NWConnection?
  private let framer = WatchFramer()
  /// Debug screenshot launches already show a preview face and must not open the listener.
  private let showsLaunchPreview: Bool

  init() {
    #if DEBUG
    let preview = WatchSession.launchPreviewModel()
    showsLaunchPreview = preview != nil
    if let face = preview {
      model = face
    }
    #else
    showsLaunchPreview = false
    #endif
  }

  func start() {
    guard !showsLaunchPreview else { return }
    guard listener == nil else { return }
    guard #available(watchOS 9.0, *) else {
      model.status = "Needs watchOS 9"
      return
    }
    do {
      let listener = try NWListener(using: .applicationService)
      listener.service = NWListener.Service(applicationService: WatchWire.serviceName)
      listener.stateUpdateHandler = { [weak self] state in
        Task { @MainActor in
          self?.noteListener(state)
        }
      }
      listener.newConnectionHandler = { [weak self] connection in
        Task { @MainActor in
          self?.accept(connection)
        }
      }
      listener.start(queue: .main)
      self.listener = listener
    } catch {
      model.status = "Could not listen"
    }
  }

  func sendCommand(_ name: String) {
    guard model.connected, let line = WatchWire.commandLine(id: UUID().uuidString, name: name) else { return }
    guard let data = line.data(using: .utf8) else { return }
    connection?.send(content: data, completion: .contentProcessed { _ in })
  }

  private func noteListener(_ state: NWListener.State) {
    switch state {
    case .failed(_):
      model.status = "Listener failed"
    case .waiting(_):
      break
    case .ready, .setup, .cancelled:
      break
    @unknown default:
      break
    }
  }

  private func accept(_ next: NWConnection) {
    connection?.cancel()
    framer.reset()
    connection = next
    next.stateUpdateHandler = { [weak self] state in
      Task { @MainActor in
        self?.noteConnection(state)
      }
    }
    next.start(queue: .main)
    receive(on: next)
  }

  private func noteConnection(_ state: NWConnection.State) {
    switch state {
    case .ready:
      model.connected = true
      model.status = "Apple TV"
    case .failed(_):
      model.connected = false
      model.status = "Waiting for Apple TV"
      connection = nil
    case .cancelled:
      model.connected = false
      model.status = "Waiting for Apple TV"
      connection = nil
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
      let captured = data
      Task { @MainActor in
        guard let self else { return }
        if let captured {
          for line in self.framer.append(captured) {
            self.apply(line)
          }
        }
        if isComplete || error != nil {
          self.model.connected = false
          self.model.status = "Waiting for Apple TV"
          return
        }
        self.receive(on: connection)
      }
    }
  }

  private func apply(_ line: String) {
    guard let object = WatchWire.decodeObject(line), let type = object["type"] as? String else { return }
    switch type {
    case "state":
      applyState(object)
    case "event":
      play(object["name"] as? String)
    case "ack":
      if object["ok"] as? Bool == false {
        model.status = "Not now"
      }
    default:
      break
    }
  }

  private func applyState(_ object: [String: Any]) {
    guard let phase = object["phase"] as? String,
          let phaseText = object["phaseText"] as? String,
          let timeText = object["timeText"] as? String,
          let roundText = object["roundText"] as? String,
          let primary = object["primary"] as? String,
          let canReset = object["canReset"] as? Bool else {
      return
    }
    model.phase = phase
    model.phaseText = phaseText
    model.timeText = timeText
    model.roundText = roundText
    model.primaryCommand = primary
    model.primaryTitle = title(for: primary)
    model.canReset = canReset
    model.connected = true
    if model.status == "Not now" || model.status == "Waiting for Apple TV" {
      model.status = "Apple TV"
    }
  }

  private func title(for primary: String) -> String {
    switch primary {
    case "pause":
      return "Pause"
    case "resume":
      return "Resume"
    default:
      return "Start"
    }
  }

  #if DEBUG
  /// Screenshot runs pass `-AmericanaWatchPreview waiting|getReady|work|rest|finished`.
  /// The faces are the SwiftUI previews. Release builds omit this path.
  private static func launchPreviewModel() -> WatchFaceModel? {
    let args = ProcessInfo.processInfo.arguments
    let flag = "-AmericanaWatchPreview"
    guard let index = args.firstIndex(of: flag),
          index + 1 < args.count,
          let face = WatchPreviewFace(rawValue: args[index + 1]) else {
      return nil
    }
    return face.model
  }
  #endif

  private func play(_ name: String?) {
    switch name {
    case "phase", "round":
      WKInterfaceDevice.current().play(.click)
    case "finished":
      WKInterfaceDevice.current().play(.notification)
    default:
      break
    }
  }
}
