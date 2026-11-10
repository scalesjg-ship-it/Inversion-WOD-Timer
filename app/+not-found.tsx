import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { chrome } from '@/src/theme/chrome';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Americana', headerShown: true }} />
      <View style={styles.container}>
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
