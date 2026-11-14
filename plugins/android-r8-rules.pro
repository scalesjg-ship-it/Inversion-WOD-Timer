# R8 keep rules for the Americana release build.
# Library AARs also ship consumer rules. These cover Hermes, Expo modules loaded
# by reflection (including expo-audio), and Android libraries in this repo that
# do not ship their own consumer file.

# React Native and Hermes. Native methods and the bridge stay reachable after
# shrinking. WindowUtilKt is the edge-to-edge startup path.
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.react.views.view.WindowUtilKt { *; }
-keepclassmembers class * {
    native <methods>;
}

# Expo modules. expo-audio, expo-notifications, and the other Expo packages in
# this app live under expo.modules and are discovered by reflection.
-keep class expo.modules.** { *; }
-keep class io.github.expo.modules.v2.** { *; }
-keep class io.github.expo.kolibri.** { *; }
-keep @expo.modules.core.interfaces.DoNotStrip class *
-keepclassmembers class * {
    @expo.modules.core.interfaces.DoNotStrip *;
}

# Reanimated, Worklets, and react-native-screens.
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }
-keep class com.swmansion.rnscreens.** { *; }

# react-native-tcp-socket is a classic native module with no consumer rules.
# The TV logo transfer uses it.
-keep class com.asterinet.react.tcpsocket.** { *; }

# AsyncStorage has no consumer ProGuard file.
-keep class com.reactnativecommunity.asyncstorage.** { *; }
