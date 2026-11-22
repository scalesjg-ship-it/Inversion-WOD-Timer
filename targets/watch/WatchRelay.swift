import CryptoKit
import Foundation
import Security

/// Supabase Realtime broadcast for Apple TV HD.
/// HMAC-SHA256 matches src/watch/relay/crypto.ts: key is the raw secret bytes,
/// and the signed UTF-8 string is `1.<seq>.<ts>.<body>`.
struct WatchRelayConfig {
  var url: String
  var anonKey: String

  static let current: WatchRelayConfig = {
    let url = (Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let key = (Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    return WatchRelayConfig(url: url, anonKey: key)
  }()

  var isConfigured: Bool {
    url.hasPrefix("https://") && !url.contains("$(") && anonKey.count >= 20 && !anonKey.contains("$(")
  }
}

struct WatchRelayRecord: Codable, Equatable {
  var pairingId: String
  var secret: String
  var pairedAt: Double
}

enum WatchRelayStore {
  private static let key = "americana.watch.relay.v1"

  static func load() -> WatchRelayRecord? {
    guard let data = UserDefaults.standard.data(forKey: key),
          let record = try? JSONDecoder().decode(WatchRelayRecord.self, from: data),
          isHex(record.pairingId, count: 32),
          isHex(record.secret, count: 64) else {
      return nil
    }
    return record
  }

  static func save(_ record: WatchRelayRecord) {
    guard let data = try? JSONEncoder().encode(record) else { return }
    UserDefaults.standard.set(data, forKey: key)
  }

  static func clear() {
    UserDefaults.standard.removeObject(forKey: key)
  }
}

@MainActor
final class WatchRelayClient {
  var onLine: ((String) -> Void)?
  var onStatus: ((String, Bool) -> Void)?

  private(set) var isConnected = false
  private(set) var hasPairing = false
  private var record: WatchRelayRecord?
  private var task: URLSessionWebSocketTask?
  private var socket: URLSession?
  private var mode: Mode = .idle
  private var topic = ""
  private var helloNonce = ""
  private var generation = 0
  private var attempt = 0
  private var seq = 0
  private var ref = 1
  private var joined = false
  private var heart: Task<Void, Never>?
  private var retry: Task<Void, Never>?
  private var seen: [String: Int64] = [:]
  private let config = WatchRelayConfig.current

  init() {
    record = WatchRelayStore.load()
    hasPairing = record != nil
  }

  func resumeStored() {
    guard let record else { return }
    hasPairing = true
    connect(channel: "americana-session-\(record.pairingId)", mode: .session, status: "Reconnecting…")
  }

  func resumeIfNeeded() {
    guard record != nil, !isConnected, mode != .handshake else { return }
    attempt = 0
    resumeStored()
  }

  func pair(code: String) {
    let digits = code.filter(\.isNumber)
    guard digits.count == 6 else { return }
    guard config.isConfigured else {
      report("Pairing keys are not on this watch yet", connected: false)
      return
    }
    helloNonce = WatchRelayHex.random(16)
    attempt = 0
    connect(channel: "americana-pair-\(digits)", mode: .handshake, status: "Connecting…")
  }

  func sendLine(_ line: String) {
    guard isConnected, mode == .session, let record, joined else { return }
    let body = line.hasSuffix("\n") ? String(line.dropLast()) : line
    seq += 1
    let ts = Int64(Date().timeIntervalSince1970 * 1000)
    guard let mac = WatchRelayMac.hex(secretHex: record.secret, seq: seq, ts: ts, body: body) else { return }
    sendPayload([
      "v": 1,
      "type": "relay",
      "seq": NSNumber(value: seq),
      "ts": NSNumber(value: ts),
      "body": body,
      "mac": mac,
    ])
  }

  func forget() {
    generation += 1
    closeSocket()
    record = nil
    hasPairing = false
    isConnected = false
    mode = .idle
    WatchRelayStore.clear()
    report("Waiting for Apple TV", connected: false)
  }

  private enum Mode {
    case idle
    case handshake
    case session
  }

  private func connect(channel: String, mode: Mode, status: String) {
    guard config.isConfigured else {
      report("Pairing keys are not on this watch yet", connected: false)
      return
    }
    generation += 1
    let gen = generation
    closeSocket()
    self.mode = mode
    topic = "realtime:\(channel)"
    isConnected = false
    joined = false
    report(status, connected: false)
    guard let url = socketURL() else {
      report("Pairing keys are not on this watch yet", connected: false)
      return
    }
    let session = URLSession(configuration: .default)
    let next = session.webSocketTask(with: url)
    socket = session
    task = next
    next.resume()
    receive(gen: gen, channel: channel)
    let join = WatchRelayFrame.join(channel: channel, accessToken: config.anonKey)
    next.send(.string(join)) { [weak self] error in
      if error != nil {
        Task { @MainActor in self?.drop(gen: gen) }
      }
    }
    heart = Task { @MainActor [weak self] in
      while !Task.isCancelled {
        try? await Task.sleep(nanoseconds: 20_000_000_000)
        self?.beat(gen: gen)
      }
    }
  }

  private func beat(gen: Int) {
    guard gen == generation, joined, let task else { return }
    ref += 1
    task.send(.string(WatchRelayFrame.heartbeat(ref: ref))) { _ in }
  }

  private func receive(gen: Int, channel: String) {
    task?.receive { [weak self] result in
      Task { @MainActor in
        guard let self, gen == self.generation else { return }
        switch result {
        case .success(.string(let text)):
          self.handle(text, channel: channel, gen: gen)
          self.receive(gen: gen, channel: channel)
        case .success:
          self.receive(gen: gen, channel: channel)
        case .failure:
          self.drop(gen: gen)
        }
      }
    }
  }

  private func handle(_ text: String, channel: String, gen: Int) {
    guard let frame = WatchRelayFrame.parse(text) else { return }
    let topic = "realtime:\(channel)"
    switch frame {
    case .reply(let ref, let ok, let frameTopic):
      guard ref == "1", frameTopic == topic else { return }
      if !ok {
        drop(gen: gen)
        return
      }
      joined = true
      attempt = 0
      if mode == .handshake {
        sendPayload(["v": 1, "kind": "hello", "nonce": helloNonce])
      } else {
        isConnected = true
        report("Apple TV", connected: true)
      }
    case .broadcast(let frameTopic, let event, let payload):
      guard frameTopic == topic, event == "americana" else { return }
      if mode == .handshake {
        noteOffer(payload)
      } else {
        noteEnvelope(payload)
      }
    case .closed(let frameTopic):
      if frameTopic == topic { drop(gen: gen) }
    case .other:
      break
    }
  }

  private func noteOffer(_ payload: [String: Any]) {
    guard (payload["v"] as? Int) == 1, (payload["kind"] as? String) == "offer",
          let pairingId = payload["pairingId"] as? String, isHex(pairingId, count: 32),
          let secret = payload["secret"] as? String, isHex(secret, count: 64) else {
      return
    }
    let saved = WatchRelayRecord(pairingId: pairingId, secret: secret, pairedAt: Date().timeIntervalSince1970)
    record = saved
    hasPairing = true
    WatchRelayStore.save(saved)
    sendPayload(["v": 1, "kind": "accept", "pairingId": pairingId, "nonce": helloNonce])
    Task { @MainActor [weak self] in
      try? await Task.sleep(nanoseconds: 250_000_000)
      self?.connect(channel: "americana-session-\(pairingId)", mode: .session, status: "Connecting…")
    }
  }

  private func noteEnvelope(_ payload: [String: Any]) {
    guard let record,
          (payload["v"] as? Int) == 1,
          (payload["type"] as? String) == "relay",
          let seq = (payload["seq"] as? NSNumber)?.int64Value, seq >= 1,
          let ts = (payload["ts"] as? NSNumber)?.int64Value,
          let body = payload["body"] as? String,
          let mac = payload["mac"] as? String else {
      return
    }
    let now = Int64(Date().timeIntervalSince1970 * 1000)
    if abs(now - ts) > 60_000 { return }
    guard WatchRelayMac.valid(secretHex: record.secret, seq: seq, ts: ts, body: body, mac: mac) else { return }
    pruneSeen(now: now)
    if seen[mac] != nil { return }
    seen[mac] = now
    onLine?(body)
  }

  private func sendPayload(_ payload: [String: Any]) {
    guard joined, let task else { return }
    ref += 1
    guard let text = WatchRelayFrame.broadcast(topic: topic, ref: ref, payload: payload) else { return }
    task.send(.string(text)) { _ in }
  }

  private func drop(gen: Int) {
    guard gen == generation else { return }
    generation += 1
    closeSocket()
    isConnected = false
    joined = false
    attempt += 1
    let delay = relayDelay(attempt)
    let pairing = record
    let handshake = mode == .handshake
    report(handshake ? "Check the code and the internet" : "Reconnecting…", connected: false)
    retry?.cancel()
    retry = Task { @MainActor [weak self] in
      try? await Task.sleep(nanoseconds: delay)
      guard let self else { return }
      if handshake {
        self.report("Check the code and the internet", connected: false)
        return
      }
      guard let pairing else { return }
      self.connect(channel: "americana-session-\(pairing.pairingId)", mode: .session, status: "Reconnecting…")
    }
  }

  private func closeSocket() {
    heart?.cancel()
    heart = nil
    retry?.cancel()
    retry = nil
    task?.cancel(with: .goingAway, reason: nil)
    task = nil
    socket?.invalidateAndCancel()
    socket = nil
    joined = false
  }

  private func report(_ text: String, connected: Bool) {
    isConnected = connected
    onStatus?(text, connected)
  }

  private func socketURL() -> URL? {
    let root = config.url.hasSuffix("/") ? String(config.url.dropLast()) : config.url
    let ws = root.replacingOccurrences(of: "https://", with: "wss://")
    var allowed = CharacterSet.alphanumerics
    allowed.insert(charactersIn: "-_.~")
    let key = config.anonKey.addingPercentEncoding(withAllowedCharacters: allowed) ?? config.anonKey
    return URL(string: "\(ws)/realtime/v1/websocket?apikey=\(key)&vsn=1.0.0")
  }

  private func pruneSeen(now: Int64) {
    seen = seen.filter { now - $0.value <= 60_000 }
  }

  private func relayDelay(_ attempt: Int) -> UInt64 {
    let exp = min(max(attempt, 1) - 1, 5)
    let ms = min(15_000, 500 * (1 << exp))
    return UInt64(ms) * 1_000_000
  }
}

private enum WatchRelayFrame {
  case reply(ref: String, ok: Bool, topic: String)
  case broadcast(topic: String, event: String, payload: [String: Any])
  case closed(topic: String)
  case other

  static func join(channel: String, accessToken: String) -> String {
    let config: [String: Any] = [
      "broadcast": ["ack": false, "self": false] as [String: Any],
      "presence": ["enabled": false] as [String: Any],
      "private": false,
    ]
    let payload: [String: Any] = ["config": config, "access_token": accessToken]
    let message: [String: Any] = [
      "topic": "realtime:\(channel)",
      "event": "phx_join",
      "payload": payload,
      "ref": "1",
      "join_ref": "1",
    ]
    return json(message) ?? "{}"
  }

  static func heartbeat(ref: Int) -> String {
    let message: [String: Any] = [
      "topic": "phoenix",
      "event": "heartbeat",
      "payload": [String: Any](),
      "ref": String(ref),
    ]
    return json(message) ?? "{}"
  }

  static func broadcast(topic: String, ref: Int, payload: [String: Any]) -> String? {
    let envelope: [String: Any] = [
      "topic": topic,
      "event": "broadcast",
      "payload": [
        "type": "broadcast",
        "event": "americana",
        "payload": payload,
      ] as [String: Any],
      "ref": String(ref),
      "join_ref": "1",
    ]
    return json(envelope)
  }

  static func parse(_ text: String) -> WatchRelayFrame? {
    guard let data = text.data(using: .utf8),
          let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      return .other
    }
    let topic = object["topic"] as? String ?? ""
    let event = object["event"] as? String ?? ""
    let ref: String
    if let text = object["ref"] as? String {
      ref = text
    } else if let number = object["ref"] as? NSNumber {
      ref = number.stringValue
    } else {
      ref = ""
    }
    if event == "phx_close" || event == "phx_error" { return .closed(topic: topic) }
    if event == "phx_reply", let payload = object["payload"] as? [String: Any] {
      return .reply(ref: ref, ok: (payload["status"] as? String) == "ok", topic: topic)
    }
    if event == "broadcast", let payload = object["payload"] as? [String: Any] {
      let user = payload["event"] as? String ?? ""
      let body = payload["payload"] as? [String: Any] ?? [:]
      return .broadcast(topic: topic, event: user, payload: body)
    }
    return .other
  }

  private static func json(_ object: [String: Any]) -> String? {
    guard JSONSerialization.isValidJSONObject(object),
          let data = try? JSONSerialization.data(withJSONObject: object),
          let text = String(data: data, encoding: .utf8) else {
      return nil
    }
    return text
  }
}

private enum WatchRelayMac {
  static func hex(secretHex: String, seq: Int, ts: Int64, body: String) -> String? {
    guard let key = WatchRelayHex.decode(secretHex) else { return nil }
    let canonical = Data("1.\(seq).\(ts).\(body)".utf8)
    let code = HMAC<SHA256>.authenticationCode(for: canonical, using: SymmetricKey(data: key))
    return WatchRelayHex.encode(Data(code))
  }

