import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { unlockAudio } from '@/src/audio/sounds';
import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor } from '@/src/branding/color';
import { BigButton, Chip, NumberStepper, TimeField } from '@/src/components/ui';
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
import { formatSeconds } from '@/src/timer/format';
import { configFromCountdown, defaultConfig, type CountdownPreset } from '@/src/timer/presets';
import { loadCountdownPresets, saveCountdownPresets } from '@/src/timer/presetStorage';

export default function CountdownScreen() {
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
  const [name, setName] = useState('');
  const [saved, setSaved] = useState<CountdownPreset[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const nextId = useRef(1);

  useEffect(() => {
    void loadCountdownPresets().then(setSaved);
  }, []);

  const durationSeconds = joinDuration(hours, minutes, seconds);

  const applyDuration = (total: number) => {
    const parts = splitDuration(total);
    setHours(parts.hours);
    setMinutes(parts.minutes);
    setSeconds(parts.seconds);
    setMarks((current) => withFinalBeeps(current, finalBeepsEnabled(current), total));
    setSelectedId('');
  };

  const applyPreset = (preset: CountdownPreset) => {
    const parts = splitDuration(preset.durationSeconds);
    setHours(parts.hours);
    setMinutes(parts.minutes);
    setSeconds(parts.seconds);
    setLeadInSeconds(preset.leadInSeconds);
    setMarks(preset.warningMarksSeconds);
    setName(preset.name);
    setSelectedId(preset.id);
  };

  const start = (label: string) => {
    unlockAudio();
    setSession({
      config: configFromCountdown({
        kind: 'countdown',
        id: selectedId || 'draft',
        name: label,
        durationSeconds,
        leadInSeconds,
        warningMarksSeconds: marks,
        builtIn: false,
      }),
      label,
    });
    router.push('/timer');
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name the countdown', 'Give it a name to keep it with your other presets.');
      return;
    }
    const preset: CountdownPreset = {
      kind: 'countdown',
      id: `countdown-${nextId.current}`,
      name: trimmed,
      durationSeconds,
      leadInSeconds,
      warningMarksSeconds: marks,
      builtIn: false,
    };
    nextId.current += 1;
    const next = [...saved, preset];
    setSaved(next);
    setSelectedId(preset.id);
    void saveCountdownPresets(next);
  };

  const remove = (preset: CountdownPreset) => {
    const next = saved.filter((item) => item.id !== preset.id);
    setSaved(next);
    void saveCountdownPresets(next);
    if (selectedId === preset.id) setSelectedId('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" testID="countdown-back" onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: accent }]}>Back</Text>
        </Pressable>
        <Text style={styles.kicker}>Americana</Text>
      </View>
      <ScrollView testID="screen-countdown" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Countdown</Text>
        <Text style={styles.summary}>
          {formatSeconds(durationSeconds)}
          {leadInSeconds > 0 ? ` · ${leadInSeconds}s lead-in` : ' · no lead-in'}
        </Text>

        {saved.length > 0 ? (
          <View style={styles.presets}>
            {saved.map((preset) => (
              <Pressable
                key={preset.id}
                accessibilityRole="button"
                testID={`countdown-preset-${preset.id}`}
                onPress={() => applyPreset(preset)}
                style={[styles.preset, { borderColor: selectedId === preset.id ? accent : chrome.line }]}
              >
                <Text style={styles.presetName}>{preset.name}</Text>
                <Text style={styles.presetMeta}>{formatSeconds(preset.durationSeconds)}</Text>
                <Pressable accessibilityRole="button" onPress={() => remove(preset)} hitSlop={8}>
                  <Text style={[styles.delete, { color: accent }]}>Delete</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Duration</Text>
          <NumberStepper value={hours} min={0} max={23} suffix="hr" testID="countdown-hours" accent={accent} onChange={(value) => applyDuration(joinDuration(value, minutes, seconds))} />
          <NumberStepper value={minutes} min={0} max={59} suffix="min" testID="countdown-minutes" accent={accent} onChange={(value) => applyDuration(joinDuration(hours, value, seconds))} />
          <NumberStepper value={seconds} min={0} max={59} suffix="sec" testID="countdown-seconds" accent={accent} onChange={(value) => applyDuration(joinDuration(hours, minutes, value))} />
        </View>
        <View style={styles.chips}>
          <Chip label="+30s" color={accent} selected={false} testID="add-30" onPress={() => applyDuration(addCountdownSeconds(durationSeconds, 30))} />
          <Chip label="+1m" color={accent} selected={false} testID="add-60" onPress={() => applyDuration(addCountdownSeconds(durationSeconds, 60))} />
          <Chip label="+5m" color={accent} selected={false} testID="add-300" onPress={() => applyDuration(addCountdownSeconds(durationSeconds, 300))} />
        </View>

        <TimeField label="Lead-in" seconds={leadInSeconds} onChange={(value) => { setLeadInSeconds(Math.min(600, value)); setSelectedId(''); }} testID="lead-in" accent={accent} />

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Warning beeps</Text>
          <View style={styles.chips}>
            {WARNING_MARK_CHOICES.map((choice) => (
              <Chip
                key={choice.id}
                label={choice.label}
                color={accent}
                selected={marks.includes(choice.seconds)}
                testID={`mark-${choice.id}`}
                onPress={() => {
                  setSelectedId('');
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
              onPress={() => {
                setSelectedId('');
                setMarks((current) => withFinalBeeps(current, !finalBeepsEnabled(current), durationSeconds));
              }}
            />
          </View>
        </View>

        <View style={styles.saveRow}>
          <TextInput
            testID="countdown-name"
            value={name}
            onChangeText={setName}
            placeholder="Preset name"
            placeholderTextColor={chrome.muted}
            style={styles.nameInput}
          />
          <Pressable accessibilityRole="button" testID="save-countdown" onPress={save}>
            <Text style={[styles.save, { color: accent }]}>Save</Text>
          </Pressable>
        </View>
        <Text style={styles.help}>Saved countdowns stay on this device with your round presets.</Text>
      </ScrollView>
      <View style={styles.footer}>
        <BigButton testID="start-countdown" label="Start countdown" color={accent} onPress={() => start(name.trim() || 'Countdown')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: chrome.bg, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  back: { fontFamily: 'OswaldMedium', fontSize: 18 },
  kicker: { color: chrome.muted, fontFamily: 'OswaldMedium', letterSpacing: 2, textTransform: 'uppercase', fontSize: 13 },
  content: { gap: 16, paddingTop: 12, paddingBottom: 24 },
  title: { fontFamily: 'Oswald', fontSize: 48, color: chrome.text, lineHeight: 52 },
  summary: { color: chrome.muted, fontSize: 16, marginTop: -8 },
  field: { gap: 10 },
  fieldLabel: { color: chrome.muted, fontFamily: 'OswaldMedium', fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  preset: { width: '48%', flexGrow: 1, backgroundColor: chrome.surface, borderWidth: 1, borderRadius: 16, padding: 12, gap: 4 },
  presetName: { fontFamily: 'Oswald', fontSize: 20, color: chrome.text },
  presetMeta: { color: chrome.muted, fontSize: 13 },
  delete: { fontFamily: 'OswaldMedium', fontSize: 14, marginTop: 4 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: { flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: chrome.line, backgroundColor: chrome.surface, color: chrome.text, paddingHorizontal: 14, fontSize: 16 },
  save: { fontFamily: 'Oswald', fontSize: 20 },
  help: { color: chrome.muted, fontSize: 14, lineHeight: 20 },
  footer: { paddingVertical: 12 },
});
