import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { unlockAudio } from '@/src/audio/sounds';
import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor } from '@/src/branding/color';
import { PresetShelf } from '@/src/components/PresetShelf';
import { TvSetupFocus } from '@/src/components/TvSetupFocus';
import { BigButton, Chip, HeaderBack, NumberStepper, TimeField, TvDurationRow, TvLinkedStart } from '@/src/components/ui';
import { useTimerSession } from '@/src/session/TimerSession';
import { chrome } from '@/src/theme/chrome';
import { TV_BODY_FONT, TV_SAFE_HORIZONTAL, TV_SECTION_FONT, tvSafeBox } from '@/src/tv/layout';
import { tvSetupFrame, tvSetupMetrics, tvSetupScaled } from '@/src/tv/setupLayout';
import { showsOnScreenBack } from '@/src/tv/timerTransport';
import {
  WARNING_MARK_CHOICES,
  addCountdownSeconds,
  finalBeepsEnabled,
  joinDuration,
  splitDuration,
  withFinalBeeps,
} from '@/src/timer/countdown';
import { normalizeConfig } from '@/src/timer/engine';
import { formatSeconds } from '@/src/timer/format';
import { defaultConfig } from '@/src/timer/presets';
import { listPresets, type SavedPreset } from '@/src/timer/presetStorage';
import type { TimerConfig } from '@/src/timer/types';

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function CountdownScreen() {
  const params = useLocalSearchParams<{ presetId?: string }>();
  const presetId = readParam(params.presetId);
  const { branding } = useBranding();
  const { setSession } = useTimerSession();
  const accent = readableDigitColor(branding.uiColor, branding.backgroundColor);
  const tv = Platform.isTV === true;
  const { width, height } = useWindowDimensions();
  const box = tvSafeBox(tv, width, height);
  const initial = defaultConfig('countdown');
  const initialParts = splitDuration(initial.workSeconds);
  const [hours, setHours] = useState(initialParts.hours);
  const [minutes, setMinutes] = useState(initialParts.minutes);
  const [seconds, setSeconds] = useState(initialParts.seconds);
  const [leadInSeconds, setLeadInSeconds] = useState(initial.leadInSeconds);
  const [marks, setMarks] = useState<number[]>(initial.warningMarksSeconds ?? []);
  const [selectedId, setSelectedId] = useState('');
  const [runLabel, setRunLabel] = useState('Countdown');

  const durationSeconds = joinDuration(hours, minutes, seconds);
  const config: TimerConfig = normalizeConfig({
    mode: 'countdown',
    leadInSeconds,
    workSeconds: durationSeconds,
    restSeconds: 0,
    rounds: 1,
    warningSeconds: 0,
    warningMarksSeconds: marks,
  });

  const loadPreset = useCallback((preset: SavedPreset) => {
    const parts = splitDuration(preset.config.workSeconds);
    setHours(parts.hours);
    setMinutes(parts.minutes);
    setSeconds(parts.seconds);
    setLeadInSeconds(preset.config.leadInSeconds);
    setMarks(preset.config.warningMarksSeconds ?? []);
    setSelectedId(preset.id);
    setRunLabel(preset.name);
  }, []);

  useEffect(() => {
    if (!presetId) return undefined;
    let active = true;
    void listPresets('countdown').then((presets) => {
      if (!active) return;
      const match = presets.find((preset) => preset.id === presetId);
      if (match) loadPreset(match);
    });
    return () => {
      active = false;
    };
  }, [loadPreset, presetId]);

  const applyDuration = (total: number) => {
    const parts = splitDuration(total);
    setHours(parts.hours);
    setMinutes(parts.minutes);
    setSeconds(parts.seconds);
    setMarks((current) => withFinalBeeps(current, finalBeepsEnabled(current), total));
  };

  const start = (nextConfig: TimerConfig, label: string) => {
    unlockAudio();
    setSession({ config: nextConfig, label });
    router.push('/timer');
  };

  const shelf = (
    <PresetShelf
      mode="countdown"
      accent={accent}
      config={config}
      selectedId={selectedId}
      onLoad={loadPreset}
      onStart={(preset) => start(preset.config, preset.name)}
      onClearSelection={() => {
        setSelectedId('');
        setRunLabel('Countdown');
      }}
    />
  );

  if (tv) {
    const metrics = tvSetupMetrics(width, height);
    const frame = tvSetupFrame(width, height);
    const titleSize = tvSetupScaled(40, width, height);
    const formWidth = frame.durationWidth;
    const appleTv = !showsOnScreenBack(true, Platform.OS);
    return (
      <TvSetupFocus>
      <View style={[styles.safe, { paddingHorizontal: frame.horizontal, paddingTop: frame.vertical }]} testID="screen-countdown">
        <View style={[styles.header, appleTv && styles.headerApple]}>
          <HeaderBack testID="countdown-back" onPress={() => router.back()} color={accent} />
          <Text style={[styles.kicker, styles.kickerTv]} numberOfLines={1}>Americana</Text>
        </View>
        <View style={[styles.tvBody, { paddingBottom: frame.vertical, gap: metrics.rowGap }]}>
          <Text style={[styles.title, styles.titleCenter, { fontSize: titleSize, lineHeight: titleSize + 6 }]}>Countdown</Text>
          <Text style={[styles.summary, styles.summaryTv, styles.titleCenter]}>
            {formatSeconds(config.workSeconds)}
            {config.leadInSeconds > 0 ? ` · ${config.leadInSeconds}s lead-in` : ' · no lead-in'}
          </Text>
          <View style={[styles.tvForm, { width: formWidth, gap: metrics.rowGap }]}>
            <TvDurationRow
              preferred
              label="Duration"
              hours={hours}
              minutes={minutes}
              seconds={seconds}
              accent={accent}
              onHours={(value) => applyDuration(joinDuration(value, minutes, seconds))}
              onMinutes={(value) => applyDuration(joinDuration(hours, value, seconds))}
              onSeconds={(value) => applyDuration(joinDuration(hours, minutes, value))}
            />
            <View style={[styles.chips, styles.chipsCentered]}>
              <Chip label="+30s" color={accent} selected={false} testID="add-30" onPress={() => applyDuration(addCountdownSeconds(durationSeconds, 30))} />
              <Chip label="+1m" color={accent} selected={false} testID="add-60" onPress={() => applyDuration(addCountdownSeconds(durationSeconds, 60))} />
              <Chip label="+5m" color={accent} selected={false} testID="add-300" onPress={() => applyDuration(addCountdownSeconds(durationSeconds, 300))} />
            </View>
            <TimeField compact exit label="Lead-in" seconds={leadInSeconds} onChange={(value) => setLeadInSeconds(Math.min(600, value))} testID="lead-in" accent={accent} />
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, styles.fieldLabelTv, styles.titleCenter]}>Warning beeps</Text>
              <View style={[styles.chips, styles.chipsCentered]}>
                {WARNING_MARK_CHOICES.map((choice, index) => (
                  <Chip
                    key={choice.id}
                    bridge={index === 0 ? 'entry' : true}
                    label={choice.label}
                    color={accent}
                    selected={marks.includes(choice.seconds)}
                    testID={`mark-${choice.id}`}
                    onPress={() => {
                      setMarks((current) =>
                        current.includes(choice.seconds)
                          ? current.filter((mark) => mark !== choice.seconds)
                          : [...current, choice.seconds].sort((left, right) => right - left),
                      );
                    }}
                  />
                ))}
                <Chip
                  bridge
                  label="Last 3s"
                  color={accent}
                  selected={finalBeepsEnabled(marks)}
                  testID="mark-final"
                  onPress={() => setMarks((current) => withFinalBeeps(current, !finalBeepsEnabled(current), durationSeconds))}
                />
              </View>
            </View>
          </View>
          <View style={styles.tvShelf}>{shelf}</View>
          <View style={styles.footer}>
            <TvLinkedStart roomy testID="start-countdown" label="Start countdown" color={accent} onPress={() => start(config, runLabel)} />
          </View>
        </View>
      </View>
      </TvSetupFocus>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, tv && { paddingHorizontal: box.horizontal, paddingTop: box.vertical, paddingBottom: box.vertical }]}
      edges={tv ? [] : ['top', 'bottom']}
    >
      <View style={styles.header}>
        <HeaderBack testID="countdown-back" onPress={() => router.back()} color={accent} />
        <Text style={[styles.kicker, tv && styles.kickerTv]}>Americana</Text>
      </View>
      <ScrollView
        testID="screen-countdown"
        style={tv ? styles.scrollTv : undefined}
        contentContainerStyle={[styles.content, tv && styles.contentTv]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, tv && styles.titleTv]}>Countdown</Text>
        <Text style={[styles.summary, tv && styles.summaryTv]}>
          {formatSeconds(config.workSeconds)}
          {config.leadInSeconds > 0 ? ` · ${config.leadInSeconds}s lead-in` : ' · no lead-in'}
        </Text>

        <PresetShelf
          mode="countdown"
          accent={accent}
          config={config}
          selectedId={selectedId}
          onLoad={loadPreset}
          onStart={(preset) => start(preset.config, preset.name)}
          onClearSelection={() => {
            setSelectedId('');
            setRunLabel('Countdown');
          }}
        />

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, Platform.isTV && styles.fieldLabelTv]}>Duration</Text>
          <NumberStepper value={hours} min={0} max={23} suffix="hr" testID="countdown-hours" accent={accent} onChange={(value) => applyDuration(joinDuration(value, minutes, seconds))} />
          <NumberStepper value={minutes} min={0} max={59} suffix="min" testID="countdown-minutes" accent={accent} onChange={(value) => applyDuration(joinDuration(hours, value, seconds))} />
          <NumberStepper value={seconds} min={0} max={59} suffix="sec" testID="countdown-seconds" accent={accent} onChange={(value) => applyDuration(joinDuration(hours, minutes, value))} />
        </View>
        <View style={styles.chips}>
          <Chip label="+30s" color={accent} selected={false} testID="add-30" onPress={() => applyDuration(addCountdownSeconds(durationSeconds, 30))} />
          <Chip label="+1m" color={accent} selected={false} testID="add-60" onPress={() => applyDuration(addCountdownSeconds(durationSeconds, 60))} />
          <Chip label="+5m" color={accent} selected={false} testID="add-300" onPress={() => applyDuration(addCountdownSeconds(durationSeconds, 300))} />
        </View>

        <TimeField label="Lead-in" seconds={leadInSeconds} onChange={(value) => setLeadInSeconds(Math.min(600, value))} testID="lead-in" accent={accent} />

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, Platform.isTV && styles.fieldLabelTv]}>Warning beeps</Text>
          <View style={styles.chips}>
            {WARNING_MARK_CHOICES.map((choice) => (
              <Chip
                key={choice.id}
                label={choice.label}
                color={accent}
                selected={marks.includes(choice.seconds)}
                testID={`mark-${choice.id}`}
                onPress={() => {
                  setMarks((current) =>
                    current.includes(choice.seconds)
                      ? current.filter((mark) => mark !== choice.seconds)
                      : [...current, choice.seconds].sort((left, right) => right - left),
                  );
                }}
              />
            ))}
            <Chip
              label="Last 3s"
              color={accent}
              selected={finalBeepsEnabled(marks)}
              testID="mark-final"
              onPress={() => setMarks((current) => withFinalBeeps(current, !finalBeepsEnabled(current), durationSeconds))}
            />
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <BigButton testID="start-countdown" label="Start countdown" color={accent} onPress={() => start(config, runLabel)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: chrome.bg, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  headerApple: { justifyContent: 'flex-end' },
  kicker: { color: chrome.muted, fontFamily: 'OswaldMedium', letterSpacing: 2, textTransform: 'uppercase', fontSize: 13 },
  kickerTv: { color: chrome.text, fontSize: TV_SECTION_FONT },
  tvStack: { flex: 1, justifyContent: 'space-evenly' },
  tvBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tvForm: { alignSelf: 'center' },
  tvShelf: { alignSelf: 'center', maxWidth: '100%' },
  titleCenter: { textAlign: 'center', alignSelf: 'stretch' },
  durationRow: { flexDirection: 'row', gap: 16 },
  // The scroll view reaches the screen edge so a focused control's 1.08 scale is not clipped;
  // the content pads back in to the safe margin.
  scrollTv: { flex: 1, alignSelf: 'stretch', marginHorizontal: -TV_SAFE_HORIZONTAL },
  content: { gap: 16, paddingTop: 12, paddingBottom: 24 },
  contentTv: { flexGrow: 1, gap: 14, paddingTop: 8, paddingHorizontal: TV_SAFE_HORIZONTAL },
  tvPage: { gap: 12, paddingBottom: 4 },
  title: { fontFamily: 'Oswald', fontSize: 48, color: chrome.text, lineHeight: 52 },
  titleTv: { fontSize: 56, lineHeight: 64 },
  summary: { color: chrome.muted, fontSize: 16, marginTop: -8 },
  summaryTv: { color: chrome.muted, fontSize: TV_BODY_FONT, lineHeight: TV_BODY_FONT + 8 },
  field: { gap: 10 },
  fieldLabel: { color: chrome.muted, fontFamily: 'OswaldMedium', fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase' },
  fieldLabelTv: { color: chrome.muted, fontSize: 20, letterSpacing: 1.2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipsCentered: { justifyContent: 'center', alignSelf: 'center' },
  footer: { paddingVertical: 12 },
});
