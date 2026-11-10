import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBranding } from '@/src/branding/BrandingProvider';
import { digitColor, normalizeHex } from '@/src/branding/color';
import { prepareLogo } from '@/src/branding/logo';
import { COLOR_SWATCHES, type LogoPlacement } from '@/src/branding/types';
import { CornerLogo, LogoBackdrop } from '@/src/components/LogoBackdrop';
import { Chip } from '@/src/components/ui';
import { chrome } from '@/src/theme/chrome';

const PLACEMENTS: { id: LogoPlacement; label: string }[] = [
  { id: 'watermark', label: 'Watermark' },
  { id: 'fullBleed', label: 'Full bleed' },
  { id: 'corner', label: 'Corner' },
];

export default function BrandScreen() {
  const { branding, update, reset } = useBranding();
  const accent = digitColor(branding.primaryColor);
  const [frame, setFrame] = useState({ width: 0, height: 0 });

  const storeLogo = async (uri: string) => {
    try {
      const logoUri = await prepareLogo(uri);
      await update({ logoUri });
    } catch {
      Alert.alert('Logo', 'That image could not be saved on this device. Try a smaller file.');
    }
  };

  const pickLibrary = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo library', 'Allow photo access to put your gym logo on the timer.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (result.canceled || !result.assets[0]) return;
      await storeLogo(result.assets[0].uri);
    } catch {
      Alert.alert('Photo library', 'The photo picker is not available right now.');
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets[0]) return;
      await storeLogo(result.assets[0].uri);
    } catch {
      Alert.alert('Files', 'That file could not be opened.');
    }
  };

  const confirmReset = () => {
    Alert.alert(
      'Reset to Inversion',
      'Restore CrossFit Inversion colors and name, and remove the logo from this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => void reset() },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView testID="screen-brand" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.wordmark, { color: accent }]}>Americana</Text>
        <Text style={styles.title}>Brand</Text>
        <Text style={styles.lede}>
          Your gym name, colors, and logo stay on this device. The timer reads them on every screen.
        </Text>

        <View
          testID="brand-preview"
          style={styles.preview}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setFrame({ width, height });
          }}
        >
          <LogoBackdrop branding={branding} width={frame.width} height={frame.height} />
          <View style={styles.previewTop}>
            <Text style={styles.previewGym} numberOfLines={1}>
              {branding.gymName}
            </Text>
            <CornerLogo branding={branding} size={42} />
          </View>
          <Text style={[styles.previewClock, { color: accent }]}>05:00</Text>
          <Text style={[styles.previewPhase, { color: accent }]}>Work</Text>
        </View>

        <Text style={styles.fieldLabel}>Gym name</Text>
        <GymNameField
          value={branding.gymName}
          onCommit={(gymName) => void update({ gymName })}
        />

        <Text style={styles.fieldLabel}>Colors</Text>
        <View style={styles.chips}>
          {COLOR_SWATCHES.map((swatch) => (
            <Chip
              key={swatch.name}
              label={swatch.name}
              color={swatch.primary}
              selected={
                branding.primaryColor.toUpperCase() === swatch.primary &&
                branding.accentColor.toUpperCase() === swatch.accent
              }
              onPress={() => void update({ primaryColor: swatch.primary, accentColor: swatch.accent })}
              testID={`swatch-${swatch.name.toLowerCase()}`}
            />
          ))}
        </View>
        <HexField
          label="Work"
          testID="brand-primary"
          value={branding.primaryColor}
          onCommit={(primaryColor) => void update({ primaryColor })}
        />
        <HexField
          label="Rest"
          testID="brand-accent"
          value={branding.accentColor}
          onCommit={(accentColor) => void update({ accentColor })}
        />

        <Text style={styles.fieldLabel}>Logo</Text>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" testID="pick-logo" onPress={() => void pickLibrary()} style={styles.secondary}>
            <Text style={styles.secondaryLabel}>Photo library</Text>
          </Pressable>
          <Pressable accessibilityRole="button" testID="pick-file" onPress={() => void pickFile()} style={styles.secondary}>
            <Text style={styles.secondaryLabel}>Files</Text>
          </Pressable>
        </View>
        {branding.logoUri ? (
          <Pressable accessibilityRole="button" testID="remove-logo" onPress={() => void update({ logoUri: null })}>
            <Text style={[styles.link, { color: accent }]}>Remove logo</Text>
          </Pressable>
        ) : (
          <Text style={styles.help}>No logo yet. The default look is CrossFit Inversion colors without a mark.</Text>
        )}
        <View style={styles.chips}>
          {PLACEMENTS.map((placement) => (
            <Chip
              key={placement.id}
              label={placement.label}
              color={accent}
              selected={branding.logoPlacement === placement.id}
              onPress={() => void update({ logoPlacement: placement.id })}
              testID={`placement-${placement.id}`}
            />
          ))}
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Blur the full-bleed logo</Text>
          <Switch
            testID="logo-blur"
            value={branding.logoBlur}
            onValueChange={(logoBlur) => void update({ logoBlur })}
            disabled={branding.logoPlacement !== 'fullBleed'}
            trackColor={{ false: '#2A3140', true: accent }}
            thumbColor={chrome.text}
          />
        </View>
        <Text style={styles.help}>
          Watermark sits faded behind the digits. Full bleed is darkened so the clock stays readable. Corner keeps the mark out of the numbers.
        </Text>

        <Pressable accessibilityRole="button" testID="reset-brand" onPress={confirmReset} style={styles.reset}>
          <Text style={styles.resetLabel}>Reset to Inversion</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function GymNameField({ value, onCommit }: { value: string; onCommit: (name: string) => void }) {
  const [text, setText] = useState(value);
  const [tracked, setTracked] = useState(value);
  if (value !== tracked) {
    setTracked(value);
    setText(value);
  }

  return (
    <TextInput
      testID="brand-name"
      value={text}
      onChangeText={setText}
      onEndEditing={() => {
        const next = text.trim().slice(0, 48);
        if (!next) {
          setText(value);
          return;
        }
        onCommit(next);
      }}
      style={styles.input}
      maxLength={48}
    />
  );
}

