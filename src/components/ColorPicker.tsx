import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { hexToHue, hsvToHex, normalizeHex } from '@/src/branding/color';
import { chrome } from '@/src/theme/chrome';

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
  if (value !== tracked) {
    setTracked(value);
    setText(value);
  }
  const hue = hexToHue(value);

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
      <View style={styles.head}>
        <View style={[styles.sample, { backgroundColor: value }]} />
        <View style={styles.copy}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            testID={`${testID}-hex`}
            value={text}
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={setText}
            onEndEditing={() => commit(text)}
            style={styles.hex}
          />
        </View>
      </View>
      <View style={styles.row}>
        {SWATCHES.map((swatch) => (
          <Pressable
            key={swatch}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${swatch}`}
            testID={`${testID}-swatch-${swatch.slice(1)}`}
            onPress={() => commit(swatch)}
            style={[styles.chip, { backgroundColor: swatch }, value.toUpperCase() === swatch ? styles.chipOn : null]}
          />
        ))}
      </View>
      <View style={styles.row}>
        {HUES.map((item) => {
          const next = hsvToHex(item, 1, 1);
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityLabel={`${label} hue ${item}`}
              testID={`${testID}-hue-${item}`}
              onPress={() => commit(next)}
              style={[styles.hue, { backgroundColor: next }, Math.abs(hue - item) < 15 ? styles.chipOn : null]}
            />
          );
        })}
      </View>
      <View style={styles.row}>
        {VALUES.map((amount) => {
          const next = hsvToHex(hue, 1, amount);
          return (
            <Pressable
              key={amount}
              accessibilityRole="button"
              onPress={() => commit(next)}
              style={[styles.value, { backgroundColor: next }]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
    paddingVertical: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sample: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: chrome.line,
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
  hex: {
    color: chrome.text,
    fontFamily: 'Oswald',
    fontSize: 22,
    paddingVertical: 0,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  hue: {
    width: 22,
    height: 28,
    borderRadius: 6,
  },
  value: {
    flex: 1,
    height: 22,
    borderRadius: 6,
    minWidth: 36,
  },
  chipOn: {
    borderWidth: 2,
    borderColor: '#F4F7FB',
  },
});
