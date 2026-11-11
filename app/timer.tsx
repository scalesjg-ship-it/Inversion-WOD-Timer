import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBranding } from '@/src/branding/BrandingProvider';
import { phaseLabelInk, readableDigitColor, screenColors } from '@/src/branding/color';
import type { Branding } from '@/src/branding/types';
import { CornerLogo, LogoBackdrop } from '@/src/components/LogoBackdrop';
import { BigButton } from '@/src/components/ui';
import { useTimerSession } from '@/src/session/TimerSession';
import { chrome } from '@/src/theme/chrome';
import { formatSnapshot, phaseLabel, roundLabel } from '@/src/timer/labels';
import { useTimer } from '@/src/timer/useTimer';
import type { Phase } from '@/src/timer/types';
import { fitClock, isTenFootLayout, tvSafeInset } from '@/src/tv/layout';
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
  const insets = useSafeAreaInsets();
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const landscape = width > height;
  const tenFoot = isTenFootLayout(width, height, Platform.isTV === true);
  const overscan = tvSafeInset(tenFoot);
  const safe = {
    top: Math.max(insets.top, overscan),
    right: Math.max(insets.right, overscan),
    bottom: Math.max(insets.bottom, overscan),
    left: Math.max(insets.left, overscan),
  };
  const [controlsHeld, setControlsHeld] = useState(false);
  const controlsVisible = tenFoot ? controlsHeld : true;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const palette = screenColors(branding);
  const phaseColor = phaseInk(timer.snapshot.phase, branding, timer.snapshot.warningActive);
  const digits = palette.digits;
  const clockText = formatSnapshot(timer.snapshot, config);
  const side = Math.max(safe.left, safe.right, 16);
  const clock = fitClock({
    text: clockText,
    screenWidth: width,
    screenHeight: height,
    tenFoot,
    horizontalInset: side * 2,
    verticalInset:
      safe.top +
      safe.bottom +
      58 +
      36 +
      96 +
      (landscape ? 16 : 80),
  });
  const labelGap = 10 - Math.round(clock.fontSize * 0.22);

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
  }, [timer, setConfirmOpen, setControlsHeld]);

  useRemoteCommands(
    { mode: config.mode, controlsVisible, confirmOpen },
    onRemote,
  );

  const phaseText = phaseLabelInk(phaseColor, branding.digitColor, branding.backgroundColor);
  const attention = readableDigitColor(chrome.gold, branding.backgroundColor);
  const cornerVisible = Boolean(branding.logoUri) && branding.logoPlacement === 'corner';
  const headerSlot = Math.max(cornerVisible ? 108 : 76, safe.left + 64, safe.right + (cornerVisible ? 96 : 64));

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
      <LogoBackdrop branding={branding} width={frame.width} height={frame.height} insets={safe} />
      <View pointerEvents="none" style={[styles.wash, { backgroundColor: phaseColor }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${phaseLabel(timer.snapshot.phase, config.mode)}, ${clockText}`}
        testID="timer-face"
        onPress={onClock}
        style={styles.face}
        focusable={false}
      >
        <View style={styles.clockBlock}>
          <Text
            style={[styles.phase, { color: phaseText, marginBottom: labelGap }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            testID="timer-phase"
          >
            {phaseLabel(timer.snapshot.phase, config.mode)}
          </Text>
          <Text
            style={[
              styles.clock,
              {
                color: digits,
                fontSize: clock.fontSize,
                lineHeight: clock.lineHeight,
                width: clock.width,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.35}
            testID="timer-clock"
          >
            {clockText}
          </Text>
          <View pointerEvents="none" style={[styles.meta, { marginTop: labelGap }]}>
            <Text style={[styles.round, { color: palette.text }]} testID="timer-round">
              {roundLabel(timer.snapshot, config)}
            </Text>
            <Text style={[styles.label, { color: palette.muted }]}>{label}</Text>
            {timer.snapshot.warningActive ? (
              <Text style={[styles.warning, { color: attention }]} testID="timer-warning">
                Last {config.warningSeconds} seconds
              </Text>
            ) : null}
            {timer.snapshot.paused ? (
              <Text style={[styles.paused, { color: attention }]} testID="timer-paused">
                Paused · tap to resume
              </Text>
            ) : null}
            {timer.snapshot.running ? (
              <Text style={[styles.hint, { color: palette.muted }]}>Tap the clock to pause</Text>
            ) : null}
          </View>
        </View>
      </Pressable>
      <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: safe.top }]}>
        <View style={styles.top} pointerEvents="box-none">
          <Text
            style={[styles.gym, { color: palette.text, paddingHorizontal: headerSlot }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.45}
            pointerEvents="none"
          >
            {branding.gymName}
          </Text>
          <Pressable
            accessibilityRole="button"
            testID="timer-back"
            onPress={() => router.back()}
            hitSlop={12}
            style={[styles.backButton, { left: Math.max(18, safe.left) }]}
          >
            <Text style={[styles.back, { color: palette.text }]}>Back</Text>
          </Pressable>
          <View style={[styles.cornerSlot, { right: Math.max(18, safe.right) }]}>
            <CornerLogo branding={branding} />
          </View>
        </View>
        {confirmOpen ? (
          <View style={styles.confirm} testID="reset-confirm">
            <Text style={styles.confirmTitle}>Reset this timer?</Text>
            <BigButton label="Reset" color={digits} onPress={() => { timer.resetTimer(); setConfirmOpen(false); }} testID="confirm-reset" />
            <BigButton label="Cancel" color={digits} variant="ghost" onPress={() => setConfirmOpen(false)} testID="confirm-cancel" />
          </View>
        ) : null}
        {controlsVisible ? (
        <View
          pointerEvents="box-none"
          style={[
            landscape ? styles.controlsLandscape : styles.controls,
            {
              bottom: safe.bottom + 8,
              right: Math.max(18, safe.right),
              left: landscape ? undefined : Math.max(18, safe.left),
            },
          ]}
        >
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
      </View>
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
  clockBlock: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  top: {
    height: 64,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 18,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  back: {
    fontFamily: 'OswaldMedium',
    fontSize: 18,
  },
  cornerSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  gym: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    paddingHorizontal: 108,
    fontFamily: 'OswaldMedium',
    fontSize: 18,
    letterSpacing: 0.4,
  },
  phase: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    textAlign: 'center',
    fontFamily: 'OswaldMedium',
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  clock: {
    textAlign: 'center',
    fontFamily: 'Oswald',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    backgroundColor: 'transparent',
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  meta: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  round: {
    textAlign: 'center',
    alignSelf: 'stretch',
    fontFamily: 'Oswald',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: 0.6,
  },
  label: {
    textAlign: 'center',
    alignSelf: 'stretch',
    fontFamily: 'OswaldMedium',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  warning: {
    marginTop: 8,
    textAlign: 'center',
    alignSelf: 'stretch',
    fontFamily: 'Oswald',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: 1,
  },
  paused: {
    marginTop: 8,
    textAlign: 'center',
    alignSelf: 'stretch',
    fontFamily: 'Oswald',
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: 1,
  },
  hint: {
    marginTop: 4,
    textAlign: 'center',
    alignSelf: 'stretch',
    fontSize: 14,
    lineHeight: 20,
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
