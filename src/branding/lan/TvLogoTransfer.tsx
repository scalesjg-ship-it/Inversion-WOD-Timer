import { StyleSheet, Text, View } from 'react-native';

import { TvFocusPressable } from '@/src/components/TvFocus';
import { chrome } from '@/src/theme/chrome';
import type { Branding } from '../types';
import { QrMark } from './QrMark';
import type { ReceiverPhase } from './receiverPhase';
import { useLogoReceiver } from './useLogoReceiver';

export function TvLogoTransfer({
  branding,
  update,
  accent,
}: {
  branding: Branding;
  update: (patch: Partial<Branding>) => Promise<void>;
  accent: string;
}) {
  const { phase, restart } = useLogoReceiver(branding, update);
  return (
    <View style={styles.block} testID="tv-logo-transfer">
      <Text style={styles.headline} testID="tv-brand-note">
        Send a logo from your phone
      </Text>
      <TransferBody phase={phase} accent={accent} restart={restart} />
      <Text style={styles.help}>
        The phone and this TV need the same Wi-Fi. The photo goes straight to this TV and is not sent to a server.
        {branding.logoUri ? ' A new photo replaces the logo saved here.' : ''}
      </Text>
    </View>
  );
}

function TransferBody({
  phase,
  accent,
  restart,
}: {
  phase: ReceiverPhase;
  accent: string;
  restart: () => void;
}) {
  switch (phase.kind) {
    case 'starting':
      return <Text style={styles.help}>Opening a link on this network…</Text>;
    case 'ready':
      return (
        <View style={styles.ready}>
          <QrMark value={phase.url} />
          {phase.saved ? (
            <Text style={styles.saved} testID="tv-logo-saved">
              Logo saved on this TV.
            </Text>
          ) : null}
          <Text selectable style={styles.url}>
            {phase.url}
          </Text>
        </View>
      );
    case 'expired':
      return (
        <View style={styles.ready}>
          <Text style={styles.help}>This link expired. Start a new one to send a logo.</Text>
          <RestartButton accent={accent} label="New code" onPress={restart} />
        </View>
      );
    case 'error':
      return (
        <View style={styles.ready}>
          <Text style={styles.help}>{phase.message}</Text>
          <RestartButton accent={accent} label="Try again" onPress={restart} />
        </View>
      );
    default: {
      const neverPhase: never = phase;
      return neverPhase;
    }
  }
}

function RestartButton({ accent, label, onPress }: { accent: string; label: string; onPress: () => void }) {
  return (
    <TvFocusPressable
      accent={accent}
      accessibilityRole="button"
      hasTVPreferredFocus
      testID="tv-logo-restart"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { borderColor: accent, opacity: pressed ? 0.72 : 1 }]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </TvFocusPressable>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 12,
    marginTop: 4,
  },
  ready: {
    gap: 12,
  },
  headline: {
    color: chrome.text,
    fontFamily: 'Oswald',
    fontSize: 36,
    lineHeight: 42,
  },
  help: {
    color: chrome.muted,
    fontSize: 28,
    lineHeight: 36,
  },
  saved: {
    color: chrome.text,
    fontFamily: 'OswaldMedium',
    fontSize: 18,
    textAlign: 'center',
  },
  url: {
    color: chrome.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    alignSelf: 'center',
    minWidth: 280,
    minHeight: 88,
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
    fontSize: 32,
  },
});
