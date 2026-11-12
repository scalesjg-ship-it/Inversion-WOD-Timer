import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { BrandingProvider, useBranding } from '@/src/branding/BrandingProvider';
import { RouteErrorBoundary } from '@/src/components/RouteErrorBoundary';
import { TimerSessionProvider } from '@/src/session/TimerSession';
import { chrome } from '@/src/theme/chrome';

export function ErrorBoundary(props: { error: Error; retry: () => Promise<void> }) {
  return <RouteErrorBoundary {...props} />;
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Oswald: require('../assets/fonts/Oswald-Bold.ttf'),
    OswaldMedium: require('../assets/fonts/Oswald-Medium.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  return (
    <BrandingProvider>
      <TimerSessionProvider>
        <RootGate fontsLoaded={loaded} />
      </TimerSessionProvider>
    </BrandingProvider>
  );
}

function RootGate({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { ready } = useBranding();

  useEffect(() => {
    if (fontsLoaded && ready) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, ready]);

  if (!fontsLoaded || !ready) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: chrome.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="setup" />
        <Stack.Screen name="countdown" />
        <Stack.Screen name="timer" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </>
  );
}
