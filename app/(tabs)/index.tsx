import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { unlockAudio } from '@/src/audio/sounds';
import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor } from '@/src/branding/color';
import { TvFocusPressable } from '@/src/components/TvFocus';
import { TvMenuCell } from '@/src/components/TvMenuCell';
import { TvTabDownBridge, useTvTabFocus, type TvFocusTag } from '@/src/components/TvTabFocus';
import { useTimerSession } from '@/src/session/TimerSession';
import { chrome } from '@/src/theme/chrome';
import { isTenFootLayout, tvFocusGutter, tvSafeInset, type TvHomeLayout } from '@/src/tv/layout';
import { isTvGridExit } from '@/src/tv/tabFocus';
import { useTvMenuFrame } from '@/src/tv/useTvMenuFrame';
import { scrollOffsetForFocus } from '@/src/tv/scroll';
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
  const tv = Platform.isTV === true;
  const tabFocus = useTvTabFocus();
  const tenFoot = isTenFootLayout(width, height, tv);
  const inset = tvSafeInset(tenFoot);
  const accent = readableDigitColor(branding.uiColor, branding.backgroundColor);
  const menu = useTvMenuFrame(MODES.length, { header: 'home', insets: true });
  const home = tv ? menu.frame : null;
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollOffset = useRef(0);
  const viewportHeight = useRef(0);
  const gridTop = useRef(0);
  const cardLocal = useRef<Record<string, { y: number; height: number }>>({});
  const presetListTop = useRef(0);
  const presetLocal = useRef<Record<string, { y: number; height: number }>>({});
  const [presets, setPresets] = useState<SavedPreset[] | null>(null);

  const reveal = useCallback((top: number, itemHeight: number) => {
    const next = scrollOffsetForFocus(top, itemHeight, viewportHeight.current, scrollOffset.current);
    if (next === scrollOffset.current) return;
    scrollOffset.current = next;
    scrollRef.current?.scrollTo({ y: next, animated: true });
  }, []);

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
    <SafeAreaView style={styles.safe} edges={tv ? [] : ['top']}>
      <ScrollView
        ref={scrollRef}
        style={tv ? styles.scrollTv : undefined}
        scrollEnabled={!tv || (presets != null && presets.length > 0)}
        scrollEventThrottle={16}
        onLayout={(event) => {
          viewportHeight.current = event.nativeEvent.layout.height;
          if (tv) menu.onSceneLayout(event);
        }}
        onScroll={(event) => {
          scrollOffset.current = event.nativeEvent.contentOffset.y;
        }}
        contentContainerStyle={[
          styles.content,
          tenFoot && !tv && { paddingHorizontal: inset, paddingBottom: inset },
          tv && home
            ? {
                paddingHorizontal: home.padHorizontal,
                paddingTop: home.padTop,
                paddingBottom: home.stackGap,
                gap: home.stackGap,
              }
            : null,
        ]}
        testID="screen-wod"
      >
        <Text
          style={[
            styles.wordmark,
            { color: accent },
            tenFoot && !tv && styles.wordmarkTv,
            tv && home ? { fontSize: home.wordmarkSize, lineHeight: home.wordmarkLine, marginTop: 0 } : null,
          ]}
        >
          Americana
        </Text>
        <Text
          style={[
            styles.gym,
            tenFoot && !tv && styles.gymTv,
            tv && home ? { fontSize: home.gymSize, lineHeight: home.gymLine } : null,
          ]}
          numberOfLines={1}
        >
          {branding.gymName}
        </Text>
        <Text
          style={[
            styles.section,
            tv && home ? { fontSize: home.sectionSize, lineHeight: home.sectionLine, marginTop: 0, marginBottom: 0 } : null,
          ]}
        >
          Conditioning
        </Text>
        <View
          style={[styles.list, tv && styles.grid]}
          onLayout={(event) => {
            gridTop.current = event.nativeEvent.layout.y;
          }}
        >
          {MODES.map((item, index) =>
            tv && home ? (
              <TvMenuCell
                key={item.mode}
                basis={home.cellWidth}
                frame={home}
                onLayout={(event) => {
                  cardLocal.current[item.mode] = {
                    y: event.nativeEvent.layout.y,
                    height: event.nativeEvent.layout.height,
                  };
                }}
              >
                {(focus) => (
                  <ModeCard
                    item={item}
                    accent={accent}
                    preferred={index === 0}
                    tenFoot={false}
                    frame={home}
                    focusDown={
                      presets != null && presets.length > 0
                        ? null
                        : isTvGridExit(index, MODES.length, home.columns)
                          ? tabFocus?.downTag ?? null
                          : null
                    }
                    onFocus={focus.onFocus}
                    onBlur={focus.onBlur}
                    onReveal={() => {
                      const local = cardLocal.current[item.mode];
                      if (!local) return;
                      reveal(gridTop.current + local.y, local.height);
                    }}
                  />
                )}
              </TvMenuCell>
            ) : (
              <View
                key={item.mode}
                onLayout={(event) => {
                  cardLocal.current[item.mode] = {
                    y: event.nativeEvent.layout.y,
                    height: event.nativeEvent.layout.height,
                  };
                }}
              >
                <ModeCard
                  item={item}
                  accent={accent}
                  preferred={index === 0}
                  tenFoot={tenFoot && !tv}
                  frame={null}
                  onReveal={() => {
                    const local = cardLocal.current[item.mode];
                    if (!local) return;
                    reveal(gridTop.current + local.y, local.height);
                  }}
                />
              </View>
            ),
          )}
        </View>
        {presets && presets.length > 0 ? (
          <>
            <Text style={[styles.section, tv && home ? { fontSize: home.sectionSize, lineHeight: home.sectionLine, marginTop: 0 } : null]}>
              My presets
            </Text>
            <View
              style={styles.list}
              onLayout={(event) => {
                presetListTop.current = event.nativeEvent.layout.y;
              }}
            >
              {presets.map((preset, presetIndex) => {
                const gutter = home ? tvFocusGutter(width - home.padHorizontal * 2) : 0;
                const lastPreset = tv && presetIndex === presets.length - 1;
                return (
                <View
                  key={preset.id}
                  style={tv && home ? { paddingHorizontal: gutter, paddingVertical: home.gutterTop, zIndex: 0 } : undefined}
                  onLayout={(event) => {
                    presetLocal.current[preset.id] = {
                      y: event.nativeEvent.layout.y,
                      height: event.nativeEvent.layout.height,
                    };
                  }}
                >
                  <SavedPresetCard
                    preset={preset}
                    accent={accent}
                    tenFoot={tenFoot && !tv}
                    tall={tv && home ? Math.round(home.cardHeight * 0.62) : 0}
                    titleSize={tv && home ? home.titleSize : 0}
                    detailSize={tv && home ? home.detailSize : 0}
                    onOpen={() => openPreset(preset)}
                    onStart={() => startPreset(preset)}
                    focusDown={lastPreset ? tabFocus?.downTag ?? null : null}
                    onReveal={() => {
                      const local = presetLocal.current[preset.id];
                      if (!local) return;
                      reveal(presetListTop.current + local.y, local.height);
                    }}
                  />
                </View>
                );
              })}
            </View>
          </>
        ) : null}
        <Text style={[styles.hint, tv && home ? { fontSize: home.hintSize, lineHeight: home.hintLine, marginTop: 0 } : null]}>
          Jiu-jitsu, boxing, and sparring rounds are on the Rounds tab.
        </Text>
      </ScrollView>
      <TvTabDownBridge />
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
  tall = 0,
  titleSize = 0,
  detailSize = 0,
  onOpen,
  onStart,
  onReveal,
  focusDown = null,
}: {
  preset: SavedPreset;
  accent: string;
  tenFoot: boolean;
  tall?: number;
  titleSize?: number;
  detailSize?: number;
  onOpen: () => void;
  onStart: () => void;
  onReveal: () => void;
  focusDown?: TvFocusTag | null;
}) {
  const tv = Platform.isTV === true;
  return (
    <View style={[styles.card, tenFoot && styles.cardTv, tv && styles.presetCardTv, tall > 0 ? { minHeight: tall, height: tall } : null]}>
      <View style={[styles.bar, { backgroundColor: accent }]} />
      <TvFocusPressable
        accent={accent}
        testID={`my-preset-${preset.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${preset.name}, ${modeTitle(preset.mode)}`}
        accessibilityHint="Opens this preset in its setup"
        focusDown={focusDown}
        onPress={onOpen}
        onFocus={onReveal}
        style={({ pressed }) => [styles.cardBody, { opacity: pressed ? 0.78 : 1 }]}
      >
        <Text
          style={[
            styles.cardTitle,
            tenFoot && styles.cardTitleTv,
            titleSize > 0 ? { fontSize: titleSize, lineHeight: titleSize + 6 } : null,
          ]}
          numberOfLines={2}
        >
          {preset.name}
        </Text>
        <Text
          style={[
            styles.cardDetail,
            tenFoot && styles.cardDetailTv,
            detailSize > 0 ? { fontSize: detailSize, lineHeight: detailSize + 8 } : null,
          ]}
        >
          {modeTitle(preset.mode)} · {presetSummary(preset.config)}
        </Text>
      </TvFocusPressable>
      <TvFocusPressable
        accent={accent}
        testID={`my-preset-start-${preset.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Start ${preset.name}`}
        focusDown={focusDown}
        onPress={onStart}
        onFocus={onReveal}
        style={({ pressed }) => [styles.start, tenFoot && styles.startTv, { opacity: pressed ? 0.78 : 1 }]}
      >
        <Text style={[styles.startLabel, { color: accent }, tenFoot && styles.startLabelTv]}>Start</Text>
      </TvFocusPressable>
    </View>
  );
}

