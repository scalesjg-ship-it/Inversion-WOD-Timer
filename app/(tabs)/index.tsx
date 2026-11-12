import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { unlockAudio } from '@/src/audio/sounds';
import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor } from '@/src/branding/color';
import { useTimerSession } from '@/src/session/TimerSession';
import { chrome } from '@/src/theme/chrome';
import { focusChrome } from '@/src/tv/controls';
import { isTenFootLayout, tvSafeInset } from '@/src/tv/layout';
import { tvParallaxProps } from '@/src/tv/pressable';
import { usePointerFocus } from '@/src/tv/usePointerFocus';
import { modeTitle } from '@/src/timer/labels';
import { loadPresets, presetSummary, type SavedPreset } from '@/src/timer/presetStorage';
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
    detail: 'Any length, with warning beeps. Save it with your other presets.',
  },
];

export default function WodScreen() {
  const { branding } = useBranding();
  const { setSession } = useTimerSession();
  const { width, height } = useWindowDimensions();
  const tenFoot = isTenFootLayout(width, height, Platform.isTV === true);
  const inset = tvSafeInset(tenFoot);
  const accent = readableDigitColor(branding.uiColor, branding.backgroundColor);
  const [presets, setPresets] = useState<SavedPreset[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadPresets().then((next) => {
        if (active) setPresets(next);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const startPreset = (preset: SavedPreset) => {
    unlockAudio();
    setSession({ config: preset.config, label: preset.name });
    router.push('/timer');
  };

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
        {presets && presets.length > 0 ? (
          <>
            <Text style={styles.section}>My presets</Text>
            <View style={styles.list}>
              {presets.map((preset) => (
                <SavedPresetCard
                  key={preset.id}
                  preset={preset}
                  accent={accent}
                  tenFoot={tenFoot}
                  onOpen={() => openPreset(preset)}
                  onStart={() => startPreset(preset)}
                />
              ))}
            </View>
          </>
        ) : null}
        <Text style={styles.hint}>Jiu-jitsu, boxing, and sparring rounds are on the Rounds tab.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function openPreset(preset: SavedPreset) {
  switch (preset.mode) {
    case 'countdown':
      router.push({ pathname: '/countdown', params: { presetId: preset.id } });
      return;
    case 'rounds':
      router.navigate({ pathname: '/rounds', params: { presetId: preset.id } });
      return;
    case 'forTime':
    case 'amrap':
    case 'emom':
    case 'tabata':
    case 'intervals':
      router.push({ pathname: '/setup', params: { mode: preset.mode, presetId: preset.id } });
      return;
    default: {
      const exhaustive: never = preset.mode;
      return exhaustive;
    }
  }
}

function SavedPresetCard({
  preset,
  accent,
  tenFoot,
  onOpen,
  onStart,
}: {
  preset: SavedPreset;
  accent: string;
  tenFoot: boolean;
  onOpen: () => void;
  onStart: () => void;
}) {
  const bodyPointer = usePointerFocus();
  const startPointer = usePointerFocus();
  const tv = Platform.isTV === true;
  return (
    <View style={[styles.card, tenFoot && styles.cardTv]}>
      <View style={[styles.bar, { backgroundColor: accent }]} />
      <Pressable
        testID={`my-preset-${preset.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${preset.name}, ${modeTitle(preset.mode)}`}
        accessibilityHint="Opens this preset in its setup"
        onPress={onOpen}
        onFocus={bodyPointer.onFocus}
        onBlur={bodyPointer.onBlur}
        {...tvParallaxProps()}
        style={({ pressed, focused }) => [
          styles.cardBody,
          { opacity: pressed ? 0.78 : 1 },
          focusChrome(tv, Boolean(focused) || bodyPointer.focused, accent),
        ]}
      >
        <Text style={[styles.cardTitle, tenFoot && styles.cardTitleTv]} numberOfLines={2}>
          {preset.name}
        </Text>
        <Text style={[styles.cardDetail, tenFoot && styles.cardDetailTv]}>
          {modeTitle(preset.mode)} · {presetSummary(preset.config)}
        </Text>
      </Pressable>
      <Pressable
        testID={`my-preset-start-${preset.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Start ${preset.name}`}
        onPress={onStart}
        onFocus={startPointer.onFocus}
        onBlur={startPointer.onBlur}
        {...tvParallaxProps()}
        style={({ pressed, focused }) => [
          styles.start,
          tenFoot && styles.startTv,
          { opacity: pressed ? 0.78 : 1 },
          focusChrome(tv, Boolean(focused) || startPointer.focused, accent),
        ]}
      >
        <Text style={[styles.startLabel, { color: accent }, tenFoot && styles.startLabelTv]}>Start</Text>
      </Pressable>
    </View>
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
  const pointer = usePointerFocus();
  const tv = Platform.isTV === true;
  return (
            <Pressable
              testID={`mode-${item.mode}`}
              accessibilityRole="button"
              accessibilityLabel={modeTitle(item.mode)}
              hasTVPreferredFocus={preferred}
              onFocus={pointer.onFocus}
              onBlur={pointer.onBlur}
              {...tvParallaxProps()}
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
                focusChrome(tv, Boolean(focused) || pointer.focused, accent),
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
  start: {
    minHeight: 64,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  startTv: {
    minHeight: 96,
    paddingHorizontal: 28,
  },
  startLabel: {
    fontFamily: 'Oswald',
    fontSize: 20,
    letterSpacing: 0.6,
  },
  startLabelTv: {
    fontSize: 32,
  },
  hint: {
    marginTop: 8,
    color: chrome.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
