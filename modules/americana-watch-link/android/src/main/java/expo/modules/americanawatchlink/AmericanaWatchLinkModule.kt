package expo.modules.americanawatchlink

import io.github.expo.modules.v2.ExpoModule
import io.github.expo.modules.v2.JS
import io.github.expo.modules.v2.Module

/**
 * Fire TV and phones do not talk to the Apple Watch.
 * These methods exist so the same JS module loads, and they change nothing.
 */
@ExpoModule("AmericanaWatchLink")
class AmericanaWatchLinkModule : Module() {
  @JS
  fun start() = Unit

  @JS
  fun stop() = Unit

  @JS
  fun send(message: String) = Unit

  @JS
  suspend fun presentPicker(): Boolean {
    return false
  }
}
