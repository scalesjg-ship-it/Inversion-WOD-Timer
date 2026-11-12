import { useState } from 'react';
import {
  Alert,
  Platform,
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
import { readableDigitColor } from '@/src/branding/color';
import { TvLogoTransfer } from '@/src/branding/lan/TvLogoTransfer';
import { prepareLogo } from '@/src/branding/logo';
import { THEME_PRESETS, type BrandColors, type LogoPlacement, type ThemePreset } from '@/src/branding/types';
import { ColorPicker } from '@/src/components/ColorPicker';
import { CornerLogo, LogoBackdrop } from '@/src/components/LogoBackdrop';
import { Chip, TvToggle } from '@/src/components/ui';
import { chrome } from '@/src/theme/chrome';
import { TV_BODY_FONT, TV_SECTION_FONT, TV_TITLE_FONT, tvSafeBox } from '@/src/tv/layout';
import { focusChrome } from '@/src/tv/controls';
import { tvParallaxProps } from '@/src/tv/pressable';

const PLACEMENTS: { id: LogoPlacement; label: string }[] = [
  { id: 'watermark', label: 'Watermark' },
  { id: 'fullBleed', label: 'Full bleed' },
  { id: 'corner', label: 'Corner' },
];

export default function BrandScreen() {
  const { branding, update, reset } = useBranding();
  const accent = readableDigitColor(branding.uiColor, branding.backgroundColor);
  const digits = readableDigitColor(branding.digitColor, branding.backgroundColor);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const tv = Platform.isTV === true;
  const box = tvSafeBox(tv);
  const labelStyle = [styles.fieldLabel, tv && styles.fieldLabelTv];

  const storeLogo = async (uri: string) => {
    try {
      const logoUri = await prepareLogo(uri);
      await update({ logoUri });
    } catch {
      Alert.alert('Logo', 'That image could not be saved on this device. Try a smaller file.');
    }
  };

  // The pickers have no tvOS native module and throw when imported there,
  // so they load only when a phone opens them. TV gets its logo over Wi-Fi.
  const pickLibrary = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
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
      const DocumentPicker = await import('expo-document-picker');
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
    <SafeAreaView style={[styles.safe, tv && { paddingHorizontal: box.horizontal, paddingTop: box.vertical }]} edges={tv ? [] : ['top']}>
      <ScrollView
        testID="screen-brand"
        style={tv ? styles.scrollTv : undefined}
        contentContainerStyle={[styles.content, tv && styles.contentTv]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.wordmark, { color: accent }, tv && styles.wordmarkTv]}>Americana</Text>
        <Text style={[styles.title, tv && styles.titleTv]}>Brand</Text>
        <Text style={[styles.lede, tv && styles.ledeTv]}>
          Your gym name, colors, and logo stay on this device. The timer reads them on every screen.
        </Text>

        {Platform.isTV ? <TvLogoTransfer branding={branding} update={update} accent={accent} /> : null}

        <View
          testID="brand-preview"
          style={[styles.preview, tv && styles.previewTv, { backgroundColor: branding.backgroundColor }]}
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
          <Text style={[styles.previewClock, tv && styles.previewClockTv, { color: digits }]}>05:00</Text>
          <Text style={[styles.previewPhase, { color: readableDigitColor(branding.workColor, branding.backgroundColor) }]}>Work</Text>
        </View>

        <Text style={labelStyle}>Gym name</Text>
        <GymNameField
          value={branding.gymName}
          onCommit={(gymName) => void update({ gymName })}
        />

        <Text style={labelStyle}>Themes</Text>
        <View style={styles.chips}>
          {THEME_PRESETS.map((theme) => (
            <Chip
              key={theme.id}
              label={theme.name}
              color={theme.uiColor}
              selected={themeMatches(branding, theme)}
              onPress={() => void update(colorsOf(theme))}
              testID={`theme-${theme.id}`}
            />
          ))}
        </View>
        <ColorPicker label="Work" testID="color-work" value={branding.workColor} onChange={(workColor) => void update({ workColor })} />
        <ColorPicker label="Rest" testID="color-rest" value={branding.restColor} onChange={(restColor) => void update({ restColor })} />
        <ColorPicker label="Lead-in" testID="color-lead" value={branding.leadInColor} onChange={(leadInColor) => void update({ leadInColor })} />
        <ColorPicker label="Warning" testID="color-warning" value={branding.warningColor} onChange={(warningColor) => void update({ warningColor })} />
        <ColorPicker label="Digits" testID="color-digits" value={branding.digitColor} onChange={(digitColor) => void update({ digitColor })} />
        <ColorPicker label="Background" testID="color-background" value={branding.backgroundColor} onChange={(backgroundColor) => void update({ backgroundColor })} />
        <ColorPicker label="Accent" testID="color-ui" value={branding.uiColor} onChange={(uiColor) => void update({ uiColor })} />

        <Text style={labelStyle}>Logo</Text>
        {Platform.isTV ? null : (
          <View style={styles.row}>
            <Pressable accessibilityRole="button" testID="pick-logo" onPress={() => void pickLibrary()} style={styles.secondary}>
              <Text style={styles.secondaryLabel}>Photo library</Text>
            </Pressable>
            <Pressable accessibilityRole="button" testID="pick-file" onPress={() => void pickFile()} style={styles.secondary}>
              <Text style={styles.secondaryLabel}>Files</Text>
            </Pressable>
          </View>
        )}
        {branding.logoUri ? (
          <Pressable
            accessibilityRole="button"
            testID="remove-logo"
            onPress={() => void update({ logoUri: null })}
            {...tvParallaxProps()}
            style={({ pressed, focused }) => [
              tv && styles.linkHitTv,
              tv && pressed ? { opacity: 0.75 } : null,
              tv ? focusChrome(true, Boolean(focused), accent) : null,
            ]}
          >
            <Text style={[styles.link, tv && styles.linkTv, { color: accent }]}>Remove logo</Text>
          </Pressable>
        ) : Platform.isTV ? (
          <Text style={[styles.help, styles.helpTv]}>The logo is saved on this TV after the phone sends it.</Text>
        ) : (
          <Text style={styles.help}>Any gym logo works. Pick it from your photo library or Files. It stays on this device.</Text>
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
        {tv ? (
          <TvToggle
            label="Blur the full-bleed logo"
            value={branding.logoBlur}
            onValueChange={(logoBlur) => void update({ logoBlur })}
            disabled={branding.logoPlacement !== 'fullBleed'}
            testID="logo-blur"
            accent={accent}
          />
        ) : (
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
        )}
        <Text style={styles.help}>
          Watermark sits faded behind the digits. Full bleed is darkened so the clock stays readable. Corner keeps the mark out of the numbers.
        </Text>

        <Pressable
          accessibilityRole="button"
          testID="reset-brand"
          onPress={confirmReset}
          {...tvParallaxProps()}
          style={({ pressed, focused }) => [
            styles.reset,
            tv && styles.resetTv,
            tv && pressed ? { opacity: 0.75 } : null,
            tv ? focusChrome(true, Boolean(focused), '#FF8A7A', false) : null,
          ]}
        >
          <Text style={[styles.resetLabel, tv && styles.resetLabelTv]}>Reset to Inversion</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function colorsOf(theme: ThemePreset): BrandColors {
  return {
    workColor: theme.workColor,
    restColor: theme.restColor,
    leadInColor: theme.leadInColor,
    warningColor: theme.warningColor,
    digitColor: theme.digitColor,
    backgroundColor: theme.backgroundColor,
    uiColor: theme.uiColor,
  };
}

function themeMatches(branding: BrandColors, theme: ThemePreset): boolean {
  const colors = colorsOf(theme);
  return (Object.keys(colors) as (keyof BrandColors)[]).every((key) => branding[key].toUpperCase() === colors[key].toUpperCase());
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
      style={[styles.input, Platform.isTV && styles.inputTv]}
      maxLength={48}
    />
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: chrome.bg,
  },
  scrollTv: {
    flex: 1,
    width: '100%',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  contentTv: {
    width: '100%',
    flexGrow: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
    gap: 28,
    paddingBottom: 48,
  },
  wordmarkTv: {
    fontSize: 32,
  },
  titleTv: {
    fontSize: TV_TITLE_FONT,
    lineHeight: TV_TITLE_FONT + 8,
  },
  ledeTv: {
    fontSize: TV_BODY_FONT,
    lineHeight: TV_BODY_FONT + 8,
  },
  previewTv: {
    height: 420,
    borderRadius: 28,
  },
  previewClockTv: {
    fontSize: 180,
    lineHeight: 200,
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
  fieldLabelTv: {
    fontSize: TV_SECTION_FONT,
    letterSpacing: 2,
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
  inputTv: {
    minHeight: 84,
    fontSize: 36,
    borderRadius: 18,
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
  linkTv: {
    fontSize: 32,
  },
  linkHitTv: {
    alignSelf: 'flex-start',
    minHeight: 76,
    paddingHorizontal: 16,
    borderRadius: 16,
    justifyContent: 'center',
  },
  help: {
    color: chrome.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  helpTv: {
    fontSize: TV_BODY_FONT,
    lineHeight: TV_BODY_FONT + 8,
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
  resetTv: {
    minHeight: 88,
  },
  resetLabel: {
    color: '#FF8A7A',
    fontFamily: 'Oswald',
    fontSize: 20,
  },
  resetLabelTv: {
    fontSize: 36,
  },
});
