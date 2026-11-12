import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { hexToHue, hsvToHex, normalizeHex } from '@/src/branding/color';
import { chrome } from '@/src/theme/chrome';
import { focusChrome } from '@/src/tv/controls';
import { tvParallaxProps } from '@/src/tv/pressable';

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
      <View style={styles.head}>
        <View style={[styles.sample, { backgroundColor: value }]} />
        <View style={styles.copy}>
          <Text style={[styles.label, tv && styles.labelTv]}>{label}</Text>
          <TextInput
            testID={`${testID}-hex`}
            value={text}
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={setText}
            onEndEditing={() => commit(text)}
            style={[styles.hex, tv && styles.hexTv]}
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
            {...tvParallaxProps()}
            style={({ focused }) => [
              styles.chip,
              tv && styles.chipTv,
              { backgroundColor: swatch },
              !tv && value.toUpperCase() === swatch ? styles.chipOn : null,
              tv
                ? { borderWidth: 4, borderColor: value.toUpperCase() === swatch ? '#F4F7FB' : 'transparent' }
                : null,
              tv ? focusChrome(true, Boolean(focused), '#F4F7FB', false) : null,
            ]}
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
              {...tvParallaxProps()}
              style={({ focused }) => [
                styles.hue,
                tv && styles.hueTv,
                { backgroundColor: next },
                !tv && Math.abs(hue - item) < 15 ? styles.chipOn : null,
                tv
                  ? { borderWidth: 4, borderColor: Math.abs(hue - item) < 15 ? '#F4F7FB' : 'transparent' }
                  : null,
                tv ? focusChrome(true, Boolean(focused), '#F4F7FB', false) : null,
              ]}
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
              accessibilityLabel={`${label} value ${amount}`}
              onPress={() => commit(next)}
              {...tvParallaxProps()}
              style={({ focused }) => [
                styles.value,
                tv && styles.valueTv,
                { backgroundColor: next },
                tv ? { borderWidth: 4, borderColor: 'transparent' } : null,
                tv ? focusChrome(true, Boolean(focused), '#F4F7FB', false) : null,
              ]}
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
  labelTv: {
    fontSize: 22,
  },
  hex: {
    color: chrome.text,
    fontFamily: 'Oswald',
    fontSize: 22,
    paddingVertical: 0,
  },
  hexTv: {
    fontSize: 36,
    minHeight: 56,
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
  chipTv: {
    width: 78,
    height: 78,
    borderRadius: 16,
  },
  hue: {
    width: 22,
    height: 28,
    borderRadius: 6,
  },
  hueTv: {
    width: 78,
    height: 88,
    borderRadius: 16,
  },
  value: {
    flex: 1,
    height: 22,
    borderRadius: 6,
    minWidth: 36,
  },
  valueTv: {
    height: 72,
    minWidth: 88,
    borderRadius: 16,
  },
  chipOn: {
    borderWidth: 2,
    borderColor: '#F4F7FB',
  },
});
