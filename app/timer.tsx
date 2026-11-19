import { Image } from 'expo-image';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, TVEventControl, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBranding } from '@/src/branding/BrandingProvider';
import { phaseLabelInk, readableDigitColor, screenColors } from '@/src/branding/color';
import { clockEdgeHeight, clockFontFamily } from '@/src/branding/palettes';
import type { Branding } from '@/src/branding/types';
import { CornerLogo, LogoBackdrop } from '@/src/components/LogoBackdrop';
import { TvFocusPressable } from '@/src/components/TvFocus';
import { BigButton } from '@/src/components/ui';
import { useTimerSession } from '@/src/session/TimerSession';
import { chrome } from '@/src/theme/chrome';
import { formatSnapshot, phaseLabel, roundLabel } from '@/src/timer/labels';
import { useTimer } from '@/src/timer/useTimer';
import type { Phase } from '@/src/timer/types';
import { clockStatusHint } from '@/src/tv/copy';
import { fitClock, isTenFootLayout, scaleTvStyle, tvClockChrome, tvSafeBox, tvSafeInset, tvScale } from '@/src/tv/layout';
import { claimPress, type PressClaim } from '@/src/tv/pressClaim';
import type { RemoteCommand } from '@/src/tv/remoteMap';
import {
  backStep,
  transportNeighbor,
  tvTransportButtons,
  type TransportRole,
} from '@/src/tv/timerTransport';
import { useRemoteCommands } from '@/src/tv/useRemoteCommands';
import { useTvFocusTag } from '@/src/tv/useTvFocusTag';

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
  const tv = Platform.isTV === true;
  const tenFoot = isTenFootLayout(width, height, tv);
  const overscan = tvSafeInset(tenFoot);
  const box = tvSafeBox(tv, width, height);
  const typeScale = tv ? tvScale(width, height) : 1;
  const safe = tv
    ? {
        top: Math.max(insets.top, box.vertical),
        right: Math.max(insets.right, box.horizontal),
        bottom: Math.max(insets.bottom, box.vertical),
        left: Math.max(insets.left, box.horizontal),
      }
    : {
        top: Math.max(insets.top, overscan),
        right: Math.max(insets.right, overscan),
        bottom: Math.max(insets.bottom, overscan),
        left: Math.max(insets.left, overscan),
      };
  const [faceBox, setFaceBox] = useState({ width: 0, height: 0 });
  const [controlsHeld, setControlsHeld] = useState(false);
  const controlsVisible = tv ? true : tenFoot ? controlsHeld : true;
  const [confirmKind, setConfirmKind] = useState<null | 'reset'>(null);
  const [preferPrimary, setPreferPrimary] = useState(true);
  const [preferDialog, setPreferDialog] = useState(false);
  const [backTag, onBackHost] = useTvFocusTag();
  const [primaryTag, onPrimaryHost] = useTvFocusTag();
  const [stopTag, onStopHost] = useTvFocusTag();
  const [resetTag, onResetHost] = useTvFocusTag();
  const [confirmResetTag, onConfirmResetHost] = useTvFocusTag();
  const [confirmCancelTag, onConfirmCancelHost] = useTvFocusTag();
  const confirmKindRef = useRef(confirmKind);
  const pressClaim = useRef<PressClaim | null>(null);
  const leaveArmed = useRef(false);
  const palette = screenColors(branding);
  const phaseColor = phaseInk(timer.snapshot.phase, branding, timer.snapshot.warningActive);
  const digits = palette.digits;
  const clockText = formatSnapshot(timer.snapshot, config);
  const side = Math.max(safe.left, safe.right, 16);
  const clockChrome = tvClockChrome(height, Boolean(branding.logoUri));
  const brandHeight = tv ? clockChrome.logo + (clockChrome.logo > 0 ? 8 : 0) + clockChrome.name + 16 : 0;
  const headerBlock = tv ? safe.top + brandHeight : 0;
  const faceReady = tv && faceBox.height > 0 && faceBox.width > 0;
  const clock = fitClock({
    text: clockText,
    screenWidth: faceReady ? faceBox.width : width,
    screenHeight: faceReady ? faceBox.height : height,
    tenFoot,
    fillFrame: tv,
    horizontalInset: side * 2,
    verticalInset: tv
      ? faceReady
        ? clockChrome.phase + 16 + 150
        : headerBlock + safe.bottom + clockChrome.phase + 170
      : safe.top + safe.bottom + 58 + 36 + 96 + (landscape ? 16 : 80),
  });
  const labelGap = tv ? 8 : 10 - Math.round(clock.fontSize * 0.22);

  useEffect(() => {
    if (!timer.snapshot.running) return undefined;
    void activateKeepAwakeAsync(KEEP_AWAKE).catch(() => undefined);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE).catch(() => undefined);
    };
  }, [timer.snapshot.running]);

  // Preferred focus has to stay through the first focus pass or Back takes it.
  // onFocus clears it once Pause/Resume actually has focus. The timeout covers a
  // press that sets the flag while that button is already focused, so a later
  // clock tick does not pull the remote back.
  useEffect(() => {
    if (!preferPrimary) return undefined;
    const id = setTimeout(() => setPreferPrimary(false), 600);
    return () => clearTimeout(id);
  }, [preferPrimary]);

  useEffect(() => {
    if (!preferDialog) return undefined;
    const id = requestAnimationFrame(() => setPreferDialog(false));
    return () => cancelAnimationFrame(id);
  }, [preferDialog]);

  const onClock = () => {
    if (tv) return;
    if (timer.snapshot.running || timer.snapshot.paused) timer.toggle();
  };

  const closeConfirm = () => {
    confirmKindRef.current = null;
    setConfirmKind(null);
    setPreferDialog(false);
    setPreferPrimary(true);
  };

  const claim = (kind: 'select' | 'menu') => {
    const next = claimPress(kind, Date.now(), pressClaim.current);
    pressClaim.current = next.claim;
    return next.accept;
  };

  const pauseOnResume = () => {
    timer.pauseTimer();
    setPreferPrimary(true);
  };

  const exitTimer = () => {
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  };

  const onTvBackRef = useRef(() => {});
  const decideBackRef = useRef(() => {});
  useEffect(() => {
    decideBackRef.current = () => {
      const snap = timer.readSnapshot();
      const step = backStep({
        running: snap.running,
        paused: snap.paused,
        confirming: confirmKindRef.current !== null,
        leaveArmed: leaveArmed.current,
      });
      console.log(
        `TV_BACK step=${step} running=${snap.running} paused=${snap.paused} phase=${snap.phase} armed=${leaveArmed.current}`,
      );
      switch (step) {
        case 'dismiss':
          closeConfirm();
          return;
        case 'pause':
          pauseOnResume();
          leaveArmed.current = true;
          return;
        case 'stay':
          setPreferPrimary(true);
          leaveArmed.current = true;
          return;
        case 'exit':
          exitTimer();
          return;
        default: {
          const unexpected: never = step;
          return unexpected;
        }
      }
    };
    onTvBackRef.current = () => {
      if (!claim('menu')) return;
      decideBackRef.current();
    };
  });

  useFocusEffect(
    useCallback(() => {
      if (!tv) return undefined;
      // Without this, tvOS still pops the stack on Menu after JavaScript pauses.
      TVEventControl.enableTVMenuKey();
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        onTvBackRef.current();
        return true;
      });
      return () => {
        subscription.remove();
        TVEventControl.disableTVMenuKey();
      };
    }, [tv]),
  );

  const onRemote = (command: RemoteCommand) => {
    switch (command.type) {
      case 'toggle':
        leaveArmed.current = false;
        timer.toggle();
        break;
      case 'confirmReset':
        setPreferPrimary(false);
        setPreferDialog(true);
        confirmKindRef.current = 'reset';
        setConfirmKind('reset');
        setControlsHeld(true);
        break;
      case 'dismissConfirm':
        closeConfirm();
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
        closeConfirm();
        break;
      case 'pause': {
        if (!claim('select')) break;
        const snap = timer.readSnapshot();
        if (!snap.running) break;
        pauseOnResume();
        leaveArmed.current = false;
        break;
      }
      case 'menu':
        onTvBackRef.current();
        break;
      case 'exit':
        if (tv) onTvBackRef.current();
        else router.navigate('/');
        break;
      case 'ignore':
        break;
      default: {
        const exhaustive: never = command;
        return exhaustive;
      }
    }
  };

  useRemoteCommands(
    {
      mode: config.mode,
      controlsVisible,
      confirmOpen: confirmKind !== null,
      stableControls: tv,
      running: tv && timer.snapshot.running,
    },
    onRemote,
  );

  const transport = tvTransportButtons({
    phase: timer.snapshot.phase,
    running: timer.snapshot.running,
    paused: timer.snapshot.paused,
    mode: config.mode,
  });
  const transportRoles = transport.map((button) => button.role);

  const tagFor = (role: TransportRole) => {
    switch (role) {
      case 'primary':
        return primaryTag;
      case 'stop':
        return stopTag;
      case 'reset':
        return resetTag;
      default: {
        const unexpected: never = role;
        return unexpected;
      }
    }
  };

  const hostFor = (role: TransportRole) => {
    switch (role) {
      case 'primary':
        return onPrimaryHost;
      case 'stop':
        return onStopHost;
      case 'reset':
        return onResetHost;
      default: {
        const unexpected: never = role;
        return unexpected;
      }
    }
  };

  const pressTransport = (role: TransportRole) => {
    if (!claim('select')) return;
    const snap = timer.readSnapshot();
    if (snap.running) {
      pauseOnResume();
      leaveArmed.current = false;
      return;
    }
    leaveArmed.current = false;
    switch (role) {
      case 'primary':
        if (snap.phase === 'idle' || snap.phase === 'finished') timer.startTimer();
        else timer.toggle();
        return;
      case 'stop':
        timer.completeTimer();
        return;
      case 'reset':
        timer.resetTimer();
        closeConfirm();
        return;
      default: {
        const unexpected: never = role;
        return unexpected;
      }
    }
  };

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
      <View style={[styles.edge, { height: clockEdgeHeight(branding.backgroundStyle), backgroundColor: phaseColor }]} />
      {!tv || branding.logoPlacement === 'fullBleed' ? (
        <LogoBackdrop branding={branding} width={frame.width} height={frame.height} insets={safe} />
      ) : null}
      {branding.backgroundStyle === 'vignette' ? <View pointerEvents="none" style={styles.vignette} /> : null}
      <View pointerEvents="none" style={[styles.wash, { backgroundColor: phaseColor }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${phaseLabel(timer.snapshot.phase, config.mode)}, ${clockText}${timer.snapshot.paused ? ', Paused' : ''}`}
        testID="timer-face"
        onPress={onClock}
        focusable={false}
        onLayout={
          tv
            ? (event) => {
                const next = event.nativeEvent.layout;
                setFaceBox((current) =>
                  current.width === next.width && current.height === next.height ? current : { width: next.width, height: next.height },
                );
              }
            : undefined
        }
        style={[styles.face, tv && { top: headerBlock, bottom: safe.bottom }]}
      >
        <View style={styles.clockBlock}>
          <Text
            style={[
              tv ? styles.phaseFlow : styles.phase,
              tv
                ? {
                    fontSize: clockChrome.phase,
                    lineHeight: clockChrome.phase + 8,
                    width: clock.width,
                  }
                : null,
              { color: phaseText, marginBottom: labelGap },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit={!tv}
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
                fontFamily: clockFontFamily(branding.clockWeight),
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
          <View pointerEvents="none" style={[tv ? styles.metaFlow : styles.meta, { marginTop: labelGap }]}>
            <Text style={[styles.round, tv && scaleTvStyle(roundTv, typeScale), { color: palette.text }]} testID="timer-round">
              {roundLabel(timer.snapshot, config)}
            </Text>
            <Text style={[styles.label, tv && scaleTvStyle(labelTv, typeScale), { color: palette.muted }]}>{label}</Text>
            {timer.snapshot.warningActive ? (
              <Text style={[styles.warning, { color: attention }]} testID="timer-warning">
                Last {config.warningSeconds} seconds
              </Text>
            ) : null}
            {timer.snapshot.paused ? (
              <Text style={[styles.paused, { color: attention }]} testID="timer-paused">
                {tv && controlsVisible ? 'Paused' : clockStatusHint(tv, 'paused')}
              </Text>
            ) : null}
            {timer.snapshot.running && !(tv && controlsVisible) ? (
              <Text style={[styles.hint, tv && scaleTvStyle(hintTv, typeScale), { color: palette.muted }]} testID="timer-hint">
                {clockStatusHint(tv, 'running')}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
      <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: safe.top }]}>
        {tv ? (
          <View
            collapsable={false}
            pointerEvents={confirmKind === null ? 'box-none' : 'none'}
            style={[
              styles.controlsTv,
              {
                bottom: safe.bottom + 8,
                right: Math.max(18, safe.right),
                left: Math.max(18, safe.left),
              },
            ]}
          >
            {transport.map((button) => (
              <BigButton
                key={button.role}
                label={button.label}
                color={digits}
                variant={button.variant}
                testID={button.testID}
                onPress={() => pressTransport(button.role)}
                onHost={hostFor(button.role)}
                focusable={confirmKind === null}
                hasTVPreferredFocus={preferPrimary && confirmKind === null && button.role === 'primary'}
                onFocus={button.role === 'primary' ? () => setPreferPrimary(false) : undefined}
                focusLeft={tagFor(transportNeighbor(transportRoles, button.role, -1))}
                focusRight={tagFor(transportNeighbor(transportRoles, button.role, 1))}
                focusUp={backTag}
              />
            ))}
          </View>
        ) : null}
        <View style={[styles.top, tv ? { height: brandHeight } : null]} pointerEvents="box-none">
          {tv ? (
            <View pointerEvents="none" style={styles.tvBrand}>
              {branding.logoUri ? (
                <Image
                  source={{ uri: branding.logoUri }}
                  contentFit="contain"
                  accessible={false}
                  testID="timer-logo"
                  style={{ width: clockChrome.logo, height: clockChrome.logo }}
                />
              ) : null}
              <Text
                style={[
                  styles.tvGym,
                  {
                    color: palette.text,
                    fontSize: clockChrome.name,
                    lineHeight: clockChrome.name + 6,
                    fontFamily: clockFontFamily(branding.clockWeight),
                  },
                ]}
                numberOfLines={1}
                testID="timer-gym"
              >
                {branding.gymName}
              </Text>
            </View>
          ) : (
            <Text
              style={[styles.gym, { color: palette.text, paddingHorizontal: headerSlot }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.45}
              pointerEvents="none"
            >
              {branding.gymName}
            </Text>
          )}
          <TvFocusPressable
            accent={palette.text}
            accessibilityRole="button"
            testID="timer-back"
            onPress={() => {
              if (!tv) {
                router.back();
                return;
              }
              // Menu also activates this button. Share the menu claim with the
              // remote event so one press cannot pause and then leave.
              onTvBackRef.current();
            }}
            hitSlop={tv ? undefined : 12}
            onHost={tv ? onBackHost : undefined}
            focusDown={tv && confirmKind === null ? primaryTag : null}
            focusLeft={tv ? backTag : null}
            focusRight={tv ? backTag : null}
            focusable={tv && confirmKind !== null ? false : undefined}
            style={({ pressed }) => [
              styles.backButton,
              { left: Math.max(18, safe.left) },
              tv && styles.backButtonTv,
              tv && pressed ? { opacity: 0.75 } : null,
            ]}
          >
            <Text style={[styles.back, tv && scaleTvStyle(backTv, typeScale), { color: palette.text }]}>Back</Text>
          </TvFocusPressable>
          {tv ? null : (
            <View style={[styles.cornerSlot, { right: Math.max(18, safe.right) }]}>
              <CornerLogo branding={branding} />
            </View>
          )}
        </View>
        {confirmKind === 'reset' ? (
          <View style={[styles.confirm, tv ? styles.confirmTv : null]} testID="reset-confirm">
            <Text style={styles.confirmTitle}>Reset this timer?</Text>
            <BigButton
              label="Reset"
              color={digits}
              onPress={() => {
                timer.resetTimer();
                closeConfirm();
              }}
              testID="confirm-reset"
              onHost={tv ? onConfirmResetHost : undefined}
              focusDown={tv ? confirmCancelTag : null}
              focusUp={tv ? confirmResetTag : null}
              focusable={tv ? true : undefined}
            />
            <BigButton
              label="Cancel"
              color={digits}
              variant="ghost"
              onPress={closeConfirm}
              testID="confirm-cancel"
              hasTVPreferredFocus={tv ? preferDialog : undefined}
              onFocus={tv ? () => setPreferDialog(false) : undefined}
              onHost={tv ? onConfirmCancelHost : undefined}
              focusUp={tv ? confirmResetTag : null}
              focusDown={tv ? confirmCancelTag : null}
              focusable={tv ? true : undefined}
            />
          </View>
        ) : null}
        {!tv && controlsVisible ? (
        <View
          pointerEvents="box-none"
          style={[
            landscape ? styles.controlsLandscape : styles.controls,
            {
              bottom: safe.bottom + 8,
              right: Math.max(18, safe.right),
              left: !landscape ? Math.max(18, safe.left) : undefined,
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

const roundTv = { fontSize: 52, lineHeight: 64 };
const labelTv = { fontSize: 32, lineHeight: 40 };
const hintTv = { fontSize: 26, lineHeight: 34 };
const backTv = { fontSize: 40 };

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
  vignette: {
    ...StyleSheet.absoluteFill,
    borderWidth: 72,
    borderColor: 'rgba(0,0,0,0.55)',
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
  topTv: {
    height: 96,
  },
  backButton: {
    position: 'absolute',
    left: 18,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  backButtonTv: {
    minHeight: 76,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  back: {
    fontFamily: 'OswaldMedium',
    fontSize: 18,
  },
  backTv: {
    fontSize: 40,
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
  tvBrand: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  tvGym: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontFamily: 'Oswald',
  },
  phaseFlow: {
    alignSelf: 'center',
    textAlign: 'center',
    fontFamily: 'OswaldMedium',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  metaFlow: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  phaseTv: {
    fontSize: 48,
    lineHeight: 60,
    letterSpacing: 6,
  },
  roundTv: {
    fontSize: 52,
    lineHeight: 64,
  },
  labelTv: {
    fontSize: 32,
    lineHeight: 40,
  },
  hintTv: {
    fontSize: 26,
    lineHeight: 34,
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
  confirmTv: {
    zIndex: 2,
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
  controlsTv: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  controlsLandscape: {
    position: 'absolute',
    right: 18,
    bottom: 12,
    width: 220,
    gap: 10,
  },
});