function ModeCard({
  item,
  accent,
  preferred,
  tenFoot,
  frame,
  onFocus,
  onBlur,
  onReveal,
  focusDown = null,
}: {
  item: (typeof MODES)[number];
  accent: string;
  preferred: boolean;
  tenFoot: boolean;
  frame: TvHomeLayout | null;
  onFocus?: () => void;
  onBlur?: () => void;
  onReveal: () => void;
  focusDown?: TvFocusTag | null;
}) {
  const tv = frame !== null;
  return (
    <TvFocusPressable
      accent={accent}
      testID={`mode-${item.mode}`}
      accessibilityRole="button"
      accessibilityLabel={modeTitle(item.mode)}
      focusDown={focusDown}
      hasTVPreferredFocus={preferred}
      onFocus={() => {
        onFocus?.();
        onReveal();
      }}
      onBlur={() => onBlur?.()}
      onPress={() => {
        if (item.mode === 'countdown') {
          router.push('/countdown');
          return;
        }
        router.push({ pathname: '/setup', params: { mode: item.mode } });
      }}
      style={({ pressed }) => [
        styles.card,
        tenFoot && styles.cardTv,
        tv && frame
          ? {
              width: '100%',
              height: frame.cardHeight,
              minHeight: frame.cardHeight,
              borderRadius: 16,
              flexGrow: 0,
            }
          : null,
        { opacity: pressed ? 0.78 : 1 },
      ]}
    >
      <View style={[styles.bar, { backgroundColor: accent }]} />
        <View style={[styles.cardBody, frame ? styles.cardBodyFrame : null]}>
        <Text
          style={[
            styles.cardTitle,
            tenFoot && styles.cardTitleTv,
            frame ? { fontSize: frame.titleSize, lineHeight: frame.titleSize + Math.max(4, Math.round(frame.titleSize * 0.12)) } : null,
          ]}
          numberOfLines={1}
        >
          {modeTitle(item.mode)}
        </Text>
        <Text
          style={[
            styles.cardDetail,
            tenFoot && styles.cardDetailTv,
            frame ? { fontSize: frame.detailSize, lineHeight: frame.detailSize + Math.max(6, Math.round(frame.detailSize * 0.25)) } : null,
          ]}
          numberOfLines={frame ? frame.detailLines : 2}
        >
          {item.detail}
        </Text>
      </View>
      <Text style={[styles.chevron, frame ? { fontSize: frame.titleSize + 4 } : null, { color: accent }]}>›</Text>
    </TvFocusPressable>
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
  scrollTv: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
    marginHorizontal: 0,
    overflow: 'visible',
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
  cardBodyFrame: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    gap: 2,
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
  presetCardTv: {
    minHeight: 96,
    borderRadius: 18,
  },
  hint: {
    marginTop: 8,
    color: chrome.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