  static func valid(secretHex: String, seq: Int64, ts: Int64, body: String, mac: String) -> Bool {
    guard let key = WatchRelayHex.decode(secretHex), let macData = WatchRelayHex.decode(mac) else { return false }
    let canonical = Data("1.\(seq).\(ts).\(body)".utf8)
    return HMAC<SHA256>.isValidAuthenticationCode(macData, authenticating: canonical, using: SymmetricKey(data: key))
  }
}

private enum WatchRelayHex {
  static func encode(_ data: Data) -> String {
    data.map { String(format: "%02x", $0) }.joined()
  }

  static func decode(_ text: String) -> Data? {
    guard text.count % 2 == 0, text.allSatisfy(isHexCharacter) else { return nil }
    var data = Data(capacity: text.count / 2)
    var index = text.startIndex
    while index < text.endIndex {
      let next = text.index(index, offsetBy: 2)
      guard let byte = UInt8(text[index..<next], radix: 16) else { return nil }
      data.append(byte)
      index = next
    }
    return data
  }

  static func random(_ count: Int) -> String {
    var bytes = [UInt8](repeating: 0, count: count)
    let status = SecRandomCopyBytes(kSecRandomDefault, count, &bytes)
    if status != errSecSuccess {
      for index in bytes.indices { bytes[index] = UInt8.random(in: 0...255) }
    }
    return encode(Data(bytes))
  }
}

private func isHexCharacter(_ character: Character) -> Bool {
  switch character {
  case "0"..."9", "a"..."f", "A"..."F":
    return true
  default:
    return false
  }
}

private func isHex(_ text: String, count: Int) -> Bool {
  guard text.count == count else { return false }
  return text.allSatisfy { character in
    switch character {
    case "0"..."9", "a"..."f":
      return true
    default:
      return false
    }
  }
}
