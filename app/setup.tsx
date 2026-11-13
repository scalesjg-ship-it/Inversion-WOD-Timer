import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor } from '@/src/branding/color';
import { PresetShelf } from '@/src/components/PresetShelf';
import { BigButton, Chip, HeaderBack, NumberStepper, TimeField, TvToggle } from '@/src/components/ui';
import { useTimerSession } from '@/src/session/TimerSession';
import { unlockAudio } from '@/src/audio/sounds';
import { chrome } from '@/src/theme/chrome';
import { TV_BODY_FONT, TV_SAFE_HORIZONTAL, TV_SECTION_FONT, tvSafeBox } from '@/src/tv/layout';
import { normalizeConfig } from '@/src/timer/engine';
import { modeTitle } from '@/src/timer/labels';
import { defaultConfig } from '@/src/timer/presets';
import { listPresets, presetSummary, type SavedPreset } from '@/src/timer/presetStorage';
import type { TimerConfig, TimerMode } from '@/src/timer/types';

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function readMode(value: string | string[] | undefined): TimerMode | null {
  const raw = readParam(value);
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
  const params = useLocalSearchParams<{ mode?: string; presetId?: string }>();
  const mode = readMode(params.mode);
  const presetId = readParam(params.presetId);
  const { branding } = useBranding();
  const { setSession } = useTimerSession();
  const accent = readableDigitColor(branding.uiColor, branding.backgroundColor);

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
      key={mode}
      mode={mode}
      accent={accent}
      presetId={presetId}
      onStart={(config, label) => {
        unlockAudio();
        setSession({ config, label });
        router.push('/timer');
      }}
    />
  );
}

function SetupForm({
  mode,
  accent,
  presetId,
  onStart,
}: {
  mode: TimerMode;
  accent: string;
  presetId: string;
  onStart: (config: TimerConfig, label: string) => void;
}) {
  const tv = Platform.isTV === true;
  const box = tvSafeBox(tv);
  const initial = defaultConfig(mode);
  const [leadInSeconds, setLeadInSeconds] = useState(initial.leadInSeconds);
  const [workSeconds, setWorkSeconds] = useState(mode === 'forTime' ? 12 * 60 : initial.workSeconds);
  const [restSeconds, setRestSeconds] = useState(initial.restSeconds);
  const [rounds, setRounds] = useState(initial.rounds);
  const [capOn, setCapOn] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [runLabel, setRunLabel] = useState(modeTitle(mode));

  const loadPreset = useCallback((preset: SavedPreset) => {
    setLeadInSeconds(preset.config.leadInSeconds);
    setRestSeconds(preset.config.restSeconds);
    setRounds(preset.config.rounds);
    if (preset.config.mode === 'forTime') {
      if (preset.config.workSeconds > 0) {
        setCapOn(true);
        setWorkSeconds(preset.config.workSeconds);
      } else {
        setCapOn(false);
      }
    } else {
      setWorkSeconds(preset.config.workSeconds);
    }
    setSelectedId(preset.id);
    setRunLabel(preset.name);
  }, []);

  useEffect(() => {
    if (!presetId) return undefined;
    let active = true;
    void listPresets(mode).then((presets) => {
      if (!active) return;
      const match = presets.find((preset) => preset.id === presetId);
      if (match) loadPreset(match);
    });
    return () => {
      active = false;
    };
  }, [loadPreset, mode, presetId]);

  const config = normalizeConfig({
    mode,
    leadInSeconds,
    workSeconds: mode === 'forTime' && !capOn ? 0 : workSeconds,
    restSeconds,
    rounds,
    warningSeconds: 0,
  });

  const summary = presetSummary(config);

  return (
    <SafeAreaView
      style={[
        styles.safe,
        tv && {
          paddingHorizontal: box.horizontal,
          paddingTop: box.vertical,
          paddingBottom: 36,
        },
      ]}
      edges={tv ? [] : ['top', 'bottom']}
    >
      <View style={styles.header}>
        <HeaderBack onPress={() => router.back()} color={accent} />
        <Text style={[styles.kicker, tv && styles.kickerTv]}>Americana</Text>
      </View>
      <ScrollView
        style={tv ? styles.scrollTv : undefined}
        contentContainerStyle={[styles.content, tv && styles.contentTv]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, tv && styles.titleTv]}>{modeTitle(mode)}</Text>
        <Text style={[styles.summary, tv && styles.summaryTv]}>{summary}</Text>
        <PresetShelf
          mode={mode}
          accent={accent}
          config={config}
          selectedId={selectedId}
          onLoad={loadPreset}
          onStart={(preset) => onStart(preset.config, preset.name)}
          onClearSelection={() => {
            setSelectedId('');
            setRunLabel(modeTitle(mode));
          }}
        />
        {mode === 'forTime' ? (
          Platform.isTV ? (
            <TvToggle
              label="Time cap"
              help="Stop the clock when the cap hits."
              value={capOn}
              onValueChange={setCapOn}
              testID="for-time-cap"
              accent={accent}
            />
          ) : (
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
          )
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
            <Text style={[styles.fieldLabel, Platform.isTV && styles.fieldLabelTv]}>Rounds</Text>
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
        <TimeField
          label="Lead-in"
          seconds={leadInSeconds}
          onChange={(value) => setLeadInSeconds(Math.min(600, value))}
          testID="lead-in"
          accent={accent}
        />
      </ScrollView>
      <View style={styles.footer}>
        <BigButton testID="start-timer" label="Start" color={accent} onPress={() => onStart(config, runLabel)} />
      </View>
    </SafeAreaView>
  );
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
  kicker: {
    color: chrome.muted,
    fontFamily: 'OswaldMedium',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontSize: 13,
  },
  kickerTv: {
    fontSize: TV_SECTION_FONT,
  },
  // The scroll view reaches the screen edge so a focused control's 1.08 scale is not clipped;
  // the content pads back in to the safe margin.
  scrollTv: {
    flex: 1,
    alignSelf: 'stretch',
    marginHorizontal: -TV_SAFE_HORIZONTAL,
  },
  content: {
    gap: 18,
    paddingTop: 12,
    paddingBottom: 24,
  },
  contentTv: {
    paddingHorizontal: TV_SAFE_HORIZONTAL,
    gap: 14,
    paddingTop: 4,
    paddingBottom: 8,
  },
  title: {
    fontFamily: 'Oswald',
    fontSize: 48,
    color: chrome.text,
    lineHeight: 52,
  },
  titleTv: {
    fontSize: 56,
    lineHeight: 64,
  },
  summary: {
    color: chrome.muted,
    fontSize: 16,
    marginTop: -8,
  },
  summaryTv: {
    fontSize: TV_BODY_FONT,
    lineHeight: TV_BODY_FONT + 8,
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
  fieldLabelTv: {
    fontSize: TV_SECTION_FONT,
    letterSpacing: 2,
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
    width: '100%',
  },
});
