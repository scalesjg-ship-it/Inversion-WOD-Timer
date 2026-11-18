import XCTest

/// Drives the Apple TV simulator with the Siri Remote.
///
/// Tabs open when they gain focus. Select on the focused tab leaves that
/// screen open. For Time keeps Pause, Stop, and Reset mounted. Select and
/// Menu pause a running clock and stay on the timer. The next Menu leaves.
final class AmericanaRemoteUITests: XCTestCase {
  private let app = XCUIApplication()
  private let remote = XCUIRemote.shared
  private var lines: [String] = []

  override func setUpWithError() throws {
    continueAfterFailure = true
    app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
    app.launch()
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 30), "App did not stay in the foreground")
  }

  override func tearDownWithError() throws {
    let body = lines.joined(separator: "\n")
    print("APPLETV_REPORT_BEGIN")
    print(body)
    print("APPLETV_REPORT_END")
    let attachment = XCTAttachment(string: body)
    attachment.name = "step-report.txt"
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  func testRemoteTabsAndTimerControls() {
    step("tab WOD") { openWodTab() }
    step("tab Rounds") { openTab("tab-rounds", screen: "screen-rounds", direction: .right) }
    step("tab Brand") { openTab("tab-brand", screen: "screen-brand", direction: .right) }
    step("remote left returns to Rounds") { openTab("tab-rounds", screen: "screen-rounds", direction: .left) }
    step("remote left returns to WOD") { openTab("tab-wod", screen: "screen-wod", direction: .left) }
    step("remote down leaves the tab bar") { downIntoContent() }
    step("remote up returns to the tab bar") { upToTabBar() }
    step("remote select keeps the focused tab open") { selectFocusedTab() }

    step("focus starts on Pause") {
      startForTime()
      return assertPauseFocused()
    }
    step("clock reaches For Time work") { waitForWorkPhase() }
    step("Select pauses and focus stays on Resume") { selectPausesOntoResume() }
    step("Resume continues") { resumeContinues() }
    step("Play/Pause toggles") { playPauseToggles() }
    step("Stop (For Time)") { stopForTime() }
    step("Reset") { resetForTime() }
    step("Menu pauses rather than leaving") {
      startAgainIfNeeded()
      return menuPausesAndStays()
    }
    step("second Menu leaves the timer") { secondMenuLeaves() }
  }

  // MARK: - Steps

  private func openWodTab() -> String {
    XCTAssertTrue(
      any("mode-forTime").waitForExistence(timeout: 90) || any("screen-wod").waitForExistence(timeout: 5),
      "WOD did not appear. \(snapshot())"
    )
    guard any("screen-wod").exists || any("mode-forTime").exists else {
      return "WOD screen missing. \(snapshot())"
    }
    let tab = ensureTabFocused()
    XCTAssertTrue(tab == "tab-wod", "Up from the home card should land on WOD. \(snapshot())")
    XCTAssertTrue(any("screen-wod").exists, "WOD copy left the screen. \(snapshot())")
    press(.select, settle: 0.6)
    XCTAssertTrue(any("screen-wod").exists, "Select on WOD left the tab. \(snapshot())")
    return "focus=\(focusedIdentifier()) screen=\(any("screen-wod").exists)"
  }

  private func openTab(_ id: String, screen: String, direction: XCUIRemote.Button) -> String {
    _ = ensureTabFocused()
    if !(any(screen).exists && (focused(id) || tabSelected(id))) {
      for _ in 0..<3 {
        press(direction, settle: 0.85)
        if any(screen).exists { break }
      }
    }
    let opened = any(screen).waitForExistence(timeout: 8)
    XCTAssertTrue(opened, "\(screen) did not open. \(snapshot())")
    if !focused(id) {
      _ = ensureTabFocused()
    }
    if let current = focusedTab(), current != id {
      for _ in 0..<3 where focusedTab() != id {
        press(direction, settle: 0.7)
      }
    }
    if focused(id) {
      press(.select, settle: 0.6)
    }
    XCTAssertTrue(any(screen).exists, "Select closed \(screen). \(snapshot())")
    XCTAssertTrue(focused(id) || tabSelected(id), "\(id) is not the open tab. \(snapshot())")
    return "opened=\(opened) focus=\(focused(id)) selected=\(tabSelected(id)) \(snapshot())"
  }

  private func downIntoContent() -> String {
    _ = ensureTabFocused()
    press(.down, settle: 0.7)
    let onTab = focusedTab() != nil
    XCTAssertFalse(onTab, "Down stayed on the tab bar. \(snapshot())")
    XCTAssertTrue(
      any("screen-wod").exists || any("mode-forTime").exists,
      "Down left the WOD screen. \(snapshot())"
    )
    return "focus=\(focusedIdentifier())"
  }

  private func upToTabBar() -> String {
    let tab = ensureTabFocused()
    XCTAssertNotNil(tab, "Up did not reach the tab bar. \(snapshot())")
    XCTAssertTrue(any("screen-wod").exists, "Up left WOD. \(snapshot())")
    return "tab=\(tab ?? "none")"
  }

  private func selectFocusedTab() -> String {
    let tab = ensureTabFocused()
    XCTAssertNotNil(tab, "No tab focused before Select. \(snapshot())")
    let screenBefore = any("screen-wod").exists
    press(.select, settle: 0.6)
    XCTAssertTrue(any("screen-wod").exists == screenBefore && any("screen-wod").exists, "Select changed tabs. \(snapshot())")
    XCTAssertEqual(focusedTab(), tab, "Select moved focus off \(tab ?? "?"). \(snapshot())")
    return "tab=\(tab ?? "none") stillWod=\(any("screen-wod").exists)"
  }

  private func assertPauseFocused() -> String {
    XCTAssertTrue(any("timer-pause").waitForExistence(timeout: 15), "Pause never appeared. \(snapshot())")
    let focusedPause = waitFocus("timer-pause", timeout: 6)
    let label = any("timer-pause").label
    XCTAssertTrue(focusedPause, "Focus did not start on Pause. \(snapshot())")
    XCTAssertTrue(label.contains("Pause"), "Focused control label was \(label). \(snapshot())")
    XCTAssertTrue(any("timer-face").exists, "Timer screen was not showing. \(snapshot())")
    return "label=\(label) focus=\(focusedPause) face=\(any("timer-face").label)"
  }

  private func waitForWorkPhase() -> String {
    let ready = waitFace(prefix: "For time", timeout: 25)
    XCTAssertTrue(ready, "For Time did not reach work. face=\(faceLabel()) \(snapshot())")
    XCTAssertTrue(any("timer-stop").waitForExistence(timeout: 5), "Stop was not on the For Time clock. \(snapshot())")
    return "face=\(faceLabel())"
  }

  private func selectPausesOntoResume() -> String {
    if !focused("timer-pause") {
      _ = nudge("timer-pause", directions: [.left, .up, .down], limit: 6)
    }
    press(.select, settle: 0.8)
    let paused = waitFace(containing: "Paused", timeout: 6)
    let resumeFocused = waitFocus("timer-pause", timeout: 4)
    let label = any("timer-pause").label
    let stillThere = any("timer-face").exists && app.state == .runningForeground
    let held = clockHeld(from: clockSeconds())
    XCTAssertTrue(stillThere, "Select left the timer. state=\(app.state.rawValue) \(snapshot())")
    XCTAssertTrue(paused, "Select did not pause. face=\(faceLabel()) \(snapshot())")
    XCTAssertTrue(label.contains("Resume"), "Pause label did not become Resume (\(label)). \(snapshot())")
    XCTAssertTrue(resumeFocused && label.contains("Resume"), "Focus was not on Resume. \(snapshot())")
    XCTAssertTrue(held, "Clock kept moving after Select. now=\(clockSeconds() ?? -1) face=\(faceLabel())")
    return "label=\(label) face=\(faceLabel()) focus=\(focused("timer-pause"))"
  }

  private func resumeContinues() -> String {
    if !focused("timer-pause") {
      _ = nudge("timer-pause", directions: [.left, .up], limit: 6)
    }
    let before = clockSeconds()
    press(.select, settle: 0.8)
    let running = waitFace(timeout: 6) { $0.hasPrefix("For time") && !$0.contains("Paused") }
    let label = any("timer-pause").label
    let advanced = waitClockChange(from: before, timeout: 4)
    XCTAssertTrue(any("timer-face").exists, "Resume left the timer. \(snapshot())")
    XCTAssertTrue(running, "Resume did not continue. face=\(faceLabel()) \(snapshot())")
    XCTAssertTrue(label.contains("Pause"), "Label stayed \(label). \(snapshot())")
    XCTAssertTrue(advanced, "Clock did not advance after Resume. before=\(before ?? -1) now=\(clockSeconds() ?? -1)")
    return "label=\(label) face=\(faceLabel())"
  }

  private func playPauseToggles() -> String {
    let before = clockSeconds()
    press(.playPause, settle: 0.9)
    let paused = waitFace(containing: "Paused", timeout: 6)
    let pausedLabel = any("timer-pause").label
    XCTAssertTrue(any("timer-face").exists, "Play/Pause left the timer. \(snapshot())")
    XCTAssertTrue(paused, "Play/Pause did not pause. face=\(faceLabel()) \(snapshot())")
    XCTAssertTrue(pausedLabel.contains("Resume"), "Label was \(pausedLabel) after Play/Pause. \(snapshot())")
    let held = clockHeld(from: clockSeconds())
    XCTAssertTrue(held, "Clock moved while Play/Pause had paused it")
    press(.playPause, settle: 0.9)
    let resumed = waitFace(timeout: 6) { $0.hasPrefix("For time") && !$0.contains("Paused") }
    let advanced = waitClockChange(from: before, timeout: 4)
    let resumeLabel = any("timer-pause").label
    XCTAssertTrue(resumed, "Second Play/Pause did not resume. face=\(faceLabel()) \(snapshot())")
    XCTAssertTrue(resumeLabel.contains("Pause"), "Label was \(resumeLabel) after the second Play/Pause. \(snapshot())")
    XCTAssertTrue(advanced, "Clock did not advance after Play/Pause resumed")
    return "after=\(faceLabel()) label=\(resumeLabel)"
  }

  private func stopForTime() -> String {
    if faceLabel().contains("Paused") == false {
      if !focused("timer-pause") { _ = nudge("timer-pause", directions: [.left], limit: 4) }
      press(.select, settle: 0.7)
      XCTAssertTrue(waitFace(containing: "Paused", timeout: 6), "Could not pause before Stop. \(snapshot())")
    }
    XCTAssertTrue(nudge("timer-stop", directions: [.right, .left], limit: 4), "Could not focus Stop. \(snapshot())")
    press(.select, settle: 0.8)
    let stopped = waitFace(prefix: "Time,", timeout: 6)
    let gone = waitGone("timer-stop", timeout: 5)
    let again = any("timer-start").waitForExistence(timeout: 5) && any("timer-start").label.contains("Go again")
    XCTAssertTrue(any("timer-face").exists, "Stop left the timer. \(snapshot())")
    XCTAssertTrue(stopped, "Stop did not finish the clock. face=\(faceLabel()) \(snapshot())")
    XCTAssertTrue(gone, "Stop stayed on screen. \(snapshot())")
    XCTAssertTrue(again, "Go again was not shown. label=\(any("timer-start").label) \(snapshot())")
    return "face=\(faceLabel()) goAgain=\(any("timer-start").label)"
  }

  private func resetForTime() -> String {
    XCTAssertTrue(nudge("timer-reset", directions: [.right, .left], limit: 4), "Could not focus Reset. \(snapshot())")
    press(.select, settle: 0.8)
    let idle = waitFace(prefix: "For Time", timeout: 6)
    let startShown = any("timer-start").waitForExistence(timeout: 5)
    let startLabel = any("timer-start").label
    let clock = clockSeconds()
    XCTAssertTrue(any("timer-face").exists, "Reset left the timer. \(snapshot())")
    XCTAssertTrue(idle, "Reset did not return to For Time. face=\(faceLabel()) \(snapshot())")
    XCTAssertTrue(startShown && startLabel.contains("Start"), "Start was not shown after Reset (\(startLabel)). \(snapshot())")
    XCTAssertEqual(clock, Optional(0), "Reset clock was \(faceLabel())")
    XCTAssertFalse(any("timer-stop").exists, "Stop remained after Reset. \(snapshot())")
    return "face=\(faceLabel()) start=\(startLabel)"
  }

  private func menuPausesAndStays() -> String {
    XCTAssertTrue(any("timer-pause").waitForExistence(timeout: 10), "Pause missing before Menu. \(snapshot())")
    press(.menu, settle: 1.0)
    let paused = waitFace(containing: "Paused", timeout: 6)
    let stayed = any("timer-face").exists && app.state == .runningForeground
    let label = any("timer-pause").exists ? any("timer-pause").label : ""
    XCTAssertTrue(stayed, "Menu left the timer. state=\(app.state.rawValue) \(snapshot())")
    XCTAssertTrue(paused, "Menu did not pause. face=\(faceLabel()) \(snapshot())")
    XCTAssertTrue(label.contains("Resume"), "Menu did not show Resume (\(label)). \(snapshot())")
    return "label=\(label) face=\(faceLabel()) state=\(app.state.rawValue)"
  }

  private func secondMenuLeaves() -> String {
    press(.menu, settle: 1.0)
    let left = waitGone("timer-face", timeout: 8)
    let landed = any("screen-setup").waitForExistence(timeout: 6)
      || any("screen-wod").exists
      || any("mode-forTime").exists
    XCTAssertTrue(left, "Second Menu stayed on the timer. face=\(faceLabel()) \(snapshot())")
    XCTAssertTrue(landed, "Second Menu did not return to setup or WOD. \(snapshot())")
    XCTAssertEqual(app.state, .runningForeground, "Second Menu backgrounded the app")
    let whereTo = any("screen-setup").exists ? "setup" : (any("screen-wod").exists ? "wod" : "other")
    return "landed=\(whereTo) state=\(app.state.rawValue)"
  }

  // MARK: - Navigation

  @discardableResult
  private func startForTime() -> String {
    if any("timer-pause").exists || any("timer-face").exists {
      return "already on timer"
    }
    if !any("screen-setup").exists {
      _ = ensureTabFocused()
      for _ in 0..<4 where !any("screen-wod").exists && !any("mode-forTime").exists {
        press(.left, settle: 0.7)
      }
      XCTAssertTrue(nudge("mode-forTime", directions: [.down, .left], limit: 8), "Could not focus For Time. \(snapshot())")
      press(.select, settle: 0.9)
      XCTAssertTrue(any("screen-setup").waitForExistence(timeout: 12), "Setup did not open. \(snapshot())")
    }
    XCTAssertTrue(nudge("start-timer", directions: [.down, .right], limit: 16), "Could not focus Start. \(snapshot())")
    press(.select, settle: 0.9)
    XCTAssertTrue(any("timer-face").waitForExistence(timeout: 15), "Timer did not open. \(snapshot())")
    return "face=\(faceLabel())"
  }

  private func startAgainIfNeeded() -> String {
    if any("timer-pause").exists && faceLabel().contains("Paused") == false && faceLabel().hasPrefix("For Time") == false {
      return "already running"
    }
    if any("timer-start").exists {
      XCTAssertTrue(nudge("timer-start", directions: [.left, .right, .up], limit: 4), "Could not focus Start. \(snapshot())")
      press(.select, settle: 0.8)
      XCTAssertTrue(any("timer-pause").waitForExistence(timeout: 10), "Start did not run the clock. \(snapshot())")
      return "restarted face=\(faceLabel())"
    }
    return startForTime()
  }

  @discardableResult
  private func ensureTabFocused() -> String? {
    if let tab = focusedTab() { return tab }
    for _ in 0..<10 {
      press(.up, settle: 0.55)
      if let tab = focusedTab() { return tab }
    }
    return nil
  }

  private func focusedTab() -> String? {
    for id in ["tab-wod", "tab-rounds", "tab-brand"] where focused(id) {
      return id
    }
    return nil
  }

  private func tabSelected(_ id: String) -> Bool {
    let tab = any(id)
    return tab.exists && tab.isSelected
  }

  @discardableResult
  private func nudge(_ id: String, directions: [XCUIRemote.Button], limit: Int) -> Bool {
    if focused(id) { return true }
    if !any(id).exists { return false }
    for _ in 0..<limit {
      for direction in directions {
        press(direction, settle: 0.4)
        if focused(id) { return true }
      }
    }
    return focused(id)
  }

  // MARK: - Remote and queries

  private func press(_ button: XCUIRemote.Button, settle: TimeInterval) {
    remote.press(button)
    Thread.sleep(forTimeInterval: settle)
  }

  private func any(_ id: String) -> XCUIElement {
    app.descendants(matching: .any)[id]
  }

  private func focused(_ id: String) -> Bool {
    let element = any(id)
    return element.exists && element.hasFocus
  }

  private func waitFocus(_ id: String, timeout: TimeInterval) -> Bool {
    let element = any(id)
    if element.exists && element.hasFocus { return true }
    let expectation = XCTNSPredicateExpectation(predicate: NSPredicate(format: "hasFocus == true"), object: element)
    return XCTWaiter().wait(for: [expectation], timeout: timeout) == .completed
  }

  private func faceLabel() -> String {
    let face = any("timer-face")
    return face.exists ? face.label : ""
  }

  private func waitFace(prefix: String, timeout: TimeInterval) -> Bool {
    waitFace(timeout: timeout) { $0.hasPrefix(prefix) }
  }

  private func waitFace(containing needle: String, timeout: TimeInterval) -> Bool {
    waitFace(timeout: timeout) { $0.contains(needle) }
  }

  private func waitFace(timeout: TimeInterval, matches: (String) -> Bool) -> Bool {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if matches(faceLabel()) { return true }
      Thread.sleep(forTimeInterval: 0.25)
    }
    return matches(faceLabel())
  }

  private func waitGone(_ id: String, timeout: TimeInterval) -> Bool {
    let element = any(id)
    if !element.exists { return true }
    let expectation = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: element)
    return XCTWaiter().wait(for: [expectation], timeout: timeout) == .completed
  }

  private func clockSeconds() -> Int? {
    guard let range = faceLabel().range(of: #"(\d{1,2}):(\d{2})"#, options: .regularExpression) else { return nil }
    let token = String(faceLabel()[range])
    let parts = token.split(separator: ":")
    guard parts.count == 2, let minutes = Int(parts[0]), let seconds = Int(parts[1]) else { return nil }
    return minutes * 60 + seconds
  }

  private func clockHeld(from start: Int?) -> Bool {
    guard let start else { return false }
    Thread.sleep(forTimeInterval: 1.6)
    return clockSeconds() == start
  }

  private func waitClockChange(from start: Int?, timeout: TimeInterval) -> Bool {
    guard let start else { return false }
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if let now = clockSeconds(), now != start { return true }
      Thread.sleep(forTimeInterval: 0.3)
    }
    return false
  }

  private func focusedIdentifier() -> String {
    let focused = app.descendants(matching: .any).matching(NSPredicate(format: "hasFocus == true"))
    guard focused.firstMatch.exists else { return "none" }
    let element = focused.firstMatch
    let identifier = element.identifier.isEmpty ? "(no id)" : element.identifier
    return "\(identifier) [\(element.label)]"
  }

  private func snapshot() -> String {
    "focus=\(focusedIdentifier()) face=\(faceLabel()) fg=\(app.state == .runningForeground)"
  }

  private func step(_ name: String, body: () -> String) {
    XCTContext.runActivity(named: name) { _ in
      let before = testRun?.failureCount ?? 0
      let detail = body()
      let failed = (testRun?.failureCount ?? 0) > before
      let status = failed ? "fail" : "pass"
      let line = "\(status)\t\(name)\t\(detail)"
      lines.append(line)
      print("APPLETV_STEP \(line)")
      let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
      shot.name = name
      shot.lifetime = .keepAlways
      add(shot)
    }
  }
}
