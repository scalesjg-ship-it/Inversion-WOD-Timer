import { useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { downloadLogo } from '@/src/branding/downloadLogo';
import { prepareLogo } from '@/src/branding/logo';
import { parseLogoUrl } from '@/src/branding/logoUrl';
import { TvFocusPressable, TvTextField } from '@/src/components/TvFocus';
import type { TvFocusTag } from '@/src/components/TvTabFocus';
import { chrome } from '@/src/theme/chrome';
import { fitTvStyle } from '@/src/tv/layout';

export interface TvLogoFocus {
  up?: TvFocusTag | null;
  down?: TvFocusTag | null;
  left?: TvFocusTag | null;
  right?: TvFocusTag | null;
  onFocus?: () => void;
}

export function TvLogoUrl({
  onStored,
  field,
  save,
}: {
  onStored: (uri: string) => Promise<void>;
  field?: TvLogoFocus & { onHost?: (node: ComponentRef<typeof TextInput> | null) => void };
  save?: TvLogoFocus & { onHost?: (node: ComponentRef<typeof Pressable> | null) => void };
}) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const { width, height } = useWindowDimensions();
  const block = fitTvStyle(styles.block, width, height);
  const row = fitTvStyle(styles.row, width, height);
  const label = fitTvStyle(styles.label, width, height);
  const help = fitTvStyle(styles.help, width, height);
  const input = fitTvStyle(styles.input, width, height);
  const button = fitTvStyle(styles.button, width, height);
  const buttonLabel = fitTvStyle(styles.buttonLabel, width, height);
  const statusStyle = fitTvStyle(styles.status, width, height);

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
    <View style={block} testID="tv-logo-url">
      <Text style={label}>Logo link</Text>
      <Text style={help} numberOfLines={2}>
        Paste an https image address. It is downloaded and kept on this TV.
      </Text>
      <View style={row}>
        <TvTextField
          testID="logo-url"
          value={text}
          onChangeText={setText}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://"
          placeholderTextColor={chrome.muted}
          style={input}
          focusUp={field?.up ?? null}
          focusDown={field?.down ?? null}
          focusLeft={field?.left ?? null}
          focusRight={field?.right ?? null}
          onHost={field?.onHost}
          onFocus={field?.onFocus}
        />
        <TvFocusPressable
          accessibilityRole="button"
          accessibilityLabel="Save logo"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          testID="logo-url-load"
          focusUp={save?.up ?? null}
          focusDown={save?.down ?? null}
          focusLeft={save?.left ?? null}
          focusRight={save?.right ?? null}
          onHost={save?.onHost}
          onFocus={save?.onFocus}
          onPress={() => void load()}
          style={({ pressed }) => [button, { opacity: busy ? 0.5 : pressed ? 0.8 : 1 }]}
        >
          <Text style={buttonLabel}>{busy ? 'Saving…' : 'Save'}</Text>
        </TvFocusPressable>
      </View>
      {status ? (
        <Text style={statusStyle} testID="logo-url-status">
          {status}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: chrome.muted,
    fontFamily: 'OswaldMedium',
    fontSize: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  help: {
    color: chrome.muted,
    fontSize: 16,
    lineHeight: 20,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: chrome.line,
    backgroundColor: chrome.surface,
    color: chrome.text,
    paddingHorizontal: 12,
    fontSize: 18,
    fontFamily: 'Oswald',
  },
  button: {
    flexShrink: 0,
    minHeight: 48,
    minWidth: 112,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 4,
    borderColor: chrome.line,
    backgroundColor: chrome.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: chrome.text,
    fontFamily: 'OswaldMedium',
    fontSize: 22,
  },
  status: {
    color: chrome.text,
    fontSize: 16,
    lineHeight: 20,
  },
});
