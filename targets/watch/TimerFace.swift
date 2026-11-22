import SwiftUI

struct WatchRoot: View {
  @ObservedObject var session: WatchSession
  @Environment(\.scenePhase) private var scenePhase

  var body: some View {
    Group {
      if session.screen == .pad {
        PairingPad(
          digits: session.codeDigits,
          status: session.pairStatus,
          onDigit: { session.typeDigit($0) },
          onDelete: { session.deleteDigit() },
          onSubmit: { session.submitCode() },
          onCancel: { session.cancelPairing() }
        )
      } else {
        TimerFace(model: session.model, onCommand: { command in
          session.sendCommand(command)
        }, onPair: { session.beginPairing() }, onForget: { session.forgetTV() })
      }
    }
    .onAppear { session.start() }
    .onChange(of: scenePhase) { phase in
      if phase == .active {
        session.noteForeground()
      }
    }
  }
}

struct TimerFace: View {
  let model: WatchFaceModel
  let onCommand: (String) -> Void
  var onPair: () -> Void = {}
  var onForget: () -> Void = {}

  var body: some View {
    VStack(spacing: 4) {
      Text(model.phaseText)
        .font(.system(size: 15, weight: .semibold))
        .tracking(1.1)
        .foregroundStyle(phaseColor)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      Text(model.timeText)
        .font(.system(size: 42, weight: .bold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(Color(red: 0.957, green: 0.969, blue: 0.984))
        .lineLimit(1)
        .minimumScaleFactor(0.45)
      Text(model.roundText)
        .font(.system(size: 13, weight: .medium))
        .foregroundStyle(Color(red: 0.576, green: 0.627, blue: 0.690))
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      HStack(spacing: 6) {
        Button(model.primaryTitle) { onCommand(model.primaryCommand) }
          .buttonStyle(.borderedProminent)
          .tint(Color(red: 1, green: 0.302, blue: 0.180))
        if model.canReset {
          Button("Reset") { onCommand("reset") }
            .buttonStyle(.bordered)
            .tint(Color(red: 0.957, green: 0.969, blue: 0.984))
        }
      }
      .disabled(!model.connected)
      .font(.system(size: 15, weight: .semibold))
      Text(model.status)
        .font(.system(size: 11))
        .foregroundStyle(Color(red: 0.576, green: 0.627, blue: 0.690))
        .multilineTextAlignment(.center)
        .lineLimit(2)
        .minimumScaleFactor(0.8)
      if model.showsPair {
        Button("Pair with code", action: onPair)
          .buttonStyle(.bordered)
          .font(.system(size: 14, weight: .semibold))
      }
      if model.showsForget {
        Button("Forget TV", action: onForget)
          .buttonStyle(.plain)
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(Color(red: 0.576, green: 0.627, blue: 0.690))
      }
    }
    .padding(.horizontal, 6)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color(red: 0.027, green: 0.031, blue: 0.039).ignoresSafeArea())
  }

  private var phaseColor: Color {
    switch model.phase {
    case "work":
      return Color(red: 1, green: 0.302, blue: 0.180)
    case "rest":
      return Color(red: 0.494, green: 0.714, blue: 1)
    case "getReady":
      return Color(red: 0.961, green: 0.769, blue: 0.318)
    case "finished":
      return Color(red: 0.957, green: 0.969, blue: 0.984)
    default:
      return Color(red: 0.576, green: 0.627, blue: 0.690)
    }
  }
}

/// Sample faces for the SwiftUI canvas and for debug screenshot launches.
/// The values match the timer labels the Apple TV already sends.
enum WatchPreviewFace: String {
  case waiting
  case getReady
  case work
  case rest
  case finished

  var model: WatchFaceModel {
    switch self {
    case .waiting:
      return .waiting
    case .getReady:
      return WatchFaceModel(
        phase: "getReady",
        phaseText: "GET READY",
        timeText: "00:10",
        roundText: "8 rounds",
        primaryTitle: "Pause",
        primaryCommand: "pause",
        canReset: true,
        status: "Apple TV",
        connected: true,
        showsPair: false,
        showsForget: false
      )
    case .work:
      return WatchFaceModel(
        phase: "work",
        phaseText: "WORK",
        timeText: "00:42",
        roundText: "Round 3 of 8",
        primaryTitle: "Pause",
        primaryCommand: "pause",
        canReset: true,
        status: "Apple TV",
        connected: true,
        showsPair: false,
        showsForget: false
      )
    case .rest:
      return WatchFaceModel(
        phase: "rest",
        phaseText: "REST",
        timeText: "00:08",
        roundText: "Round 3 of 8",
        primaryTitle: "Pause",
        primaryCommand: "pause",
        canReset: true,
        status: "Apple TV",
        connected: true,
        showsPair: false,
        showsForget: false
      )
    case .finished:
      return WatchFaceModel(
        phase: "finished",
        phaseText: "DONE",
        timeText: "04:00",
        roundText: "Round 8 of 8",
        primaryTitle: "Start",
        primaryCommand: "start",
        canReset: true,
        status: "Apple TV",
        connected: true,
        showsPair: false,
        showsForget: false
      )
    }
  }
}

#Preview("Get ready") {
  TimerFace(model: WatchPreviewFace.getReady.model, onCommand: { _ in })
}

#Preview("Work") {
  TimerFace(model: WatchPreviewFace.work.model, onCommand: { _ in })
}

#Preview("Rest") {
  TimerFace(model: WatchPreviewFace.rest.model, onCommand: { _ in })
}

#Preview("Finished") {
  TimerFace(model: WatchPreviewFace.finished.model, onCommand: { _ in })
}
