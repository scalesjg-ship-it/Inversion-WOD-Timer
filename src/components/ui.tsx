import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { inkOn } from '@/src/branding/color';
import { chrome } from '@/src/theme/chrome';

export function BigButton({
  label,
  onPress,
  color,
  testID,
  variant = 'solid',
}: {
  label: string;
  onPress: () => void;
  color: string;
  testID?: string;
  variant?: 'solid' | 'ghost';
}) {
  const solid = variant === 'solid';
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.big,
        solid
          ? { backgroundColor: color }
          : { backgroundColor: 'transparent', borderWidth: 1, borderColor: chrome.line },
        { opacity: pressed ? 0.72 : 1 },
      ]}
    >
      <Text style={[styles.bigLabel, { color: solid ? inkOn(color) : chrome.text }]}>{label}</Text>
    </Pressable>
  );
}

export function NumberStepper({
  value,
  onChange,
  min,
  max,
  suffix,
  testID,
  accent,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  suffix: string;
  testID: string;
  accent: string;
}) {
  const [text, setText] = useState(String(value));
  const [tracked, setTracked] = useState(value);
  if (value !== tracked) {
    setTracked(value);
    setText(String(value));
  }

  const commit = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    onChange(clamped);
    setText(String(clamped));
  };

  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${suffix}`}
        testID={`${testID}-dec`}
        onPress={() => commit(value - 1)}
        style={({ pressed }) => [styles.step, { opacity: pressed ? 0.6 : 1, borderColor: accent }]}
      >
        <Text style={[styles.stepGlyph, { color: accent }]}>−</Text>
      </Pressable>
      <View style={styles.stepValue}>
        <TextInput
          testID={testID}
          accessibilityLabel={suffix}
          value={text}
          onChangeText={(raw) => {
            const digits = raw.replace(/[^0-9]/g, '');
            setText(digits);
            if (digits === '') return;
            commit(Number(digits));
          }}
          onBlur={() => commit(text === '' ? min : Number(text))}
          keyboardType="number-pad"
          inputMode="numeric"
          style={styles.stepInput}
        />
        <Text style={styles.suffix}>{suffix}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${suffix}`}
        testID={`${testID}-inc`}
        onPress={() => commit(value + 1)}
        style={({ pressed }) => [styles.step, { opacity: pressed ? 0.6 : 1, borderColor: accent }]}
      >
        <Text style={[styles.stepGlyph, { color: accent }]}>+</Text>
      </Pressable>
    </View>
  );
}

export function TimeField({
  label,
  seconds,
  onChange,
  testID,
  accent,
}: {
  label: string;
  seconds: number;
  onChange: (seconds: number) => void;
  testID: string;
  accent: string;
}) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <NumberStepper
          value={minutes}
          min={0}
          max={180}
          suffix="min"
          testID={`${testID}-minutes`}
          accent={accent}
          onChange={(next) => onChange(next * 60 + remainder)}
        />
        <NumberStepper
          value={remainder}
          min={0}
          max={59}
          suffix="sec"
          testID={`${testID}-seconds`}
          accent={accent}
          onChange={(next) => onChange(minutes * 60 + next)}
        />
      </View>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color: string;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? color : chrome.line,
          backgroundColor: selected ? `${color}22` : chrome.surface,
        },
      ]}
    >
      <Text style={[styles.chipLabel, { color: selected ? chrome.text : chrome.muted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  big: {
    minHeight: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  bigLabel: {
    fontFamily: 'Oswald',
    fontSize: 26,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  step: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chrome.surface,
  },
  stepGlyph: {
    fontFamily: 'Oswald',
    fontSize: 32,
    lineHeight: 36,
  },
  stepValue: {
    flex: 1,
    alignItems: 'center',
  },
  stepInput: {
    fontFamily: 'Oswald',
    fontSize: 32,
    color: chrome.text,
    textAlign: 'center',
    minWidth: 56,
    paddingVertical: 0,
  },
  suffix: {
    color: chrome.muted,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
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
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontFamily: 'OswaldMedium',
    fontSize: 16,
    letterSpacing: 0.4,
  },
});
