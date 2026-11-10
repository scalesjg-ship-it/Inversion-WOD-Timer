import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBranding } from '@/src/branding/BrandingProvider';
import { digitColor } from '@/src/branding/color';
import type { Branding } from '@/src/branding/types';
import { CornerLogo, LogoBackdrop } from '@/src/components/LogoBackdrop';
import { BigButton } from '@/src/components/ui';
import { useTimerSession } from '@/src/session/TimerSession';
import { chrome } from '@/src/theme/chrome';
import { formatSnapshot, phaseLabel, roundLabel } from '@/src/timer/labels';
import { useTimer } from '@/src/timer/useTimer';
import type { Phase } from '@/src/timer/types';

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
  const clockSize = Math.round(Math.min(Math.min(width, height) * (landscape ? 0.46 : 0.3), 280));
  const color = phaseInk(timer.snapshot.phase, branding);
  const digits = digitColor(color);

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

  return (
    <View
      style={styles.root}
      testID="screen-timer"
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        setFrame({ width: next.width, height: next.height });
      }}
    >
      <View style={[styles.edge, { backgroundColor: color }]} />
      <LogoBackdrop branding={branding} width={frame.width} height={frame.height} />
      <View pointerEvents="none" style={[styles.wash, { backgroundColor: color }]} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" testID="timer-back" onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>Back</Text>
          </Pressable>
          <Text style={styles.gym} numberOfLines={1} adjustsFontSizeToFit>
            {branding.gymName}
          </Text>
          <CornerLogo branding={branding} />
        </View>
        <View style={[styles.stage, landscape && styles.stageLandscape]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${phaseLabel(timer.snapshot.phase, config.mode)}, ${formatSnapshot(timer.snapshot, config)}`}
            testID="timer-face"
            onPress={onClock}
            style={styles.face}
          >
            <Text style={[styles.phase, { color: digits }]} testID="timer-phase">
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
          </Pressable>
          <View style={[styles.controls, landscape && styles.controlsLandscape]}>
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
        </View>
      </SafeAreaView>
    </View>
  );
}

function phaseInk(phase: Phase, branding: Branding): string {
  switch (phase) {
    case 'work':
      return branding.primaryColor;
    case 'rest':
      return branding.accentColor;
    case 'leadIn':
      return chrome.gold;
    case 'idle':
    case 'finished':
      return chrome.text;
    default: {
      const unused: never = phase;
      return unused;
    }
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: chrome.bg,
  },
  edge: {
    height: 8,
  },
  wash: {
    ...StyleSheet.absoluteFill,
    opacity: 0.14,
  },
  safe: {
    flex: 1,
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
  stage: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  stageLandscape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  face: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  phase: {
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
  controls: {
    gap: 10,
  },
  controlsLandscape: {
    width: 220,
  },
});
