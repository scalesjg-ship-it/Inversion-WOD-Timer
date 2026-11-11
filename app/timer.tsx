import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor, screenColors } from '@/src/branding/color';
import type { Branding } from '@/src/branding/types';
import { CornerLogo, LogoBackdrop } from '@/src/components/LogoBackdrop';
import { BigButton } from '@/src/components/ui';
import { useTimerSession } from '@/src/session/TimerSession';
import { chrome } from '@/src/theme/chrome';
import { formatSnapshot, phaseLabel, roundLabel } from '@/src/timer/labels';
import { useTimer } from '@/src/timer/useTimer';
import type { Phase } from '@/src/timer/types';
import { clockFontSize, isTenFootLayout, tvSafeInset } from '@/src/tv/layout';
import type { RemoteCommand } from '@/src/tv/remoteMap';
import { useRemoteCommands } from '@/src/tv/useRemoteCommands';

const KEEP_AWAKE = 'americana-timer';

export default function TimerScreen() {
  const { session } = useTimerSession();
  const { branding } = useBranding();
  const [config] = useState(session.config);
  const [label] = useState(session.label);
  const timer = useTimer(config, { autoStart: true, gymName: branding.gymName });
  const { width, height } = useWindowDimensions();
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const landscape = width > height;
  const tenFoot = isTenFootLayout(width, height, Platform.isTV === true);
  const clockSize = clockFontSize(width, height, tenFoot);
  const safeInset = tvSafeInset(tenFoot);
  const [controlsHeld, setControlsHeld] = useState(false);
  const controlsVisible = tenFoot ? controlsHeld : true;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const palette = screenColors(branding);
  const phaseColor = phaseInk(timer.snapshot.phase, branding, timer.snapshot.warningActive);
  const digits = palette.digits;

  useEffect(() => {
    if (!timer.snapshot.running) return undefined;
    void activateKeepAwakeAsync(KEEP_AWAKE).catch(() => undefined);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE).catch(() => undefined);
    };
  }, [timer.snapshot.running]);

  const onClock = () => {
    if (timer.snapshot.running || timer.snapshot.paused) timer.toggle();
  };

  const onRemote = useCallback((command: RemoteCommand) => {
    switch (command.type) {
      case 'toggle':
        timer.toggle();
        break;
      case 'confirmReset':
        setConfirmOpen(true);
        setControlsHeld(true);
        break;
      case 'dismissConfirm':
        setConfirmOpen(false);
        break;
      case 'seek':
        timer.seekTimer(command.seconds);
        break;
      case 'stepRound':
        timer.stepRoundTimer(command.direction);
        break;
      case 'showControls':
        setControlsHeld(true);
        break;
      case 'hideControls':
        setControlsHeld(false);
        setConfirmOpen(false);
        break;
      case 'exit':
        router.navigate('/');
        break;
      case 'ignore':
        break;
      default: {
        const exhaustive: never = command;
        return exhaustive;
      }
    }
  }, [timer]);

  useRemoteCommands(
    { mode: config.mode, controlsVisible, confirmOpen },
    onRemote,
  );

  const phaseText = readableDigitColor(phaseColor, branding.backgroundColor);

  return (
    <View
      style={[styles.root, { backgroundColor: branding.backgroundColor }]}
      testID="screen-timer"
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        setFrame({ width: next.width, height: next.height });
      }}
    >
      <View style={[styles.edge, { backgroundColor: phaseColor }]} />
      <LogoBackdrop branding={branding} width={frame.width} height={frame.height} />
      <View pointerEvents="none" style={[styles.wash, { backgroundColor: phaseColor }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${phaseLabel(timer.snapshot.phase, config.mode)}, ${formatSnapshot(timer.snapshot, config)}`}
        testID="timer-face"
        onPress={onClock}
        style={styles.face}
        focusable={false}
      >
        <View style={styles.clockAnchor}>
          <Text style={[styles.phase, { color: phaseText }]} testID="timer-phase">
            {phaseLabel(timer.snapshot.phase, config.mode)}
          </Text>
          <Text
            style={[styles.clock, { color: digits, fontSize: clockSize, lineHeight: Math.round(clockSize * 1.02) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            testID="timer-clock"
          >
            {formatSnapshot(timer.snapshot, config)}
          </Text>
          <View pointerEvents="none" style={styles.meta}>
            <Text style={styles.round} testID="timer-round">
              {roundLabel(timer.snapshot, config)}
            </Text>
            <Text style={styles.label}>{label}</Text>
            {timer.snapshot.warningActive ? (
              <Text style={styles.warning} testID="timer-warning">
                Last {config.warningSeconds} seconds
              </Text>
            ) : null}
            {timer.snapshot.paused ? (
              <Text style={styles.paused} testID="timer-paused">
                Paused · tap to resume
              </Text>
            ) : null}
            {timer.snapshot.running ? <Text style={styles.hint}>Tap the clock to pause</Text> : null}
          </View>
        </View>
      </Pressable>
      <SafeAreaView pointerEvents="box-none" style={[styles.overlay, { padding: safeInset }]} edges={['top', 'bottom']}>
        <View style={styles.top} pointerEvents="box-none">
          <Pressable accessibilityRole="button" testID="timer-back" onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>Back</Text>
          </Pressable>
          <Text style={styles.gym} numberOfLines={1} adjustsFontSizeToFit>
            {branding.gymName}
          </Text>
          <CornerLogo branding={branding} />
        </View>
        {confirmOpen ? (
          <View style={styles.confirm} testID="reset-confirm">
            <Text style={styles.confirmTitle}>Reset this timer?</Text>
            <BigButton label="Reset" color={digits} onPress={() => { timer.resetTimer(); setConfirmOpen(false); }} testID="confirm-reset" />
            <BigButton label="Cancel" color={digits} variant="ghost" onPress={() => setConfirmOpen(false)} testID="confirm-cancel" />
          </View>
        ) : null}
        {controlsVisible ? (
        <View pointerEvents="box-none" style={landscape ? styles.controlsLandscape : styles.controls}>
          {timer.snapshot.phase === 'idle' || timer.snapshot.phase === 'finished' ? (
            <BigButton
              label={timer.snapshot.phase === 'finished' ? 'Go again' : 'Start'}
              color={digits}
              onPress={timer.startTimer}
              testID="timer-start"
            />
          ) : null}
          {timer.snapshot.running && config.mode === 'forTime' && timer.snapshot.phase === 'work' ? (
            <BigButton label="Stop" color={digits} variant="ghost" onPress={timer.completeTimer} testID="timer-stop" />
          ) : null}
          {timer.snapshot.phase !== 'idle' ? (
            <BigButton label="Reset" color={digits} variant="ghost" onPress={timer.resetTimer} testID="timer-reset" />
          ) : null}
        </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

function phaseInk(phase: Phase, branding: Branding, warningActive: boolean): string {
  if (warningActive && (phase === 'work' || phase === 'leadIn')) return branding.warningColor;
  switch (phase) {
    case 'work':
      return branding.workColor;
    case 'rest':
      return branding.restColor;
    case 'leadIn':
      return branding.leadInColor;
    case 'idle':
    case 'finished':
      return branding.digitColor;
    default: {
      const unused: never = phase;
      return unused;
    }
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#07080A',
  },
  edge: {
    height: 8,
  },
  wash: {
    ...StyleSheet.absoluteFill,
    opacity: 0.14,
  },
  face: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockAnchor: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 6,
    minHeight: 56,
  },
  back: {
    color: chrome.text,
    fontFamily: 'OswaldMedium',
    fontSize: 18,
  },
  gym: {
    flex: 1,
    textAlign: 'center',
    color: chrome.text,
    fontFamily: 'OswaldMedium',
    fontSize: 18,
    letterSpacing: 0.4,
  },
  phase: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 8,
    width: 520,
    marginLeft: -260,
    left: '50%',
    textAlign: 'center',
    fontFamily: 'OswaldMedium',
    fontSize: 22,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  clock: {
    fontFamily: 'Oswald',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 18,
  },
  meta: {
    position: 'absolute',
    top: '100%',
    marginTop: 8,
    width: 520,
    marginLeft: -260,
    left: '50%',
    alignItems: 'center',
  },
  round: {
    color: chrome.text,
    fontFamily: 'Oswald',
    fontSize: 28,
    letterSpacing: 0.6,
  },
  label: {
    color: chrome.muted,
    fontFamily: 'OswaldMedium',
    fontSize: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  warning: {
    marginTop: 8,
    color: chrome.gold,
    fontFamily: 'Oswald',
    fontSize: 28,
    letterSpacing: 1,
  },
  paused: {
    marginTop: 8,
    color: chrome.gold,
    fontFamily: 'Oswald',
    fontSize: 26,
    letterSpacing: 1,
  },
  hint: {
    color: chrome.muted,
    marginTop: 4,
    fontSize: 14,
  },
  confirm: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '32%',
    alignSelf: 'center',
    width: 420,
    marginHorizontal: 'auto',
    gap: 12,
    padding: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(7,8,10,0.92)',
    borderWidth: 2,
    borderColor: 'rgba(244,247,251,0.3)',
  },
  confirmTitle: {
    color: chrome.text,
    fontFamily: 'Oswald',
    fontSize: 36,
    textAlign: 'center',
    marginBottom: 8,
  },
  controls: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 8,
    gap: 10,
  },
  controlsLandscape: {
    position: 'absolute',
    right: 18,
    bottom: 12,
    width: 220,
    gap: 10,
  },
});
