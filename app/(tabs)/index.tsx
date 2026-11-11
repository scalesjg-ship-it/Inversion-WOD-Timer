import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor } from '@/src/branding/color';
import { chrome } from '@/src/theme/chrome';
import { modeTitle } from '@/src/timer/labels';
import type { TimerMode } from '@/src/timer/types';

const MODES: { mode: TimerMode; detail: string }[] = [
  {
    mode: 'forTime',
    detail: 'Count up until you finish. Add a cap when the workout has one.',
  },
  {
    mode: 'amrap',
    detail: 'Countdown. As many reps or rounds as possible.',
  },
  {
    mode: 'emom',
    detail: 'Every X minutes. The clock resets when the interval does.',
  },
  {
    mode: 'tabata',
    detail: '20 seconds on, 10 seconds off, eight rounds.',
  },
  {
    mode: 'intervals',
    detail: 'Your own work, rest, and number of rounds.',
  },
  {
    mode: 'countdown',
    detail: 'Any length. Name it, save it, and set warning beeps.',
  },
];

export default function WodScreen() {
  const { branding } = useBranding();
  const accent = readableDigitColor(branding.uiColor, branding.backgroundColor);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} testID="screen-wod">
        <Text style={[styles.wordmark, { color: accent }]}>Americana</Text>
        <Text style={styles.gym} numberOfLines={2} adjustsFontSizeToFit>
          {branding.gymName}
        </Text>
        <Text style={styles.section}>Conditioning</Text>
        <View style={styles.list}>
          {MODES.map((item) => (
            <Pressable
              key={item.mode}
              testID={`mode-${item.mode}`}
              accessibilityRole="button"
              accessibilityLabel={modeTitle(item.mode)}
              onPress={() => {
                if (item.mode === 'countdown') {
                  router.push('/countdown');
                  return;
                }
                router.push({ pathname: '/setup', params: { mode: item.mode } });
              }}
              style={({ pressed }) => [styles.card, { opacity: pressed ? 0.78 : 1 }]}
            >
              <View style={[styles.bar, { backgroundColor: accent }]} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{modeTitle(item.mode)}</Text>
                <Text style={styles.cardDetail}>{item.detail}</Text>
              </View>
              <Text style={[styles.chevron, { color: accent }]}>›</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>Jiu-jitsu, boxing, and sparring rounds are on the Rounds tab.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: chrome.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 6,
  },
  wordmark: {
    fontFamily: 'OswaldMedium',
    fontSize: 14,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  gym: {
    fontFamily: 'Oswald',
    fontSize: 36,
    lineHeight: 40,
    color: chrome.text,
  },
  section: {
    marginTop: 12,
    marginBottom: 4,
    color: chrome.muted,
    fontFamily: 'OswaldMedium',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontSize: 13,
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: chrome.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: chrome.line,
    minHeight: 78,
    overflow: 'hidden',
  },
  bar: {
    width: 6,
    alignSelf: 'stretch',
  },
  cardBody: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 4,
  },
  cardTitle: {
    fontFamily: 'Oswald',
    fontSize: 26,
    color: chrome.text,
    letterSpacing: 0.4,
  },
  cardDetail: {
    color: chrome.muted,
    fontSize: 14,
    lineHeight: 19,
  },
  chevron: {
    fontFamily: 'Oswald',
    fontSize: 34,
    paddingRight: 16,
  },
  hint: {
    marginTop: 8,
    color: chrome.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
