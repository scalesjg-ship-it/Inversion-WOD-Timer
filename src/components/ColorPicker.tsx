import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { hexToHue, hsvToHex, inkOn, normalizeHex, sameHex } from '@/src/branding/color';
import { TvFocusPressable, TvTextField } from '@/src/components/TvFocus';
import { chrome } from '@/src/theme/chrome';
import { TV_FOCUS_BORDER } from '@/src/tv/controls';

const HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const VALUES = [1, 0.78, 0.55, 0.32];
const SWATCHES = ['#FF4D2E', '#3DDC97', '#F5C451', '#FFB020', '#4C8DFF', '#FF2BD6', '#39FF14', '#E10600', '#1E4DFF', '#F4F7FB', '#07080A', '#FFFFFF'];

export function ColorPicker({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  testID: string;
}) {
  const [text, setText] = useState(value);
  const [tracked, setTracked] = useState(value);
  const [open, setOpen] = useState(false);
  if (value !== tracked) {
    setTracked(value);
    setText(value);
  }
  const hue = hexToHue(value);
  const tv = Platform.isTV === true;

  const commit = (next: string) => {
    const parsed = normalizeHex(next);
    if (!parsed) {
      setText(value);
      return;
    }
    setText(parsed);
    onChange(parsed);
  };

  return (
    <View style={styles.block} testID={testID}>
      <TvFocusPressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}, ${value}. ${open ? 'Close colors' : 'Change color'}`}
        testID={`${testID}-toggle`}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.head, tv && styles.headTv, { opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={[styles.sample, tv && styles.sampleTv, { backgroundColor: value }]} />
        <View style={styles.copy}>
          <Text style={[styles.label, tv && styles.labelTv]}>{label}</Text>
          <Text style={[styles.current, tv && styles.currentTv]}>{value}</Text>
        </View>
        <Text style={[styles.action, tv && styles.actionTv]}>{open ? 'Close' : 'Change'}</Text>
      </TvFocusPressable>
      {open ? (
        <View style={styles.editor}>
          <TvTextField
            testID={`${testID}-hex`}
            value={text}
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={setText}
            onEndEditing={() => commit(text)}
            style={[styles.hex, tv && styles.hexTv]}
          />
          <View style={styles.row}>
            {SWATCHES.map((swatch) => (
              <Swatch
                key={swatch}
                color={swatch}
                selected={sameHex(value, swatch)}
                label={`${label} ${swatch}`}
                testID={`${testID}-swatch-${swatch.slice(1)}`}
                wide={false}
                onPress={() => commit(swatch)}
              />
            ))}
          </View>
          <View style={styles.row}>
            {HUES.map((item) => {
              const next = hsvToHex(item, 1, 1);
              return (
                <Swatch
                  key={item}
                  color={next}
                  selected={sameHex(value, next)}
                  label={`${label} hue ${item}`}
                  testID={`${testID}-hue-${item}`}
                  wide={false}
                  tall
                  onPress={() => commit(next)}
                />
              );
            })}
          </View>
          <View style={styles.row}>
            {VALUES.map((amount) => {
              const next = hsvToHex(hue, 1, amount);
              return (
                <Swatch
                  key={amount}
                  color={next}
                  selected={sameHex(value, next)}
                  label={`${label} value ${amount}`}
                  testID={`${testID}-value-${amount}`}
                  wide
                  onPress={() => commit(next)}
                />
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Swatch({
  color,
  selected,
  label,
  testID,
  wide,
  tall = false,
  onPress,
}: {
  color: string;
  selected: boolean;
  label: string;
  testID: string;
  wide: boolean;
  tall?: boolean;
  onPress: () => void;
}) {
  const tv = Platform.isTV === true;
  const ink = inkOn(color);
  return (
    <TvFocusPressable
      dim={false}
      scale={false}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      onPress={onPress}
      style={() => [
        wide ? styles.value : tall ? styles.hue : styles.chip,
        tv && (wide ? styles.valueTv : tall ? styles.hueTv : styles.chipTv),
        { backgroundColor: color },
        tv ? { borderWidth: TV_FOCUS_BORDER, borderColor: 'transparent' } : null,
      ]}
    >
      {selected ? (
        <View pointerEvents="none" style={styles.selectedMark}>
          <View
            style={[
              styles.selectedRing,
              tv && styles.selectedRingTv,
              { borderColor: ink },
            ]}
          />
          <View style={[styles.selectedDot, tv && styles.selectedDotTv, { backgroundColor: ink }]} />
        </View>
      ) : null}
    </TvFocusPressable>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
    paddingVertical: 4,
  },
  editor: {
    gap: 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: chrome.line,
    backgroundColor: chrome.surface,
    paddingHorizontal: 12,
  },
  headTv: {
    minHeight: 96,
    borderRadius: 20,
    borderWidth: 4,
    paddingHorizontal: 18,
  },
  sample: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: chrome.line,
  },
  sampleTv: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  copy: {
    flex: 1,
  },
  label: {
    color: chrome.muted,
    fontFamily: 'OswaldMedium',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  labelTv: {
    fontSize: 28,
  },
  current: {
    color: chrome.text,
    fontFamily: 'Oswald',
    fontSize: 18,
  },
  currentTv: {
    fontSize: 32,
  },
  action: {
    color: chrome.text,
    fontFamily: 'OswaldMedium',
    fontSize: 16,
  },
  actionTv: {
    fontSize: 28,
  },
  hex: {
    color: chrome.text,
    fontFamily: 'Oswald',
    fontSize: 22,
    paddingVertical: 0,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: chrome.line,
    backgroundColor: chrome.surface,
    paddingHorizontal: 12,
  },
  hexTv: {
    fontSize: 36,
    minHeight: 72,
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipTv: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  hue: {
    width: 32,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hueTv: {
    width: 72,
    height: 84,
    borderRadius: 16,
  },
  value: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueTv: {
    height: 64,
    minWidth: 72,
    borderRadius: 16,
  },
  selectedMark: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    margin: 2,
    borderWidth: 2,
    borderRadius: 6,
  },
  selectedRingTv: {
    margin: 5,
    borderWidth: 4,
    borderRadius: 12,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  selectedDotTv: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
