import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { inkOn } from '@/src/branding/color';
import { TvFocusPressable } from '@/src/components/TvFocus';
import { chrome } from '@/src/theme/chrome';
import { stepperControlSize } from '@/src/tv/controls';

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
  const tv = Platform.isTV === true;
  const ink = solid ? inkOn(color) : color;
  return (
    <TvFocusPressable
      accent={ink}
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.big,
        tv && styles.bigTv,
        solid
          ? { backgroundColor: color }
          : { backgroundColor: 'transparent', borderWidth: 1, borderColor: color },
        { opacity: pressed ? 0.72 : 1 },
      ]}
    >
      <Text style={[styles.bigLabel, tv && styles.bigLabelTv, { color: ink }]}>{label}</Text>
    </TvFocusPressable>
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
  const tv = Platform.isTV === true;
  const size = stepperControlSize(tv);
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

  const stepFace = (pressed: boolean) => [
    styles.step,
    {
      width: size.button,
      height: size.button,
      borderRadius: size.radius,
      borderWidth: tv ? 4 : 1,
      opacity: pressed ? 0.6 : 1,
      borderColor: accent,
    },
  ];

  return (
    <View style={[styles.stepper, { gap: size.gap }]}>
      <TvFocusPressable
        accent={accent}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${suffix}`}
        testID={`${testID}-dec`}
        onPress={() => commit(value - 1)}
        style={({ pressed }) => stepFace(pressed)}
      >
        <Text style={[styles.stepGlyph, { color: accent, fontSize: size.glyph, lineHeight: size.glyph + 4 }]}>−</Text>
      </TvFocusPressable>
      <View style={styles.stepValue} focusable={tv ? false : undefined}>
        {tv ? (
          // number-pad is a phone keyboard. Reconciling that field during a TV focus move quits the app.
          <Text
            testID={testID}
            accessibilityLabel={suffix}
            accessible={false}
            importantForAccessibility="no"
            style={[styles.stepInput, { fontSize: size.value, minWidth: size.valueMinWidth }]}
          >
            {text}
          </Text>
        ) : (
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
            style={[styles.stepInput, { fontSize: size.value, minWidth: size.valueMinWidth }]}
          />
        )}
        <Text style={[styles.suffix, { fontSize: size.suffix }]}>{suffix}</Text>
      </View>
      <TvFocusPressable
        accent={accent}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${suffix}`}
        testID={`${testID}-inc`}
        onPress={() => commit(value + 1)}
        style={({ pressed }) => stepFace(pressed)}
      >
        <Text style={[styles.stepGlyph, { color: accent, fontSize: size.glyph, lineHeight: size.glyph + 4 }]}>+</Text>
      </TvFocusPressable>
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
  const tv = Platform.isTV === true;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, tv && styles.fieldLabelTv]}>{label}</Text>
      <View style={[styles.fieldRow, tv && styles.fieldRowTv]}>
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
  const tv = Platform.isTV === true;
  return (
    <TvFocusPressable
      accent={color}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
      onPress={onPress}
      style={() => [
        styles.chip,
        tv && styles.chipTv,
        {
          borderColor: selected ? color : chrome.line,
          backgroundColor: selected ? `${color}22` : chrome.surface,
        },
      ]}
    >
      <Text style={[styles.chipLabel, tv && styles.chipLabelTv, { color: selected ? chrome.text : chrome.muted }]}>
        {label}
      </Text>
    </TvFocusPressable>
  );
}

export function HeaderBack({
  onPress,
  color,
  testID,
  label = 'Back',
}: {
  onPress: () => void;
  color: string;
  testID?: string;
  label?: string;
}) {
  const tv = Platform.isTV === true;
  return (
    <TvFocusPressable
      accent={color}
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      hitSlop={tv ? undefined : 12}
      style={({ pressed }) =>
        tv ? [styles.backHitTv, { opacity: pressed ? 0.75 : 1 }] : undefined
      }
    >
      <Text style={[styles.back, tv && styles.backTv, { color }]}>{label}</Text>
    </TvFocusPressable>
  );
}

export function TvToggle({
  label,
  help,
  value,
  onValueChange,
  testID,
  accent,
  disabled = false,
}: {
  label: string;
  help?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  testID?: string;
  accent: string;
  disabled?: boolean;
}) {
  return (
    <TvFocusPressable
      accent={accent}
      dim={!disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      testID={testID}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [
        styles.tvToggle,
        {
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
          borderColor: value ? accent : chrome.line,
        },
      ]}
    >
      <View style={styles.tvToggleCopy}>
        <Text style={styles.fieldLabelTv}>{label}</Text>
        {help ? <Text style={styles.tvToggleHelp}>{help}</Text> : null}
      </View>
      <Text style={[styles.tvToggleValue, { color: value ? accent : chrome.muted }]}>{value ? 'On' : 'Off'}</Text>
    </TvFocusPressable>
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
  bigTv: {
    minHeight: 128,
    borderRadius: 28,
    paddingHorizontal: 28,
  },
  bigLabel: {
    fontFamily: 'Oswald',
    fontSize: 26,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  bigLabelTv: {
    fontSize: 48,
    letterSpacing: 2,
  },
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  step: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chrome.surface,
  },
  stepGlyph: {
    fontFamily: 'Oswald',
  },
  stepValue: {
    flex: 1,
    alignItems: 'center',
  },
  stepInput: {
    fontFamily: 'Oswald',
    color: chrome.text,
    textAlign: 'center',
    paddingVertical: 0,
  },
  suffix: {
    color: chrome.muted,
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
  fieldLabelTv: {
    fontSize: 32,
    letterSpacing: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldRowTv: {
    gap: 24,
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
  chipTv: {
    minHeight: 88,
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderWidth: 4,
  },
  chipLabel: {
    fontFamily: 'OswaldMedium',
    fontSize: 16,
    letterSpacing: 0.4,
  },
  chipLabelTv: {
    fontSize: 32,
  },
  back: {
    fontFamily: 'OswaldMedium',
    fontSize: 18,
  },
  backTv: {
    fontSize: 40,
  },
  backHitTv: {
    minHeight: 96,
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chrome.surface,
  },
  tvToggle: {
    minHeight: 116,
    borderRadius: 22,
    borderWidth: 4,
    backgroundColor: chrome.surface,
    paddingHorizontal: 22,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  tvToggleCopy: {
    flex: 1,
    gap: 6,
  },
  tvToggleHelp: {
    color: chrome.text,
    fontSize: 28,
    lineHeight: 36,
  },
  tvToggleValue: {
    fontFamily: 'Oswald',
    fontSize: 48,
    letterSpacing: 0.6,
  },
});
