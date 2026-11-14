import { Link, Stack } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chrome } from '@/src/theme/chrome';

export default function NotFoundScreen() {
  const androidPhone = Platform.OS === 'android' && Platform.isTV !== true;
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ title: 'Americana', headerShown: true }} />
      <View style={[styles.container, androidPhone ? { paddingBottom: 24 + insets.bottom } : null]}>
        <Text style={styles.title}>That screen is not on the clock.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Back to Americana</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: chrome.bg,
    gap: 16,
  },
  title: {
    color: chrome.text,
    fontFamily: 'Oswald',
    fontSize: 28,
    textAlign: 'center',
  },
  link: {
    paddingVertical: 12,
  },
  linkText: {
    color: '#FF4D2E',
    fontFamily: 'OswaldMedium',
    fontSize: 18,
  },
});
