import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { inkOn } from '@/src/branding/color';
import { TvFocusPressable } from '@/src/components/TvFocus';
import type { TvFocusTag } from '@/src/components/TvTabFocus';
import { useTvFocusTag } from '@/src/tv/useTvFocusTag';
import { chrome } from '@/src/theme/chrome';
import { stepperControlSize, tvSetupScale } from '@/src/tv/controls';
import { fitTvStyle, scaleTvStyle, tvScale } from '@/src/tv/layout';
import { stepperFocus, tvSetupMetrics, type StepperLinks } from '@/src/tv/setupLayout';

export function BigButton({
  label,
  onPress,
  color,
  testID,
  variant = 'solid',
  focusDown = null,
  focusUp = null,
  focusLeft = null,
  focusRight = null,
  hasTVPreferredFocus,
  onHost,
  onFocus,
  focusable,
  roomy = false,
}: {
  label: string;
  onPress: () => void;
  color: string;
  testID?: string;
  variant?: 'solid' | 'ghost';
  /** TV only. Down from this button moves to the tab bar. */
  focusDown?: TvFocusTag | null;
  focusUp?: TvFocusTag | null;
  focusLeft?: TvFocusTag | null;
  focusRight?: TvFocusTag | null;
  hasTVPreferredFocus?: boolean;
  onHost?: (node: ComponentRef<typeof Pressable> | null) => void;
  onFocus?: () => void;
  focusable?: boolean;
  /** TV setup and Rounds. A larger Start control. Phones ignore it. */
  roomy?: boolean;
}) {
  const solid = variant === 'solid';
  const tv = Platform.isTV === true;
  const { width, height } = useWindowDimensions();
  const scale = tv ? tvScale(width, height) : 1;
  const ink = solid ? inkOn(color) : color;
  const grown = tvSetupScale(height);
  const tvButton = roomy
    ? {
        minHeight: Math.round(72 * grown),
        borderRadius: Math.round(18 * grown),
        paddingHorizontal: Math.round(36 * grown),
        minWidth: Math.round(240 * grown),
      }
    : { minHeight: 72, borderRadius: 18, paddingHorizontal: 36, minWidth: 240 };
  const tvLabel = roomy
    ? { fontSize: Math.round(32 * grown), letterSpacing: 1.4 }
    : { fontSize: 32, letterSpacing: 1.2 };
  return (
    <TvFocusPressable
      accent={ink}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      focusDown={focusDown}
      focusUp={focusUp}
      focusLeft={focusLeft}
      focusRight={focusRight}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onHost={onHost}
      onFocus={onFocus}
      focusable={focusable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.big,
        tv && scaleTvStyle(tvButton, scale),
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
          tv && scaleTvStyle(tvLabel, scale),
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
  outsideLeft = null,
  outsideRight = null,
  onLinks,
  preferred = false,
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
  /** TV only. Focus Left from the minus button. Stays on minus when null. */
  outsideLeft?: TvFocusTag | null;
  /** TV only. Focus Right from the plus button. Stays on plus when null. */
  outsideRight?: TvFocusTag | null;
  /** TV only. Reports the native tags so the next cluster can link across. */
  onLinks?: (links: StepperLinks) => void;
  /** TV only. First control on a setup screen. */
  preferred?: boolean;
}) {
  const tv = Platform.isTV === true;
  const { width, height } = useWindowDimensions();
  const size = stepperControlSize(tv, tv ? height : 1080, tv && compact);
  const metrics = tv ? tvSetupMetrics(width, height) : null;
  const [decTag, onDecHost] = useTvFocusTag();
  const [incTag, onIncHost] = useTvFocusTag();
  const onLinksRef = useRef(onLinks);
  useEffect(() => {
    onLinksRef.current = onLinks;
    onLinksRef.current?.({ dec: decTag, inc: incTag });
  }, [onLinks, decTag, incTag]);
  const focus = stepperFocus({ dec: decTag, inc: incTag }, outsideLeft, outsideRight);
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
    <View
      style={[
        tv ? styles.stepperTv : styles.stepper,
        { gap: size.gap },
        // One cluster wide. A lone stepper must not grow into the minutes+seconds row.
        tv && metrics
          ? {
              width: metrics.cluster,
              minWidth: metrics.cluster,
              maxWidth: metrics.cluster,
              flexBasis: metrics.cluster,
            }
          : null,
      ]}
    >
      <TvFocusPressable
        accent={accent}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${suffix}`}
        testID={`${testID}-dec`}
        hasTVPreferredFocus={tv && preferred ? true : undefined}
        onHost={tv ? onDecHost : undefined}
        focusLeft={tv ? focus.decLeft : null}
        focusRight={tv ? focus.decRight : null}
        onPress={() => commit(value - 1)}
        style={({ pressed }) => stepFace(pressed)}
      >
        <Text style={[styles.stepGlyph, { color: accent, fontSize: size.glyph, lineHeight: size.glyph + 4 }]}>−</Text>
      </TvFocusPressable>
      <View style={tv ? [styles.stepValueTv, { width: metrics?.valueSlot }] : styles.stepValue} focusable={tv ? false : undefined}>
        {tv ? (
          // number-pad is a phone keyboard. Reconciling that field during a TV focus move quits the app.
          <Text
            testID={testID}
            accessibilityLabel={`${text} ${suffix}`}
            accessible={false}
            importantForAccessibility="no"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
            style={[styles.stepInput, styles.stepInputTv, { fontSize: size.value }]}
          >
            {text} {suffix}
          </Text>
        ) : (
          <>
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
            <Text style={[styles.suffix, { fontSize: size.suffix }]}>{suffix}</Text>
          </>
        )}
      </View>
      <TvFocusPressable
        accent={accent}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${suffix}`}
        testID={`${testID}-inc`}
        onHost={tv ? onIncHost : undefined}
        focusLeft={tv ? focus.incLeft : null}
        focusRight={tv ? focus.incRight : null}
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
  preferred = false,
}: {
  label: string;
  seconds: number;
  onChange: (seconds: number) => void;
  testID: string;
  accent: string;
  compact?: boolean;
  /** TV only. Focus starts on this row's minus button. */
  preferred?: boolean;
}) {
  const tv = Platform.isTV === true;
  const { width, height } = useWindowDimensions();
  const scale = tv ? tvScale(width, height) : 1;
  const labelSize = compact ? 20 : 32;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  const [minuteLinks, setMinuteLinks] = useState<StepperLinks>({ dec: null, inc: null });
  const [secondLinks, setSecondLinks] = useState<StepperLinks>({ dec: null, inc: null });
  const rememberMinutes = (links: StepperLinks) => {
    setMinuteLinks((current) => (current.dec === links.dec && current.inc === links.inc ? current : links));
  };
  const rememberSeconds = (links: StepperLinks) => {
    setSecondLinks((current) => (current.dec === links.dec && current.inc === links.inc ? current : links));
  };
  if (tv) {
    const metrics = tvSetupMetrics(width, height);
    return (
      <View style={[styles.tvFieldRow, { gap: metrics.controlGap, minHeight: metrics.button }]}>
        <TvFieldLabel label={label} width={metrics.labelWidth} size={metrics.labelSize} />
        <NumberStepper
          value={minutes}
          min={0}
          max={180}
          suffix="min"
          testID={`${testID}-minutes`}
          accent={accent}
          compact={compact}
          preferred={preferred}
          outsideRight={secondLinks.dec}
          onLinks={rememberMinutes}
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
          outsideLeft={minuteLinks.inc}
          onLinks={rememberSeconds}
          onChange={(next) => onChange(minutes * 60 + next)}
        />
      </View>
    );
  }
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

export function TvCountRow({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
  testID,
  accent,
  preferred = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  suffix: string;
  testID: string;
  accent: string;
  preferred?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const metrics = tvSetupMetrics(width, height);
  return (
    <View style={[styles.tvFieldRow, { gap: metrics.controlGap, minHeight: metrics.button }]}>
      <TvFieldLabel label={label} width={metrics.labelWidth} size={metrics.labelSize} />
      <NumberStepper
        compact
        value={value}
        min={min}
        max={max}
        suffix={suffix}
        testID={testID}
        accent={accent}
        preferred={preferred}
        onChange={onChange}
      />
    </View>
  );
}

export function TvDurationRow({
  label,
  hours,
  minutes,
  seconds,
  onHours,
  onMinutes,
  onSeconds,
  accent,
  preferred = false,
}: {
  label: string;
  hours: number;
  minutes: number;
  seconds: number;
  onHours: (value: number) => void;
  onMinutes: (value: number) => void;
  onSeconds: (value: number) => void;
  accent: string;
  preferred?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const metrics = tvSetupMetrics(width, height);
  const [hourLinks, setHourLinks] = useState<StepperLinks>({ dec: null, inc: null });
  const [minuteLinks, setMinuteLinks] = useState<StepperLinks>({ dec: null, inc: null });
  const [secondLinks, setSecondLinks] = useState<StepperLinks>({ dec: null, inc: null });
  const rememberHours = (links: StepperLinks) => {
    setHourLinks((current) => (current.dec === links.dec && current.inc === links.inc ? current : links));
  };
  const rememberMinutes = (links: StepperLinks) => {
    setMinuteLinks((current) => (current.dec === links.dec && current.inc === links.inc ? current : links));
  };
  const rememberSeconds = (links: StepperLinks) => {
    setSecondLinks((current) => (current.dec === links.dec && current.inc === links.inc ? current : links));
  };
  return (
    <View style={[styles.tvFieldRow, { gap: metrics.controlGap, minHeight: metrics.button }]}>
      <TvFieldLabel label={label} width={metrics.labelWidth} size={metrics.labelSize} />
      <NumberStepper
        compact
        value={hours}
        min={0}
        max={23}
        suffix="hr"
        testID="countdown-hours"
        accent={accent}
        preferred={preferred}
        outsideRight={minuteLinks.dec}
        onLinks={rememberHours}
        onChange={onHours}
      />
      <NumberStepper
        compact
        value={minutes}
        min={0}
        max={59}
        suffix="min"
        testID="countdown-minutes"
        accent={accent}
        outsideLeft={hourLinks.inc}
        outsideRight={secondLinks.dec}
        onLinks={rememberMinutes}
        onChange={onMinutes}
      />
      <NumberStepper
        compact
        value={seconds}
        min={0}
        max={59}
        suffix="sec"
        testID="countdown-seconds"
        accent={accent}
        outsideLeft={minuteLinks.inc}
        onLinks={rememberSeconds}
        onChange={onSeconds}
      />
    </View>
  );
}

function TvFieldLabel({ label, width, size }: { label: string; width: number; size: number }) {
  return (
    <Text
      style={[styles.tvFieldLabel, { width, fontSize: size, lineHeight: size + 4 }]}
      numberOfLines={1}
    >
      {label}
    </Text>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
  testID,
  preferred = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color: string;
  testID?: string;
  /** TV only. Focus starts here when this chip is the first control. */
  preferred?: boolean;
}) {
  const tv = Platform.isTV === true;
  const { width, height } = useWindowDimensions();
  const scale = tv ? tvScale(width, height) : 1;
  const grown = tvSetupScale(height);
  return (
    <TvFocusPressable
      accent={color}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
      hasTVPreferredFocus={tv && preferred ? true : undefined}
      onPress={onPress}
      style={() => [
        styles.chip,
        tv &&
          scaleTvStyle(
            {
              minHeight: Math.round(52 * grown),
              paddingHorizontal: Math.round(16 * grown),
              paddingVertical: Math.round(8 * grown),
              borderWidth: 3,
            },
            scale,
          ),
        {
          borderColor: selected ? color : chrome.line,
          backgroundColor: selected ? `${color}22` : chrome.surface,
        },
      ]}
    >
      <Text style={[styles.chipLabel, { backgroundColor: 'transparent' }, tv && scaleTvStyle({ fontSize: Math.round(22 * grown) }, scale), { color: selected ? chrome.text : chrome.muted }]}>
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
  preferred = false,
}: {
  label: string;
  help?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  testID?: string;
  accent: string;
  disabled?: boolean;
  /** TV only. Focus starts here when the toggle is the first control. */
  preferred?: boolean;
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
      hasTVPreferredFocus={preferred ? true : undefined}
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
  stepperTv: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
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
  stepValueTv: {
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInput: {
    fontFamily: 'Oswald',
    color: chrome.text,
    textAlign: 'center',
    paddingVertical: 0,
  },
  stepInputTv: {
    textTransform: 'lowercase',
  },
  tvFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  tvFieldLabel: {
    color: chrome.muted,
    fontFamily: 'OswaldMedium',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
    fontSize: 28,
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
    minHeight: 65,
    borderRadius: 26,
    borderWidth: 4,
    backgroundColor: chrome.surface,
    paddingHorizontal: 28,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },
  tvToggleCopy: {
    flex: 1,
    gap: 6,
  },
  tvToggleHelp: {
    color: chrome.muted,
    fontSize: 20,
    lineHeight: 26,
  },
  tvToggleValue: {
    fontFamily: 'Oswald',
    fontSize: 28,
    letterSpacing: 0.4,
  },
});
