import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor } from '@/src/branding/color';
import { chrome } from '@/src/theme/chrome';
import { isTenFootLayout, tvSafeInset } from '@/src/tv/layout';
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
  const { width, height } = useWindowDimensions();
  const tenFoot = isTenFootLayout(width, height, Platform.isTV === true);
  const inset = tvSafeInset(tenFoot);
  const accent = readableDigitColor(branding.uiColor, branding.backgroundColor);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, tenFoot && { paddingHorizontal: inset, paddingBottom: inset }]}
        testID="screen-wod"
      >
        <Text style={[styles.wordmark, { color: accent }, tenFoot && styles.wordmarkTv]}>Americana</Text>
        <Text style={[styles.gym, tenFoot && styles.gymTv]} numberOfLines={2} adjustsFontSizeToFit>
          {branding.gymName}
        </Text>
        <Text style={styles.section}>Conditioning</Text>
        <View style={styles.list}>
          {MODES.map((item, index) => (
            <ModeCard key={item.mode} item={item} accent={accent} preferred={index === 0} tenFoot={tenFoot} />
          ))}
        </View>
        <Text style={styles.hint}>Jiu-jitsu, boxing, and sparring rounds are on the Rounds tab.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeCard({
  item,
  accent,
  preferred,
  tenFoot,
}: {
  item: (typeof MODES)[number];
  accent: string;
  preferred: boolean;
  tenFoot: boolean;
}) {
  const [webFocused, setWebFocused] = useState(false);
  return (
            <Pressable
              testID={`mode-${item.mode}`}
              accessibilityRole="button"
              accessibilityLabel={modeTitle(item.mode)}
              hasTVPreferredFocus={preferred}
              onFocus={() => setWebFocused(true)}
              onBlur={() => setWebFocused(false)}
              onPress={() => {
                if (item.mode === 'countdown') {
                  router.push('/countdown');
                  return;
                }
                router.push({ pathname: '/setup', params: { mode: item.mode } });
              }}
              style={({ pressed, focused }) => [
                styles.card,
                tenFoot && styles.cardTv,
                { opacity: pressed ? 0.78 : 1 },
                focused || webFocused ? { borderWidth: 6, borderColor: accent } : null,
              ]}
            >
              <View style={[styles.bar, { backgroundColor: accent }]} />
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, tenFoot && styles.cardTitleTv]}>{modeTitle(item.mode)}</Text>
                <Text style={[styles.cardDetail, tenFoot && styles.cardDetailTv]}>{item.detail}</Text>
              </View>
              <Text style={[styles.chevron, { color: accent }]}>›</Text>
            </Pressable>
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
  wordmarkTv: {
    fontSize: 28,
    marginTop: 12,
  },
  gymTv: {
    fontSize: 72,
    lineHeight: 80,
  },
  cardTv: {
    minHeight: 140,
    borderRadius: 24,
  },
  cardTitleTv: {
    fontSize: 48,
  },
  cardDetailTv: {
    fontSize: 24,
    lineHeight: 32,
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
