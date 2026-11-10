import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBranding } from '@/src/branding/BrandingProvider';
import { digitColor } from '@/src/branding/color';
import { BigButton, Chip, NumberStepper, TimeField } from '@/src/components/ui';
import { useTimerSession } from '@/src/session/TimerSession';
import { unlockAudio } from '@/src/audio/sounds';
import { chrome } from '@/src/theme/chrome';
import { normalizeConfig } from '@/src/timer/engine';
import { modeTitle } from '@/src/timer/labels';
import { defaultConfig } from '@/src/timer/presets';
import { formatSeconds } from '@/src/timer/format';
import type { TimerConfig, TimerMode } from '@/src/timer/types';

function readMode(value: string | string[] | undefined): TimerMode | null {
  const raw = Array.isArray(value) ? value[0] : value;
  switch (raw) {
    case 'forTime':
    case 'amrap':
    case 'emom':
    case 'tabata':
    case 'intervals':
      return raw;
    default:
      return null;
  }
}

export default function SetupScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = readMode(params.mode);
  const { branding } = useBranding();
  const { setSession } = useTimerSession();
  const accent = digitColor(branding.primaryColor);

  if (!mode) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Pick a conditioning mode.</Text>
        <BigButton label="Back" color={accent} onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SetupForm
      mode={mode}
      accent={accent}
      onStart={(config) => {
        unlockAudio();
        setSession({ config, label: modeTitle(mode) });
        router.push('/timer');
      }}
    />
  );
}

function SetupForm({
  mode,
  accent,
  onStart,
}: {
  mode: TimerMode;
  accent: string;
  onStart: (config: TimerConfig) => void;
}) {
  const initial = defaultConfig(mode);
  const [leadInSeconds, setLeadInSeconds] = useState(initial.leadInSeconds);
  const [workSeconds, setWorkSeconds] = useState(mode === 'forTime' ? 12 * 60 : initial.workSeconds);
  const [restSeconds, setRestSeconds] = useState(initial.restSeconds);
  const [rounds, setRounds] = useState(initial.rounds);
  const [capOn, setCapOn] = useState(false);

  const config = normalizeConfig({
    mode,
    leadInSeconds,
    workSeconds: mode === 'forTime' && !capOn ? 0 : workSeconds,
    restSeconds,
    rounds,
    warningSeconds: 0,
  });

  const summary = summaryFor(config, capOn);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: accent }]}>Back</Text>
        </Pressable>
        <Text style={styles.kicker}>Americana</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{modeTitle(mode)}</Text>
        <Text style={styles.summary}>{summary}</Text>
        {mode === 'forTime' ? (
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.fieldLabel}>Time cap</Text>
              <Text style={styles.switchHelp}>Stop the clock when the cap hits.</Text>
            </View>
            <Switch
              testID="for-time-cap"
              value={capOn}
              onValueChange={setCapOn}
              trackColor={{ false: '#2A3140', true: accent }}
              thumbColor={chrome.text}
            />
          </View>
        ) : null}
        {mode === 'forTime' && capOn ? (
          <TimeField label="Cap" seconds={workSeconds} onChange={setWorkSeconds} testID="cap" accent={accent} />
        ) : null}
        {mode === 'amrap' ? (
          <>
            <ChipRow
              accent={accent}
              options={[8, 10, 12, 15, 20].map((minutes) => ({
                label: `${minutes} min`,
                selected: workSeconds === minutes * 60,
                onPress: () => setWorkSeconds(minutes * 60),
                testID: `amrap-${minutes}`,
              }))}
            />
            <TimeField label="Time" seconds={workSeconds} onChange={setWorkSeconds} testID="amrap" accent={accent} />
          </>
        ) : null}
        {mode === 'emom' ? (
          <>
            <TimeField
              label="Every"
              seconds={workSeconds}
              onChange={setWorkSeconds}
              testID="emom-every"
              accent={accent}
            />
            <ChipRow
              accent={accent}
              options={[8, 10, 12, 20].map((count) => ({
                label: `${count} rounds`,
                selected: rounds === count,
                onPress: () => setRounds(count),
                testID: `emom-rounds-${count}`,
              }))}
            />
          </>
        ) : null}
        {mode === 'tabata' || mode === 'intervals' ? (
          <>
            <TimeField label="Work" seconds={workSeconds} onChange={setWorkSeconds} testID="work" accent={accent} />
            <TimeField label="Rest" seconds={restSeconds} onChange={setRestSeconds} testID="rest" accent={accent} />
          </>
        ) : null}
        {mode !== 'forTime' && mode !== 'amrap' ? (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Rounds</Text>
            <NumberStepper
              value={rounds}
              min={1}
              max={99}
              suffix="rds"
              testID="rounds"
              accent={accent}
              onChange={setRounds}
            />
          </View>
        ) : null}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Lead-in</Text>
          <NumberStepper
            value={leadInSeconds}
            min={0}
            max={60}
            suffix="sec"
            testID="lead-in"
            accent={accent}
            onChange={setLeadInSeconds}
          />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <BigButton testID="start-timer" label="Start" color={accent} onPress={() => onStart(config)} />
      </View>
    </SafeAreaView>
  );
}

function summaryFor(config: TimerConfig, capOn: boolean): string {
  const lead = config.leadInSeconds > 0 ? `${config.leadInSeconds}s lead-in` : 'No lead-in';
  switch (config.mode) {
    case 'forTime':
      return capOn && config.workSeconds > 0 ? `${lead} · cap ${formatSeconds(config.workSeconds)}` : `${lead} · count up`;
    case 'amrap':
      return `${lead} · ${formatSeconds(config.workSeconds)}`;
    case 'emom':
      return `${lead} · every ${formatSeconds(config.workSeconds)} · ${config.rounds} rounds`;
    case 'tabata':
    case 'intervals':
      return `${lead} · ${formatSeconds(config.workSeconds)} on / ${formatSeconds(config.restSeconds)} off · ${config.rounds} rounds`;
    case 'rounds':
      return lead;
    default: {
      const exhaustive: never = config.mode;
      return exhaustive;
    }
  }
}

function ChipRow({
  options,
  accent,
}: {
  accent: string;
  options: { label: string; selected: boolean; onPress: () => void; testID: string }[];
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => (
        <Chip
          key={option.testID}
          label={option.label}
          selected={option.selected}
          onPress={option.onPress}
          color={accent}
          testID={option.testID}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: chrome.bg,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  back: {
    fontFamily: 'OswaldMedium',
    fontSize: 18,
  },
  kicker: {
    color: chrome.muted,
    fontFamily: 'OswaldMedium',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontSize: 13,
  },
  content: {
    gap: 18,
    paddingTop: 12,
    paddingBottom: 24,
  },
  title: {
    fontFamily: 'Oswald',
    fontSize: 48,
    color: chrome.text,
    lineHeight: 52,
  },
  summary: {
    color: chrome.muted,
    fontSize: 16,
    marginTop: -8,
  },
  field: {
    gap: 10,
  },
  fieldLabel: {
    color: chrome.muted,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: 'OswaldMedium',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  switchHelp: {
    color: chrome.text,
    marginTop: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footer: {
    paddingVertical: 12,
  },
});
