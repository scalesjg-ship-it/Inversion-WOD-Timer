import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { inkOn } from '@/src/branding/color';
import { TvFocusPressable } from '@/src/components/TvFocus';
import { chrome } from '@/src/theme/chrome';
import { stepperControlSize } from '@/src/tv/controls';
import { fitTvStyle, scaleTvStyle, tvScale } from '@/src/tv/layout';

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
  const { width, height } = useWindowDimensions();
  const scale = tv ? tvScale(width, height) : 1;
  const ink = solid ? inkOn(color) : color;
  return (
    <TvFocusPressable
      accent={ink}
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.big,
        tv && scaleTvStyle({ minHeight: 72, borderRadius: 18, paddingHorizontal: 36, minWidth: 240 }, scale),
        tv && { alignSelf: 'center', maxWidth: '100%' },
        solid
          ? { backgroundColor: color }
          : { backgroundColor: 'transparent', borderWidth: 1, borderColor: color },
        { opacity: pressed ? 0.72 : 1 },
      ]}
    >
      <Text
        style={[
          styles.bigLabel,
          { backgroundColor: 'transparent' },
          tv && scaleTvStyle({ fontSize: 32, letterSpacing: 1.2 }, scale),
          { color: ink },
        ]}
      >
        {label}
      </Text>
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
  compact = false,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  suffix: string;
  testID: string;
  accent: string;
  /** Shorter TV row so a whole setup fits on one screen. Phones ignore it. */
  compact?: boolean;
}) {
  const tv = Platform.isTV === true;
  const { height } = useWindowDimensions();
  const size = stepperControlSize(tv, tv ? height : 1080, tv && compact);
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
  compact = false,
}: {
  label: string;
  seconds: number;
  onChange: (seconds: number) => void;
  testID: string;
  accent: string;
  compact?: boolean;
}) {
  const tv = Platform.isTV === true;
  const { width, height } = useWindowDimensions();
  const scale = tv ? tvScale(width, height) : 1;
  const labelSize = compact ? 20 : 32;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: chrome.muted }, tv && scaleTvStyle({ fontSize: labelSize, letterSpacing: compact ? 1.2 : 2 }, scale)]}>{label}</Text>
      <View style={[styles.fieldRow, tv && styles.fieldRowTv]}>
        <NumberStepper
          value={minutes}
          min={0}
          max={180}
          suffix="min"
          testID={`${testID}-minutes`}
          accent={accent}
          compact={compact}
          onChange={(next) => onChange(next * 60 + remainder)}
        />
        <NumberStepper
          value={remainder}
          min={0}
          max={59}
          suffix="sec"
          testID={`${testID}-seconds`}
          accent={accent}
          compact={compact}
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
  const { width, height } = useWindowDimensions();
  const scale = tv ? tvScale(width, height) : 1;
  return (
    <TvFocusPressable
      accent={color}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
      onPress={onPress}
      style={() => [
        styles.chip,
        tv && scaleTvStyle({ minHeight: 52, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 3 }, scale),
        {
          borderColor: selected ? color : chrome.line,
          backgroundColor: selected ? `${color}22` : chrome.surface,
        },
      ]}
    >
      <Text style={[styles.chipLabel, { backgroundColor: 'transparent' }, tv && scaleTvStyle({ fontSize: 22 }, scale), { color: selected ? chrome.text : chrome.muted }]}>
        {selected ? `✓  ${label}` : label}
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
  const { width, height } = useWindowDimensions();
  const toggle = fitTvStyle(styles.tvToggle, width, height);
  const copy = fitTvStyle(styles.tvToggleCopy, width, height);
  const labelStyle = fitTvStyle(styles.fieldLabelTv, width, height);
  const valueStyle = fitTvStyle(styles.tvToggleValue, width, height);
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
        toggle,
        {
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
          borderColor: value ? accent : chrome.line,
        },
      ]}
    >
      <View style={copy}>
        <Text style={labelStyle}>{label}</Text>
        {help ? <Text style={styles.tvToggleHelp}>{help}</Text> : null}
      </View>
      <Text style={[valueStyle, { color: value ? accent : chrome.muted }]}>{value ? 'On' : 'Off'}</Text>
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
    color: chrome.text,
    fontSize: 22,
    letterSpacing: 1,
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
    minHeight: 64,
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chrome.surface,
  },
  tvToggle: {
    minHeight: 52,
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
    color: chrome.muted,
    fontSize: 16,
    lineHeight: 20,
  },
  tvToggleValue: {
    fontFamily: 'Oswald',
    fontSize: 22,
    letterSpacing: 0.4,
  },
});
