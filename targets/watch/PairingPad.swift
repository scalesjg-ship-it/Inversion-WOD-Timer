import SwiftUI

/// Six large digits, delete, and OK. The digital crown is left alone so a mis-turn cannot change the code.
/// The column scrolls on the 40mm and 41mm faces so the code, the instruction, and the keys never share a pixel.
struct PairingPad: View {
  let digits: String
  let status: String
  let onDigit: (String) -> Void
  let onDelete: () -> Void
  let onSubmit: () -> Void
  let onCancel: () -> Void

  private let rows = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]]

  var body: some View {
    GeometryReader { geo in
      let width = geo.size.width
      let keyHeight = keyHeight(for: width)
      ScrollView {
        VStack(spacing: 8) {
          Text(display)
            .font(.system(size: 22, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(Color(red: 0.957, green: 0.969, blue: 0.984))
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .frame(maxWidth: .infinity)
          Text(status)
            .font(.system(size: 13))
            .foregroundStyle(Color(red: 0.576, green: 0.627, blue: 0.690))
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity)
          ForEach(rows, id: \.self) { row in
            HStack(spacing: 6) {
              ForEach(row, id: \.self) { digit in
                key(digit, height: keyHeight) { onDigit(digit) }
              }
            }
          }
          HStack(spacing: 6) {
            key("⌫", height: keyHeight, action: onDelete)
            key("0", height: keyHeight) { onDigit("0") }
            key("OK", height: keyHeight, enabled: digits.count == 6, action: onSubmit)
          }
          Button("Cancel", action: onCancel)
            .buttonStyle(.plain)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(Color(red: 0.576, green: 0.627, blue: 0.690))
            .frame(maxWidth: .infinity, minHeight: 36)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity)
      }
    }
    .background(Color(red: 0.027, green: 0.031, blue: 0.039).ignoresSafeArea())
  }

  /// 40mm is about 162pt wide. Keep each key at least 36pt so a finger still lands,
  /// and let the scroll view carry the instruction instead of squeezing it under the keys.
  private func keyHeight(for width: CGFloat) -> CGFloat {
    if width < 170 { return 36 }
    if width < 190 { return 40 }
    return 44
  }

  private var display: String {
    let filled = digits.padding(toLength: 6, withPad: "–", startingAt: 0)
    let chars = Array(filled)
    return "\(chars[0])\(chars[1])\(chars[2]) \(chars[3])\(chars[4])\(chars[5])"
  }

  private func key(_ title: String, height: CGFloat, enabled: Bool = true, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Text(title)
        .font(.system(size: 17, weight: .semibold))
        .frame(maxWidth: .infinity)
        .frame(height: height)
    }
    .buttonStyle(.bordered)
    .tint(Color(red: 1, green: 0.302, blue: 0.180))
    .disabled(!enabled)
  }
}

#Preview("Code entry") {
  PairingPad(
    digits: "814947",
    status: "That code was not accepted. It may be wrong or expired.",
    onDigit: { _ in },
    onDelete: {},
    onSubmit: {},
    onCancel: {}
  )
}
