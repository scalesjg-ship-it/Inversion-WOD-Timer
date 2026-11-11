import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { unlockAudio } from '@/src/audio/sounds';
import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor } from '@/src/branding/color';
import { BigButton, Chip, NumberStepper, TimeField } from '@/src/components/ui';
import { useTimerSession } from '@/src/session/TimerSession';
import { chrome } from '@/src/theme/chrome';
import { formatSeconds } from '@/src/timer/format';
import { configFromCountdown, configFromPreset, BUILTIN_PRESETS, type CountdownPreset, type RoundPreset } from '@/src/timer/presets';
import { loadCountdownPresets, loadCustomPresets, saveCountdownPresets, saveCustomPresets } from '@/src/timer/presetStorage';

const WARNING_CHOICES = [0, 10, 30];

export default function RoundsScreen() {
  const { branding } = useBranding();
  const { setSession } = useTimerSession();
  const accent = readableDigitColor(branding.uiColor, branding.backgroundColor);
  const restColor = readableDigitColor(branding.restColor, branding.backgroundColor);
  const [custom, setCustom] = useState<RoundPreset[]>([]);
  const [countdowns, setCountdowns] = useState<CountdownPreset[]>([]);
  const [draft, setDraft] = useState<RoundPreset>(BUILTIN_PRESETS[0]);
  const [selectedId, setSelectedId] = useState(BUILTIN_PRESETS[0].id);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    void loadCustomPresets().then(setCustom);
    void loadCountdownPresets().then(setCountdowns);
  }, []);

  const apply = (preset: RoundPreset) => {
    setDraft(preset);
    setSelectedId(preset.id);
    setPresetName(preset.builtIn ? '' : preset.name);
  };

  const edit = (patch: Partial<RoundPreset>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setSelectedId('custom');
  };

  const start = () => {
    unlockAudio();
    setSession({
      config: configFromPreset(draft),
      label: draft.name,
    });
    router.push('/timer');
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) {
      Alert.alert('Name the preset', 'Give the preset a name before saving it on this device.');
      return;
    }
    const preset: RoundPreset = {
      ...draft,
      id: `custom-${Date.now()}`,
      name,
      builtIn: false,
    };
    const next = [...custom, preset];
    setCustom(next);
    setSelectedId(preset.id);
    setDraft(preset);
    void saveCustomPresets(next);
  };

  const removePreset = (preset: RoundPreset) => {
    Alert.alert('Delete preset', `Remove ${preset.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const next = custom.filter((item) => item.id !== preset.id);
          setCustom(next);
          void saveCustomPresets(next);
          if (selectedId === preset.id) apply(BUILTIN_PRESETS[0]);
        },
      },
    ]);
  };

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
            <Pressable
              key={preset.id}
              testID={`preset-${preset.id}`}
              accessibilityRole="button"
              onPress={() => apply(preset)}
              style={[
                styles.preset,
                { borderColor: selectedId === preset.id ? accent : chrome.line },
              ]}
            >
              <Text style={styles.presetName}>{preset.name}</Text>
              <Text style={styles.presetMeta}>{presetMeta(preset)}</Text>
            </Pressable>
          ))}
          {custom.map((preset) => (
            <Pressable
              key={preset.id}
              testID={`preset-${preset.id}`}
              accessibilityRole="button"
              onPress={() => apply(preset)}
              onLongPress={() => removePreset(preset)}
              style={[
                styles.preset,
                { borderColor: selectedId === preset.id ? accent : chrome.line },
              ]}
            >
              <Text style={styles.presetName}>{preset.name}</Text>
              <Text style={styles.presetMeta}>{presetMeta(preset)}</Text>
              <Pressable accessibilityRole="button" onPress={() => removePreset(preset)} hitSlop={8}>
                <Text style={[styles.delete, { color: restColor }]}>Delete</Text>
              </Pressable>
            </Pressable>
          ))}
        </View>

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
        {countdowns.length > 0 ? (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Saved countdowns</Text>
            {countdowns.map((preset) => (
              <Pressable
                key={preset.id}
                accessibilityRole="button"
                testID={`saved-countdown-${preset.id}`}
                onPress={() => {
                  unlockAudio();
                  setSession({ config: configFromCountdown(preset), label: preset.name });
                  router.push('/timer');
                }}
                style={styles.preset}
              >
                <Text style={styles.presetName}>{preset.name}</Text>
                <Text style={styles.presetMeta}>{preset.durationSeconds}s</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const next = countdowns.filter((item) => item.id !== preset.id);
                    setCountdowns(next);
                    void saveCountdownPresets(next);
                  }}
                >
                  <Text style={[styles.delete, { color: restColor }]}>Delete</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.saveRow}>
          <TextInput
            testID="preset-name"
            value={presetName}
            onChangeText={setPresetName}
            placeholder="Preset name"
            placeholderTextColor={chrome.muted}
            style={styles.nameInput}
          />
          <Pressable accessibilityRole="button" testID="save-preset" onPress={savePreset} style={styles.save}>
            <Text style={[styles.saveLabel, { color: accent }]}>Save</Text>
          </Pressable>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <BigButton testID="start-rounds" label="Start rounds" color={accent} onPress={start} />
      </View>
    </SafeAreaView>
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
  delete: {
    fontFamily: 'OswaldMedium',
    fontSize: 14,
    marginTop: 4,
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
  saveRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  nameInput: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: chrome.line,
    backgroundColor: chrome.surface,
    color: chrome.text,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  save: {
    minHeight: 52,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: {
    fontFamily: 'Oswald',
    fontSize: 20,
    letterSpacing: 0.6,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
});
