import { type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View, type TextStyle, type ViewStyle } from 'react-native';

import { TvFocusPressable } from '@/src/components/TvFocus';
import { chrome } from '@/src/theme/chrome';
import { fitTvStyle } from '@/src/tv/layout';
import type { Branding } from '../types';
import { QrMark } from './QrMark';
import type { ReceiverPhase } from './receiverPhase';
import { useLogoReceiver } from './useLogoReceiver';

export function TvLogoTransfer({
  branding,
  update,
  accent,
  children,
}: {
  branding: Branding;
  update: (patch: Partial<Branding>) => Promise<void>;
  accent: string;
  children?: ReactNode;
}) {
  const { phase, restart } = useLogoReceiver(branding, update);
  const { width, height } = useWindowDimensions();
  const ready = phase.kind === 'ready';
  const block = fitTvStyle(styles.block, width, height);
  const row = fitTvStyle(styles.row, width, height);
  const stack = fitTvStyle(styles.stack, width, height);
  const side = fitTvStyle(styles.side, width, height);
  const headline = fitTvStyle(styles.headline, width, height);
  const help = fitTvStyle(styles.help, width, height);
  const saved = fitTvStyle(styles.saved, width, height);
  const url = fitTvStyle(styles.url, width, height);
  const button = fitTvStyle(styles.button, width, height);
  const buttonLabel = fitTvStyle(styles.buttonLabel, width, height);
  return (
    <View style={block} testID="tv-logo-transfer">
      <Text style={headline} testID="tv-brand-note">
        Send a logo from your phone
      </Text>
      {ready ? (
        <View style={row}>
          <QrMark key={phase.url} value={phase.url} />
          <View style={side}>
            {phase.saved ? (
              <Text style={saved} testID="tv-logo-saved">
                Logo saved on this TV.
              </Text>
            ) : null}
            <Text style={help}>{helpText(branding.logoUri)}</Text>
            {children}
          </View>
        </View>
      ) : (
        <View style={stack}>
          <TransferBody phase={phase} accent={accent} restart={restart} help={help} stack={stack} button={button} buttonLabel={buttonLabel} />
          {children}
        </View>
      )}
      {ready ? (
        <Text selectable style={url} testID="tv-logo-pairing-url">
          {phase.url}
        </Text>
      ) : null}
    </View>
  );
}

function helpText(logoUri: string | null): string {
  const base =
    'Scan the code with the phone camera. The phone and this TV need the same Wi-Fi. The photo goes straight to this TV and is not sent to a server.';
  return logoUri ? `${base} A new photo replaces the logo saved here.` : base;
}

function TransferBody({
  phase,
  accent,
  restart,
  help,
  stack,
  button,
  buttonLabel,
}: {
  phase: Exclude<ReceiverPhase, { kind: 'ready' }>;
  accent: string;
  restart: () => void;
  help: TextStyle;
  stack: ViewStyle;
  button: ViewStyle;
  buttonLabel: TextStyle;
}) {
  switch (phase.kind) {
    case 'starting':
      return <Text style={help}>Opening a link on this network…</Text>;
    case 'expired':
      return (
        <View style={stack}>
          <Text style={help}>This link expired. Start a new one to send a logo.</Text>
          <RestartButton accent={accent} label="New code" onPress={restart} button={button} buttonLabel={buttonLabel} />
        </View>
      );
    case 'error':
      return (
        <View style={stack}>
          <Text style={help}>{phase.message}</Text>
          <RestartButton accent={accent} label="Try again" onPress={restart} button={button} buttonLabel={buttonLabel} />
        </View>
      );
    default: {
      const neverPhase: never = phase;
      return neverPhase;
    }
  }
}

function RestartButton({
  accent,
  label,
  onPress,
  button,
  buttonLabel,
}: {
  accent: string;
  label: string;
  onPress: () => void;
  button: ViewStyle;
  buttonLabel: TextStyle;
}) {
  return (
    <TvFocusPressable
      accent={accent}
      accessibilityRole="button"
      hasTVPreferredFocus
      testID="tv-logo-restart"
      onPress={onPress}
      style={({ pressed }) => [button, { borderColor: accent, opacity: pressed ? 0.72 : 1 }]}
    >
      <Text style={buttonLabel}>{label}</Text>
    </TvFocusPressable>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  stack: {
    gap: 8,
  },
  side: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  headline: {
    color: chrome.text,
    fontFamily: 'Oswald',
    fontSize: 28,
    lineHeight: 34,
  },
  help: {
    color: chrome.muted,
    fontSize: 18,
    lineHeight: 24,
  },
  saved: {
    color: chrome.text,
    fontFamily: 'OswaldMedium',
    fontSize: 20,
  },
  url: {
    color: chrome.text,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    alignSelf: 'flex-start',
    minWidth: 280,
    minHeight: 64,
    paddingHorizontal: 28,
    borderRadius: 18,
    borderWidth: 4,
    backgroundColor: chrome.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: chrome.text,
    fontFamily: 'OswaldMedium',
    fontSize: 28,
  },
});
