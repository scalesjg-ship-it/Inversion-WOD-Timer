import SwiftUI

/// Six large digits, delete, and OK. The digital crown is left alone so a mis-turn cannot change the code.
struct PairingPad: View {
  let digits: String
  let status: String
  let onDigit: (String) -> Void
  let onDelete: () -> Void
  let onSubmit: () -> Void
  let onCancel: () -> Void

  private let rows = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]]

  var body: some View {
    VStack(spacing: 4) {
      Text(display)
        .font(.system(size: 22, weight: .bold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(Color(red: 0.957, green: 0.969, blue: 0.984))
        .lineLimit(1)
        .minimumScaleFactor(0.6)
      Text(status)
        .font(.system(size: 11))
        .foregroundStyle(Color(red: 0.576, green: 0.627, blue: 0.690))
        .multilineTextAlignment(.center)
        .lineLimit(2)
        .minimumScaleFactor(0.7)
      ForEach(rows, id: \.self) { row in
        HStack(spacing: 4) {
          ForEach(row, id: \.self) { digit in
            key(digit) { onDigit(digit) }
          }
        }
      }
      HStack(spacing: 4) {
        key("⌫", action: onDelete)
        key("0") { onDigit("0") }
        key("OK", enabled: digits.count == 6, action: onSubmit)
      }
      Button("Cancel", action: onCancel)
        .buttonStyle(.plain)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(Color(red: 0.576, green: 0.627, blue: 0.690))
    }
    .padding(.horizontal, 4)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color(red: 0.027, green: 0.031, blue: 0.039).ignoresSafeArea())
  }

  private var display: String {
    let filled = digits.padding(toLength: 6, withPad: "–", startingAt: 0)
    let chars = Array(filled)
    return "\(chars[0])\(chars[1])\(chars[2]) \(chars[3])\(chars[4])\(chars[5])"
  }

  private func key(_ title: String, enabled: Bool = true, action: @escaping () -> Void) -> some View {
    Button(title, action: action)
      .buttonStyle(.bordered)
      .tint(Color(red: 1, green: 0.302, blue: 0.180))
      .font(.system(size: 16, weight: .semibold))
      .frame(maxWidth: .infinity, minHeight: 32)
      .disabled(!enabled)
  }
}
