import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { unlockAudio } from '@/src/audio/sounds';
import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor } from '@/src/branding/color';
import { PresetShelf } from '@/src/components/PresetShelf';
import { BigButton, Chip, HeaderBack, NumberStepper, TimeField } from '@/src/components/ui';
import { useTimerSession } from '@/src/session/TimerSession';
import { chrome } from '@/src/theme/chrome';
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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <HeaderBack testID="countdown-back" onPress={() => router.back()} color={accent} />
        <Text style={styles.kicker}>Americana</Text>
      </View>
      <ScrollView testID="screen-countdown" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Countdown</Text>
        <Text style={styles.summary}>
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
  kicker: { color: chrome.muted, fontFamily: 'OswaldMedium', letterSpacing: 2, textTransform: 'uppercase', fontSize: 13 },
  content: { gap: 16, paddingTop: 12, paddingBottom: 24 },
  title: { fontFamily: 'Oswald', fontSize: 48, color: chrome.text, lineHeight: 52 },
  summary: { color: chrome.muted, fontSize: 16, marginTop: -8 },
  field: { gap: 10 },
  fieldLabel: { color: chrome.muted, fontFamily: 'OswaldMedium', fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase' },
  fieldLabelTv: { fontSize: 28, letterSpacing: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { paddingVertical: 12 },
});
