import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { downloadLogo } from '@/src/branding/downloadLogo';
import { prepareLogo } from '@/src/branding/logo';
import { parseLogoUrl } from '@/src/branding/logoUrl';
import { TvFocusPressable, TvTextField } from '@/src/components/TvFocus';
import { chrome } from '@/src/theme/chrome';
import { TV_BODY_FONT } from '@/src/tv/layout';

export function TvLogoUrl({ onStored }: { onStored: (uri: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!parseLogoUrl(text)) {
      setStatus('Enter a full https link to an image.');
      return;
    }
    setBusy(true);
    setStatus('Downloading…');
    try {
      const local = await downloadLogo(text);
      const stored = await prepareLogo(local);
      await onStored(stored);
      setStatus('Logo saved on this TV.');
    } catch {
      setStatus('That link could not be saved. Use a direct https image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.block} testID="tv-logo-url">
      <Text style={styles.label}>Logo link</Text>
      <Text style={styles.help}>Paste an https image address. It is downloaded and kept on this TV.</Text>
      <TvTextField
        testID="logo-url"
        value={text}
        onChangeText={setText}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="https://"
        placeholderTextColor={chrome.muted}
        style={styles.input}
      />
      <TvFocusPressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        testID="logo-url-load"
        onPress={() => void load()}
        style={({ pressed }) => [styles.button, { opacity: busy ? 0.5 : pressed ? 0.8 : 1 }]}
      >
        <Text style={styles.buttonLabel}>{busy ? 'Saving…' : 'Save logo'}</Text>
      </TvFocusPressable>
      {status ? (
        <Text style={styles.status} testID="logo-url-status">
          {status}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 12,
  },
  label: {
    color: chrome.muted,
    fontFamily: 'OswaldMedium',
    fontSize: 32,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  help: {
    color: chrome.muted,
    fontSize: TV_BODY_FONT,
    lineHeight: TV_BODY_FONT + 8,
  },
  input: {
    minHeight: 84,
    borderRadius: 18,
    borderWidth: 4,
    borderColor: chrome.line,
    backgroundColor: chrome.surface,
    color: chrome.text,
    paddingHorizontal: 18,
    fontSize: 32,
    fontFamily: 'Oswald',
  },
  button: {
    alignSelf: 'flex-start',
    minHeight: 88,
    minWidth: 280,
    paddingHorizontal: 28,
    borderRadius: 18,
    borderWidth: 4,
    borderColor: chrome.line,
    backgroundColor: chrome.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: chrome.text,
    fontFamily: 'OswaldMedium',
    fontSize: 32,
  },
  status: {
    color: chrome.text,
    fontSize: TV_BODY_FONT,
    lineHeight: TV_BODY_FONT + 8,
  },
});
