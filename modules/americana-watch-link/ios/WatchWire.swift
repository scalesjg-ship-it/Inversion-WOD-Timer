import Foundation

/// Line-delimited JSON for protocol version 1.
/// Field names match src/watch/protocol.ts.
enum WatchWire {
  static let version = 1
  static let serviceName = "Americana-Timer"
  static let maxBytes = 4096

  static func encodeLine(_ object: [String: Any]) -> String? {
    guard JSONSerialization.isValidJSONObject(object),
          let data = try? JSONSerialization.data(withJSONObject: object),
          data.count <= maxBytes,
          let text = String(data: data, encoding: .utf8) else {
      return nil
    }
    return text + "\n"
  }

  static func commandLine(id: String, name: String) -> String? {
    guard ["start", "pause", "resume", "reset"].contains(name), !id.isEmpty, id.count <= 64 else {
      return nil
    }
    return encodeLine(["v": version, "type": "command", "id": id, "name": name])
  }

  static func decodeObject(_ line: String) -> [String: Any]? {
    let text = line.hasSuffix("\n") ? String(line.dropLast()) : line
    guard !text.isEmpty, let data = text.data(using: .utf8), data.count <= maxBytes,
          let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let version = object["v"] as? Int, version == WatchWire.version,
          object["type"] is String else {
      return nil
    }
    return object
  }
}

/// Buffers a TCP-style byte stream into JSON lines.
final class WatchFramer {
  private var buffer = Data()

  func reset() {
    buffer.removeAll(keepingCapacity: false)
  }

  func append(_ data: Data) -> [String] {
    if buffer.count + data.count > WatchWire.maxBytes * 4 {
      buffer.removeAll(keepingCapacity: false)
    }
    buffer.append(data)
    var lines: [String] = []
    while let newline = buffer.firstIndex(of: 0x0A) {
      let line = buffer.subdata(in: buffer.startIndex..<newline)
      buffer.removeSubrange(buffer.startIndex...newline)
      guard line.count <= WatchWire.maxBytes, let text = String(data: line, encoding: .utf8), !text.isEmpty else {
        continue
      }
      lines.append(text)
    }
    return lines
  }
}
