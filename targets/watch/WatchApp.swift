import SwiftUI

@main
struct AmericanaWatchApp: App {
  @StateObject private var session = WatchSession()

  var body: some Scene {
    WindowGroup {
      WatchRoot(session: session)
    }
  }
}