function HexField({
  label,
  value,
  onCommit,
  testID,
}: {
  label: string;
  value: string;
  onCommit: (hex: string) => void;
  testID: string;
}) {
  const [text, setText] = useState(value);
  const [tracked, setTracked] = useState(value);
  if (value !== tracked) {
    setTracked(value);
    setText(value);
  }

  return (
    <View style={styles.hexRow}>
      <View style={[styles.swatch, { backgroundColor: value }]} />
      <View style={styles.hexCopy}>
        <Text style={styles.hexLabel}>{label}</Text>
        <TextInput
          testID={testID}
          value={text}
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={setText}
          onEndEditing={() => {
            const next = normalizeHex(text);
            if (!next) {
              setText(value);
              return;
            }
            onCommit(next);
          }}
          style={styles.hexInput}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: chrome.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
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
    marginTop: -4,
  },
  preview: {
    height: 230,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: chrome.bg,
    borderWidth: 1,
    borderColor: chrome.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTop: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewGym: {
    color: chrome.text,
    fontFamily: 'OswaldMedium',
    fontSize: 16,
    flex: 1,
  },
  previewClock: {
    fontFamily: 'Oswald',
    fontSize: 84,
    lineHeight: 90,
  },
  previewPhase: {
    fontFamily: 'OswaldMedium',
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontSize: 16,
  },
  fieldLabel: {
    marginTop: 8,
    color: chrome.muted,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: 'OswaldMedium',
  },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: chrome.line,
    backgroundColor: chrome.surface,
    color: chrome.text,
    paddingHorizontal: 14,
    fontSize: 18,
    fontFamily: 'Oswald',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hexRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  swatch: {
    width: 42,
    height: 42,
    borderRadius: 12,
  },
  hexCopy: {
    flex: 1,
  },
  hexLabel: {
    color: chrome.muted,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: 'OswaldMedium',
  },
  hexInput: {
    color: chrome.text,
    fontFamily: 'Oswald',
    fontSize: 22,
    paddingVertical: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  secondary: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: chrome.line,
    backgroundColor: chrome.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: chrome.text,
    fontFamily: 'OswaldMedium',
    fontSize: 16,
  },
  link: {
    fontFamily: 'OswaldMedium',
    fontSize: 16,
  },
  help: {
    color: chrome.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchLabel: {
    color: chrome.text,
    flex: 1,
  },
  reset: {
    marginTop: 8,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetLabel: {
    color: '#FF8A7A',
    fontFamily: 'Oswald',
    fontSize: 20,
  },
});
