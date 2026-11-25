import XCTest

/// Drives the Apple TV simulator with the Siri Remote.
///
/// Tabs open when they gain focus. Select on the focused tab leaves that
/// screen open. For Time keeps Pause, Finish, and Reset mounted. Select and
/// Menu pause a running clock and stay on the timer. The next Menu leaves.
final class AmericanaRemoteUITests: XCTestCase {
  private let app = XCUIApplication()
  private let remote = XCUIRemote.shared
  private var lines: [String] = []
  private var keptFace = ""
  private var keptClock: Int?

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
    step("tab Settings") { openTab("tab-settings", screen: "screen-settings", direction: .right) }
    step("tab Help") { openTab("tab-help", screen: "screen-help", direction: .right) }
    step("Help sections") { walkHelp() }
    step("remote left returns to Settings") { openTab("tab-settings", screen: "screen-settings", direction: .left) }
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
    step("paused For Time has no pairing prompt") { pausedTimerHasNoPairing() }
    step("Resume continues") { resumeContinues() }
    step("Play/Pause toggles") { playPauseToggles() }
    step("Finish (For Time)") { stopForTime() }
    step("Reset opens Are you sure") { openResetConfirm() }
    step("No keeps the finished timer") { declineResetKeepsTimer() }
    step("Yes resets") { confirmResetYes() }
    step("Menu pauses rather than leaving") {
      startAgainIfNeeded()
      return menuPausesAndStays()
    }
    step("second Menu leaves the timer") { secondMenuLeaves() }
  }

  /// Relaunches with `-AmericanaWatchStatus unsupported`. Apple TV HD cannot
  /// open DeviceDiscoveryUI. The timer stays clear. Settings, Watch, shows the code.
  func testWatchHdCodePairing() {
    app.terminate()
    app.launchArguments += ["-AmericanaWatchStatus", "unsupported"]
    app.launch()
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 30), "App did not stay in the foreground")
    step("HD pairing code is in Settings") { hdPairingCode() }
    step("HD opens For Time") { startForTime() }
    step("HD timer has no pairing prompt") { hdTimerHasNoPairing() }
  }

  func testIntervalPresets() {
    step("Intervals presets") { showIntervalPresets() }
  }

  /// Settings is a sidebar under the tab bar. Down from Settings lands on the
  /// first category, each category changes the pane, Right enters an option,
  /// and Left returns to that category. Up from the top of the sidebar reaches
  /// Settings again. Menu from an option returns to the sidebar, and Menu from
  /// the sidebar returns to the previous tab without leaving the app.
  func testSettingsMasterDetail() {
    step("open Settings") { openTab("tab-settings", screen: "screen-settings", direction: .right) }
    step("Down into the sidebar") { downToCategory("settings-category-brand", detail: "settings-detail-brand") }
    step("Down to Look") { downToCategory("settings-category-look", detail: "settings-detail-look") }
    step("Down to Display") { downToCategory("settings-category-display", detail: "settings-detail-display") }
    step("Down to Colors") { downToCategory("settings-category-colors", detail: "settings-detail-colors") }
    step("Down to Logo") { downToCategory("settings-category-logo", detail: "settings-detail-logo") }
    step("Right into options") { rightIntoLogoOptions() }
    step("Left back to the sidebar") { leftToSidebar("settings-category-logo") }
    step("Up to the Settings tab") { upSidebarToTab() }
    step("Menu from an option returns to the sidebar") { menuFromOptionToSidebar() }
    step("Menu from the sidebar leaves Settings") { menuFromSidebarLeavesSettings() }
  }

  /// Sound sits above Watch. Right enters the voice countdown switch.
  /// Select turns it on, Select again turns it off, and Left returns to Sound.
  func testSoundVoiceCountdown() {
    step("open Settings") { openTab("tab-settings", screen: "screen-settings", direction: .right) }
    step("Down to Sound") { downToSound() }
    step("Right into Voice countdown") { rightIntoVoiceCountdown() }
    step("Select turns voice countdown on") { setVoiceCountdown(true) }
    step("Select turns voice countdown off") { setVoiceCountdown(false) }
    step("Left returns to Sound") { leftToSound() }
  }

  /// Down from the lead-in minutes minus must leave that button. Save preset
  /// sits above Start, so a second Down reaches Start. Up returns to the row.
  func testDownFromLeadInMinusReachesStart() {
    step("open Tabata setup") { openTabataSetup() }
    step("focus lead-in minus") {
      XCTAssertTrue(
        nudge("lead-in-minutes-dec", directions: [.down, .left], limit: 16),
        "Could not focus lead-in minutes minus. \(snapshot())"
      )
      return focusedIdentifier()
    }
    step("Down from lead-in minus reaches Start") {
      press(.down, settle: 0.7)
      if !focused("start-timer") {
        press(.down, settle: 0.7)
      }
      if !focused("start-timer") {
        press(.down, settle: 0.7)
      }
      XCTAssertTrue(focused("start-timer"), "Down from lead-in minus did not reach Start. \(snapshot())")
      XCTAssertEqual(app.state, .runningForeground, "Down left the app")
      return focusedIdentifier()
    }
    step("Up from Start returns to the lead-in row") {
      press(.up, settle: 0.7)
      let onLeadIn = leadInFocused()
      if !onLeadIn {
        press(.up, settle: 0.7)
      }
      XCTAssertTrue(leadInFocused(), "Up from Start did not return to lead-in. \(snapshot())")
      XCTAssertEqual(app.state, .runningForeground, "Up left the app")
      return focusedIdentifier()
    }
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
    XCTAssertTrue(any("timer-finish").waitForExistence(timeout: 5), "Finish was not on the For Time clock. \(snapshot())")
    return "face=\(faceLabel())"
  }

  private func downToCategory(_ category: String, detail: String) -> String {
    press(.down, settle: 0.7)
    if !focused(category) {
      XCTAssertTrue(
        nudge(category, directions: [.down, .up], limit: 8),
        "Down did not focus \(category). \(snapshot())"
      )
    }
    XCTAssertTrue(any(detail).waitForExistence(timeout: 4), "\(detail) did not appear. \(snapshot())")
    for other in ["settings-detail-brand", "settings-detail-look", "settings-detail-display", "settings-detail-colors", "settings-detail-logo", "settings-detail-sound", "settings-detail-watch"] where other != detail {
      XCTAssertFalse(any(other).exists, "\(other) was still showing with \(detail). \(snapshot())")
    }
    XCTAssertEqual(app.state, .runningForeground, "Down left the app")
    return "focus=\(focusedIdentifier()) detail=\(detail)"
  }

  private func downToSound() -> String {
    _ = ensureTabFocused()
    press(.down, settle: 0.7)
    XCTAssertTrue(
      nudge("settings-category-sound", directions: [.down], limit: 8),
      "Down did not reach Sound. \(snapshot())"
    )
    XCTAssertTrue(any("settings-detail-sound").waitForExistence(timeout: 4), "Sound pane did not appear. \(snapshot())")
    XCTAssertTrue(any("voice-countdown").waitForExistence(timeout: 4), "Voice countdown was not in Sound. \(snapshot())")
    for other in ["settings-detail-brand", "settings-detail-look", "settings-detail-display", "settings-detail-colors", "settings-detail-logo"] {
      XCTAssertFalse(any(other).exists, "\(other) was still showing on Sound. \(snapshot())")
    }
    XCTAssertEqual(app.state, .runningForeground, "Down left the app")
    return "focus=\(focusedIdentifier())"
  }

  private func rightIntoVoiceCountdown() -> String {
    XCTAssertTrue(focused("settings-category-sound"), "Right was not taken from Sound. \(snapshot())")
    press(.right, settle: 0.75)
    XCTAssertTrue(
      focused("voice-countdown") || waitFocus("voice-countdown", timeout: 2),
      "Right from Sound did not focus Voice countdown. \(snapshot())"
    )
    XCTAssertTrue(any("settings-detail-sound").exists, "Right left the Sound pane. \(snapshot())")
    let label = any("voice-countdown").label
    XCTAssertTrue(label.contains("Voice countdown"), "Voice countdown label was \(label). \(snapshot())")
    XCTAssertFalse(voiceCountdownOn(), "Voice countdown did not start off. \(voiceCountdownDetail())")
    XCTAssertEqual(app.state, .runningForeground, "Right left the app")
    return voiceCountdownDetail()
  }

  private func setVoiceCountdown(_ on: Bool) -> String {
    if !focused("voice-countdown") {
      XCTAssertTrue(
        nudge("voice-countdown", directions: [.right, .left], limit: 4),
        "Could not focus Voice countdown. \(snapshot())"
      )
    }
    if voiceCountdownOn() != on {
      press(.select, settle: 0.8)
    }
    let matched = waitVoiceCountdown(on, timeout: 4)
    XCTAssertEqual(voiceCountdownOn(), on, "Voice countdown did not become \(on ? "On" : "Off"). \(voiceCountdownDetail())")
    XCTAssertTrue(matched, "Voice countdown did not update. \(voiceCountdownDetail())")
    XCTAssertTrue(focused("voice-countdown"), "Select left Voice countdown. \(snapshot())")
    return voiceCountdownDetail()
  }

  private func leftToSound() -> String {
    for _ in 0..<4 where !focused("settings-category-sound") {
      press(.left, settle: 0.65)
    }
    XCTAssertTrue(focused("settings-category-sound"), "Left did not return to Sound. \(snapshot())")
    XCTAssertTrue(any("settings-detail-sound").exists, "Left closed the Sound pane. \(snapshot())")
    XCTAssertTrue(any("voice-countdown").exists, "Left removed Voice countdown. \(snapshot())")
    XCTAssertFalse(voiceCountdownOn(), "Voice countdown was left on. \(voiceCountdownDetail())")
    XCTAssertEqual(app.state, .runningForeground, "Left left the app")
    return focusedIdentifier()
  }

  private func voiceCountdownOn() -> Bool {
    let toggle = any("voice-countdown")
    if let value = toggle.value as? String {
      if value == "1" || value.caseInsensitiveCompare("On") == .orderedSame { return true }
      if value == "0" || value.caseInsensitiveCompare("Off") == .orderedSame { return false }
    }
    if let number = toggle.value as? NSNumber {
      return number.intValue != 0
    }
    let label = toggle.label
    if label.contains("Off") { return false }
    return label.contains("On")
  }

  private func voiceCountdownDetail() -> String {
    let toggle = any("voice-countdown")
    return "label=\(toggle.label) value=\(String(describing: toggle.value))"
  }

  private func waitVoiceCountdown(_ on: Bool, timeout: TimeInterval) -> Bool {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if voiceCountdownOn() == on { return true }
      Thread.sleep(forTimeInterval: 0.2)
    }
    return voiceCountdownOn() == on
  }

  private func rightIntoLogoOptions() -> String {
    press(.right, settle: 0.75)
    let option = focused("logo-entry") || focused("logo-url") || focused("logo-url-load") || focused("logo-blur") || focused("reset-brand")
    XCTAssertTrue(option, "Right did not enter the logo options. \(snapshot())")
    XCTAssertFalse(focused("settings-category-logo"), "Right stayed on the sidebar. \(snapshot())")
    XCTAssertTrue(any("settings-detail-logo").exists, "Right left the logo pane. \(snapshot())")
    XCTAssertEqual(app.state, .runningForeground, "Right left the app")
    return focusedIdentifier()
  }

  private func leftToSidebar(_ category: String) -> String {
    for _ in 0..<4 where !focused(category) {
      press(.left, settle: 0.65)
    }
    XCTAssertTrue(focused(category), "Left did not return to \(category). \(snapshot())")
    XCTAssertTrue(any("settings-detail-logo").exists, "Left closed the logo pane. \(snapshot())")
    XCTAssertEqual(app.state, .runningForeground, "Left left the app")
    return focusedIdentifier()
  }

  private func upSidebarToTab() -> String {
    for _ in 0..<8 where !focused("tab-settings") {
      press(.up, settle: 0.5)
    }
    XCTAssertTrue(focused("tab-settings"), "Up did not reach Settings. \(snapshot())")
    XCTAssertTrue(any("screen-settings").exists, "Up left Settings. \(snapshot())")
    XCTAssertEqual(app.state, .runningForeground, "Up left the app")
    return focusedIdentifier()
  }

  private func menuFromOptionToSidebar() -> String {
    press(.down, settle: 0.6)
    if !focused("settings-category-brand") {
      _ = nudge("settings-category-brand", directions: [.up, .down], limit: 6)
    }
    press(.down, settle: 0.6)
    XCTAssertTrue(focused("settings-category-look"), "Could not focus Look before Menu. \(snapshot())")
    press(.right, settle: 0.7)
    XCTAssertFalse(focused("settings-category-look"), "Right did not enter Look options. \(snapshot())")
    press(.menu, settle: 0.9)
    XCTAssertTrue(focused("settings-category-look"), "Menu did not return to Look. \(snapshot())")
    XCTAssertTrue(any("screen-settings").exists, "Menu left Settings. \(snapshot())")
    XCTAssertEqual(app.state, .runningForeground, "Menu left the app")
    return focusedIdentifier()
  }

  private func menuFromSidebarLeavesSettings() -> String {
    if !focused("settings-category-brand") {
      _ = nudge("settings-category-brand", directions: [.down, .up], limit: 6)
    }
    press(.menu, settle: 1.0)
    let stayed = app.state == .runningForeground
    let leftSettings = waitGone("screen-settings", timeout: 6)
    let onWod = any("screen-wod").waitForExistence(timeout: 6) || any("mode-forTime").exists
    XCTAssertTrue(stayed, "Menu backgrounded the app. state=\(app.state.rawValue)")
    XCTAssertTrue(leftSettings, "Menu stayed on Settings. \(snapshot())")
    XCTAssertTrue(onWod, "Menu did not return to WOD. \(snapshot())")
    return "focus=\(focusedIdentifier()) wod=\(onWod)"
  }

  private func walkHelp() -> String {
    press(.down, settle: 0.7)
    if !focused("help-watch") {
      XCTAssertTrue(nudge("help-watch", directions: [.down, .up], limit: 6), "Down did not reach Apple Watch. \(snapshot())")
    }
    let watchHelp = any("help-watch").label
    XCTAssertTrue(watchHelp.contains("6-digit code"), "Apple Watch help was \(watchHelp). \(snapshot())")
    XCTAssertTrue(watchHelp.contains("Apple TV HD"), "Apple Watch help omitted Apple TV HD. \(watchHelp)")
    XCTAssertFalse(watchHelp.contains("not an Apple TV HD"), "Apple Watch help still excludes HD. \(watchHelp)")
    XCTAssertFalse(watchHelp.localizedCaseInsensitiveContains("cannot pair"), "Apple Watch help still says HD cannot pair. \(watchHelp)")
    XCTAssertTrue(nudge("help-remote", directions: [.down], limit: 3), "Could not focus Remote. \(snapshot())")
    let remoteHelp = any("help-remote").label
    XCTAssertTrue(remoteHelp.contains("Finish"), "Remote help did not mention Finish. \(remoteHelp)")
    XCTAssertTrue(remoteHelp.contains("Are you sure?"), "Remote help did not mention the reset question. \(remoteHelp)")
    XCTAssertTrue(nudge("help-version", directions: [.down], limit: 14), "Could not focus the version line. \(snapshot())")
    let version = any("help-version").label
    XCTAssertTrue(version.contains("Version"), "Version line was \(version). \(snapshot())")
    for _ in 0..<24 {
      if focused("tab-help") { break }
      if focused("help-watch") {
        press(.up, settle: 0.8)
        if focused("tab-help") { break }
      }
      press(.up, settle: 0.4)
    }
    XCTAssertTrue(focused("tab-help"), "Up did not return to Help. \(snapshot())")
    return "version=\(version) focus=\(focusedIdentifier())"
  }

  private func pausedTimerHasNoPairing() -> String {
    let screen = app.frame
    for id in ["timer-pause", "timer-finish", "timer-reset"] {
      let button = any(id)
      XCTAssertTrue(button.exists, "\(id) missing on the paused clock. \(snapshot())")
      XCTAssertGreaterThanOrEqual(button.frame.minX, -1, "\(id) is off the left edge \(button.frame)")
      XCTAssertLessThanOrEqual(button.frame.maxX, screen.maxX + 1, "\(id) is off the right edge \(button.frame)")
    }
    for id in ["timer-watch", "timer-watch-status", "watch-pair-code", "watch-pair"] {
      XCTAssertFalse(any(id).exists, "\(id) is still on the timer. \(snapshot())")
    }
    var union = CGRect.null
    for id in ["timer-pause", "timer-finish", "timer-reset"] {
      union = union.union(any(id).frame)
    }
    XCTAssertLessThan(abs(union.midX - screen.midX), 80, "Transport row is not centered. union=\(union) screen=\(screen)")
    return "union=\(union)"
  }

  private func hdTimerHasNoPairing() -> String {
    XCTAssertTrue(any("timer-face").waitForExistence(timeout: 8), "Timer face was not showing. \(snapshot())")
    for id in ["timer-watch", "timer-watch-status", "watch-pair-code", "watch-pair", "watch-status"] {
      XCTAssertFalse(any(id).exists, "\(id) is on the timer. \(snapshot())")
    }
    return "face=\(faceLabel())"
  }

  private func hdPairingCode() -> String {
    _ = openTab("tab-settings", screen: "screen-settings", direction: .right)
    press(.down, settle: 0.7)
    XCTAssertTrue(
      nudge("settings-category-watch", directions: [.down], limit: 8),
      "Down did not reach Watch. \(snapshot())"
    )
    XCTAssertTrue(any("settings-detail-watch").waitForExistence(timeout: 4), "Watch pane did not appear. \(snapshot())")
    let status = any("watch-status")
    XCTAssertTrue(status.waitForExistence(timeout: 8), "Watch status did not appear. \(snapshot())")
    XCTAssertFalse(status.label.contains("Apple TV 4K"), "HD still asked for a 4K. Status was \(status.label). \(snapshot())")
    XCTAssertFalse(status.label.contains("needs an Apple TV"), "HD still blocked pairing. Status was \(status.label). \(snapshot())")
    XCTAssertTrue(status.label.localizedCaseInsensitiveContains("internet"), "Status was \(status.label). \(snapshot())")
    let code = any("watch-pair-code")
    XCTAssertTrue(code.waitForExistence(timeout: 5), "Pairing code did not appear. \(snapshot())")
    let digits = code.label.filter(\.isNumber)
    XCTAssertEqual(digits.count, 6, "Code label was \(code.label). \(snapshot())")
    XCTAssertFalse(any("timer-face").exists, "The timer was still showing the pairing code. \(snapshot())")
    return "\(digits) \(status.label)"
  }

  private func selectPausesOntoResume() -> String {
    if !focused("timer-pause") {
      _ = nudge("timer-pause", directions: [.left, .up, .down], limit: 6)
    }
    press(.select, settle: 0.8)
    let paused = waitFace(containing: "Paused", timeout: 6)
    let resumeFocused = waitResumeFocused()
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
    XCTAssertTrue(nudge("timer-finish", directions: [.right, .left], limit: 4), "Could not focus Finish. \(snapshot())")
    press(.select, settle: 0.8)
    let stopped = waitFace(prefix: "Time,", timeout: 6)
    let gone = waitGone("timer-finish", timeout: 5)
    let again = any("timer-start").waitForExistence(timeout: 5) && any("timer-start").label.contains("Go again")
    XCTAssertTrue(any("timer-face").exists, "Finish left the timer. \(snapshot())")
    XCTAssertTrue(stopped, "Finish did not finish the clock. face=\(faceLabel()) \(snapshot())")
    XCTAssertTrue(gone, "Finish stayed on screen. \(snapshot())")
    XCTAssertTrue(again, "Go again was not shown. label=\(any("timer-start").label) \(snapshot())")
    return "face=\(faceLabel()) goAgain=\(any("timer-start").label)"
  }

  private func openResetConfirm() -> String {
    XCTAssertTrue(nudge("timer-reset", directions: [.right, .left], limit: 4), "Could not focus Reset. \(snapshot())")
    keptFace = faceLabel()
    keptClock = clockSeconds()
    press(.select, settle: 0.8)
    XCTAssertTrue(any("reset-confirm").waitForExistence(timeout: 5), "One Reset press did not ask to confirm. \(snapshot())")
    XCTAssertTrue(app.staticTexts["Are you sure?"].waitForExistence(timeout: 3), "Confirm title was missing. \(snapshot())")
    XCTAssertTrue(any("confirm-reset-no").exists, "No was missing. \(snapshot())")
    XCTAssertTrue(any("confirm-reset-yes").exists, "Yes was missing. \(snapshot())")
    XCTAssertTrue(keptFace.hasPrefix("Time,"), "Reset was not asked from the finished clock. face=\(keptFace)")
    XCTAssertFalse(faceLabel().hasPrefix("For Time"), "One Reset press reset without a Yes. \(snapshot())")
    let landedOnNo = waitFocus("confirm-reset-no", timeout: 3)
    XCTAssertTrue(landedOnNo, "Reset did not land on No. \(snapshot())")
    return "face=\(faceLabel()) clock=\(keptClock ?? -1) no=\(landedOnNo)"
  }

  private func declineResetKeepsTimer() -> String {
    if !focused("confirm-reset-no") {
      XCTAssertTrue(
        nudge("confirm-reset-no", directions: [.up, .down], limit: 4),
        "Could not focus No. \(snapshot())"
      )
    }
    press(.select, settle: 0.8)
    XCTAssertTrue(waitGone("reset-confirm", timeout: 5), "No did not dismiss the question. \(snapshot())")
    XCTAssertFalse(app.staticTexts["Are you sure?"].exists, "Are you sure stayed after No. \(snapshot())")
    XCTAssertEqual(faceLabel(), keptFace, "No changed the clock face. \(snapshot())")
    XCTAssertEqual(clockSeconds(), keptClock, "No changed the time. kept=\(keptClock ?? -1) \(snapshot())")
    XCTAssertTrue(any("timer-start").label.contains("Go again"), "No left the finished timer. \(snapshot())")
    XCTAssertFalse(any("timer-finish").exists, "Finish returned after No. \(snapshot())")
    let backOnReset = waitFocus("timer-reset", timeout: 3) || nudge("timer-reset", directions: [.right, .left], limit: 4)
    XCTAssertTrue(backOnReset, "Focus did not return to Reset. \(snapshot())")
    return "face=\(faceLabel()) clock=\(clockSeconds() ?? -1)"
  }

  private func confirmResetYes() -> String {
    if !any("reset-confirm").exists {
      XCTAssertTrue(nudge("timer-reset", directions: [.right, .left], limit: 4), "Could not focus Reset. \(snapshot())")
      press(.select, settle: 0.8)
    }
    XCTAssertTrue(any("reset-confirm").waitForExistence(timeout: 5), "Reset did not ask again. \(snapshot())")
    XCTAssertTrue(faceLabel().hasPrefix("Time,"), "The timer changed before Yes. \(snapshot())")
    if !focused("confirm-reset-yes") {
      XCTAssertTrue(
        nudge("confirm-reset-yes", directions: [.down, .up], limit: 4),
        "Could not focus Yes. \(snapshot())"
      )
    }
    press(.select, settle: 0.8)
    let idle = waitFace(prefix: "For Time", timeout: 6)
    let startShown = any("timer-start").waitForExistence(timeout: 5)
    let startLabel = any("timer-start").label
    let clock = clockSeconds()
    XCTAssertTrue(waitGone("reset-confirm", timeout: 4), "Yes left the question open. \(snapshot())")
    XCTAssertTrue(any("timer-face").exists, "Yes left the timer. \(snapshot())")
    XCTAssertTrue(idle, "Yes did not return to For Time. face=\(faceLabel()) \(snapshot())")
    XCTAssertTrue(startShown && startLabel.contains("Start"), "Start was not shown after Yes (\(startLabel)). \(snapshot())")
    XCTAssertEqual(clock, Optional(0), "Yes clock was \(faceLabel())")
    XCTAssertFalse(any("timer-finish").exists, "Finish remained after Yes. \(snapshot())")
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

  private func showIntervalPresets() -> String {
    _ = ensureTabFocused()
    for _ in 0..<4 where !any("screen-wod").exists && !any("mode-intervals").exists {
      press(.left, settle: 0.7)
    }
    XCTAssertTrue(
      nudge("mode-intervals", directions: [.down, .right, .left], limit: 8),
      "Could not focus Intervals. \(snapshot())"
    )
    press(.select, settle: 0.9)
    XCTAssertTrue(any("screen-setup").waitForExistence(timeout: 12), "Intervals setup did not open. \(snapshot())")
    for id in ["interval-preset-tabata", "interval-preset-bjj", "interval-preset-boxing", "interval-preset-mma", "interval-preset-muay-thai"] {
      XCTAssertTrue(any(id).waitForExistence(timeout: 4), "\(id) was not on Intervals. \(snapshot())")
    }
    return "presets=\(any("interval-preset-tabata").label)"
  }

  private func openTabataSetup() -> String {
    if any("screen-setup").exists && any("lead-in-minutes-dec").exists {
      return "already on setup"
    }
    _ = ensureTabFocused()
    for _ in 0..<4 where !any("screen-wod").exists && !any("mode-intervals").exists {
      press(.left, settle: 0.7)
    }
    XCTAssertTrue(
      nudge("mode-intervals", directions: [.down, .right, .left], limit: 10),
      "Could not focus Intervals. \(snapshot())"
    )
    press(.select, settle: 0.9)
    XCTAssertTrue(any("screen-setup").waitForExistence(timeout: 12), "Intervals setup did not open. \(snapshot())")
    XCTAssertTrue(any("lead-in-minutes-dec").waitForExistence(timeout: 8), "Lead-in minus missing. \(snapshot())")
    return "face=\(focusedIdentifier())"
  }

  private func leadInFocused() -> Bool {
    for id in ["lead-in-minutes-dec", "lead-in-minutes-inc", "lead-in-seconds-dec", "lead-in-seconds-inc"] where focused(id) {
      return true
    }
    return false
  }

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
    for id in ["tab-wod", "tab-settings", "tab-help"] where focused(id) {
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

  private func waitResumeFocused(timeout: TimeInterval = 6) -> Bool {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      let button = any("timer-pause")
      if button.exists && button.hasFocus && button.label.contains("Resume") { return true }
      Thread.sleep(forTimeInterval: 0.2)
    }
    let button = any("timer-pause")
    return button.exists && button.hasFocus && button.label.contains("Resume")
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
