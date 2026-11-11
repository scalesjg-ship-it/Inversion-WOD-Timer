import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { unlockAudio } from '@/src/audio/sounds';
import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor } from '@/src/branding/color';
import { PresetShelf } from '@/src/components/PresetShelf';
import { BigButton, Chip, NumberStepper, TimeField } from '@/src/components/ui';
import { useTimerSession } from '@/src/session/TimerSession';
import { chrome } from '@/src/theme/chrome';
import { formatSeconds } from '@/src/timer/format';
import { BUILTIN_PRESETS, configFromPreset, type RoundPreset } from '@/src/timer/presets';
import { listPresets, type SavedPreset } from '@/src/timer/presetStorage';

const WARNING_CHOICES = [0, 10, 30];

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function draftFromSaved(preset: SavedPreset): RoundPreset {
  return {
    id: preset.id,
    name: preset.name,
    roundSeconds: preset.config.workSeconds,
    restSeconds: preset.config.restSeconds,
    rounds: preset.config.rounds,
    warningSeconds: preset.config.warningSeconds,
    leadInSeconds: preset.config.leadInSeconds,
    builtIn: false,
  };
}

export default function RoundsScreen() {
  const params = useLocalSearchParams<{ presetId?: string }>();
  const presetId = readParam(params.presetId);
  const { branding } = useBranding();
  const { setSession } = useTimerSession();
  const accent = readableDigitColor(branding.uiColor, branding.backgroundColor);
  const restColor = readableDigitColor(branding.restColor, branding.backgroundColor);
  const [draft, setDraft] = useState<RoundPreset>(BUILTIN_PRESETS[0]);
  const [selectedId, setSelectedId] = useState(BUILTIN_PRESETS[0].id);

  const applySaved = useCallback((preset: SavedPreset) => {
    setDraft(draftFromSaved(preset));
    setSelectedId(preset.id);
  }, []);

  useEffect(() => {
    if (!presetId) return undefined;
    let active = true;
    void listPresets('rounds').then((presets) => {
      if (!active) return;
      const match = presets.find((preset) => preset.id === presetId);
      if (match) applySaved(match);
    });
    return () => {
      active = false;
    };
  }, [applySaved, presetId]);

  const apply = (preset: RoundPreset) => {
    setDraft({ ...preset });
    setSelectedId(preset.id);
  };

  const edit = (patch: Partial<RoundPreset>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setSelectedId((current) => (BUILTIN_PRESETS.some((preset) => preset.id === current) ? 'custom' : current));
  };

  const start = (config = configFromPreset(draft), label = draft.name) => {
    unlockAudio();
    setSession({ config, label });
    router.push('/timer');
  };

  const builtInSelected = BUILTIN_PRESETS.some((preset) => preset.id === selectedId);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        testID="screen-rounds"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.wordmark, { color: accent }]}>Americana</Text>
        <Text style={styles.title}>Rounds</Text>
        <Text style={styles.lede}>Jiu-jitsu, striking, and sparring. Rest is a different color from work.</Text>
        <View style={styles.presets}>
          {BUILTIN_PRESETS.map((preset) => (
            <StandardCard
              key={preset.id}
              preset={preset}
              accent={accent}
              selected={selectedId === preset.id}
              onPress={() => apply(preset)}
            />
          ))}
        </View>

        <PresetShelf
          mode="rounds"
          accent={accent}
          config={configFromPreset(draft)}
          selectedId={selectedId}
          nameHint={builtInSelected ? draft.name : undefined}
          onLoad={applySaved}
          onStart={(preset) => start(preset.config, preset.name)}
          onClearSelection={() => apply(BUILTIN_PRESETS[0])}
        />

        <TimeField
          label="Round"
          seconds={draft.roundSeconds}
          onChange={(roundSeconds) => edit({ roundSeconds })}
          testID="round"
          accent={accent}
        />
        <TimeField
          label="Rest"
          seconds={draft.restSeconds}
          onChange={(restSeconds) => edit({ restSeconds })}
          testID="rest"
          accent={restColor}
        />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Rounds</Text>
          <NumberStepper
            value={draft.rounds}
            min={1}
            max={99}
            suffix="rds"
            testID="round-count"
            accent={accent}
            onChange={(rounds) => edit({ rounds })}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Warning before the round ends</Text>
          <View style={styles.chips}>
            {WARNING_CHOICES.map((seconds) => (
              <Chip
                key={seconds}
                label={seconds === 0 ? 'Off' : `${seconds}s`}
                selected={draft.warningSeconds === seconds}
                onPress={() => edit({ warningSeconds: seconds })}
                color={accent}
                testID={`warning-${seconds}`}
              />
            ))}
          </View>
          <NumberStepper
            value={draft.warningSeconds}
            min={0}
            max={Math.max(0, draft.roundSeconds - 1)}
            suffix="sec"
            testID="warning"
            accent={accent}
            onChange={(warningSeconds) => edit({ warningSeconds })}
          />
        </View>
        <TimeField
          label="Lead-in"
          seconds={draft.leadInSeconds}
          onChange={(leadInSeconds) => edit({ leadInSeconds: Math.min(600, leadInSeconds) })}
          testID="lead-in"
          accent={accent}
        />
      </ScrollView>
      <View style={styles.footer}>
        <BigButton testID="start-rounds" label="Start rounds" color={accent} onPress={() => start()} />
      </View>
    </SafeAreaView>
  );
}

function StandardCard({
  preset,
  accent,
  selected,
  onPress,
}: {
  preset: RoundPreset;
  accent: string;
  selected: boolean;
  onPress: () => void;
}) {
  const [webFocused, setWebFocused] = useState(false);
  return (
    <Pressable
      testID={`preset-${preset.id}`}
      accessibilityRole="button"
      onPress={onPress}
      onFocus={() => setWebFocused(true)}
      onBlur={() => setWebFocused(false)}
      style={({ focused }) => [
        styles.preset,
        { borderColor: selected ? accent : chrome.line },
        focused || webFocused ? { borderWidth: 6, borderColor: accent } : null,
      ]}
    >
      <Text style={styles.presetName}>{preset.name}</Text>
      <Text style={styles.presetMeta}>{presetMeta(preset)}</Text>
    </Pressable>
  );
}

function presetMeta(preset: RoundPreset): string {
  return `${formatSeconds(preset.roundSeconds)} / ${formatSeconds(preset.restSeconds)} · ${preset.rounds} rd`;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: chrome.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  wordmark: {
    fontFamily: 'OswaldMedium',
    fontSize: 14,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  title: {
    fontFamily: 'Oswald',
    fontSize: 40,
    lineHeight: 44,
    color: chrome.text,
  },
  lede: {
    color: chrome.muted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: -6,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  preset: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: chrome.surface,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    minHeight: 84,
  },
  presetName: {
    fontFamily: 'Oswald',
    fontSize: 22,
    color: chrome.text,
  },
  presetMeta: {
    color: chrome.muted,
    fontSize: 13,
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
});
