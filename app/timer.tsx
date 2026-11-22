import { Image } from 'expo-image';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect, usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, TVEventControl, TVFocusGuideView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBranding } from '@/src/branding/BrandingProvider';
import { phaseLabelInk, readableDigitColor, screenColors } from '@/src/branding/color';
import { clockEdgeHeight, clockFontFamily } from '@/src/branding/palettes';
import type { Branding } from '@/src/branding/types';
import { CornerLogo, LogoBackdrop } from '@/src/components/LogoBackdrop';
import { TvFocusPressable } from '@/src/components/TvFocus';
import { BigButton } from '@/src/components/ui';
import { usePreferences } from '@/src/preferences/PreferencesProvider';
import { useTimerSession } from '@/src/session/TimerSession';
import { chrome } from '@/src/theme/chrome';
import { formatSnapshot, phaseLabel, roundLabel } from '@/src/timer/labels';
import { useTimer } from '@/src/timer/useTimer';
import type { Phase } from '@/src/timer/types';
import { clockStatusHint } from '@/src/tv/copy';
import { fitClock, isTenFootLayout, scaleTvStyle, tvClockChrome, tvSafeBox, tvSafeInset, tvScale } from '@/src/tv/layout';
import { tvAppleTimerFrame } from '@/src/tv/timerFrame';
import { DUPLICATE_PRESS_MS, claimPress, type PressClaim } from '@/src/tv/pressClaim';
import type { RemoteCommand } from '@/src/tv/remoteMap';
import {
  RESET_CONFIRM,
  backStep,
  focusAfterResetPrompt,
  onScreenBackFocusable,
  onScreenBackPress,
  showsOnScreenBack,
  transportNeighbor,
  transportPress,
  tvTransportButtons,
  type TransportRole,
} from '@/src/tv/timerTransport';
import { useRemoteCommands } from '@/src/tv/useRemoteCommands';
import { useTvFocusTag } from '@/src/tv/useTvFocusTag';
import { watchLinkEnabled } from '@/src/watch/gate';
import { watchLinkTone } from '@/src/watch/linkStatus';
import { useWatchLink } from '@/src/watch/useWatchLink';

const KEEP_AWAKE = 'americana-timer';
const FocusGuide = TVFocusGuideView ?? View;

export default function TimerScreen() {
  const { session } = useTimerSession();
  const { branding } = useBranding();
  const { preferences } = usePreferences();
  const [config] = useState(session.config);
  const [label] = useState(session.label);
  const timer = useTimer(config, {
    autoStart: true,
    gymName: branding.gymName,
    voiceCountdown: preferences.voiceCountdown,
  });
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const landscape = width > height;
  const tv = Platform.isTV === true;
  const showBack = showsOnScreenBack(tv, Platform.OS);
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
  const [preferReset, setPreferReset] = useState(false);
  const [preferDialog, setPreferDialog] = useState(false);
  const [backTag, onBackHost] = useTvFocusTag();
  const [primaryTag, onPrimaryHost] = useTvFocusTag();
  const [primaryNode, setPrimaryNode] = useState<ComponentRef<typeof Pressable> | null>(null);
  const [stopTag, onStopHost] = useTvFocusTag();
  const [resetTag, onResetHost] = useTvFocusTag();
  const [watchTag, onWatchHost] = useTvFocusTag();
  const appleTv = watchLinkEnabled({ os: Platform.OS, tv });
  const [confirmResetTag, onConfirmResetHost] = useTvFocusTag();
  const [confirmCancelTag, onConfirmCancelHost] = useTvFocusTag();
  const confirmKindRef = useRef(confirmKind);
  const pressClaim = useRef<PressClaim | null>(null);
  const leaveArmed = useRef(false);
  const pendingExit = useRef(false);
  const handleMenuRef = useRef<(finish?: () => void) => void>(() => {});
  const palette = screenColors(branding);
  const phaseColor = phaseInk(timer.snapshot.phase, branding, timer.snapshot.warningActive);
  const digits = palette.digits;
  const clockText = formatSnapshot(timer.snapshot, config);
  const side = Math.max(safe.left, safe.right, 16);
  const clockChrome = tvClockChrome(height, Boolean(branding.logoUri));
  const brandHeight = tv ? clockChrome.logo + (clockChrome.logo > 0 ? 8 : 0) + clockChrome.name + 16 : 0;
  const headerBlock = tv ? safe.top + brandHeight : 0;
  const faceReady = tv && faceBox.height > 0 && faceBox.width > 0;

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
    if (!preferReset) return undefined;
    const id = setTimeout(() => setPreferReset(false), 600);
    return () => clearTimeout(id);
  }, [preferReset]);

  useEffect(() => {
    if (!preferDialog) return undefined;
    const id = requestAnimationFrame(() => setPreferDialog(false));
    return () => cancelAnimationFrame(id);
  }, [preferDialog]);

  const onClock = () => {
    if (tv || confirmKindRef.current) return;
    if (timer.snapshot.running || timer.snapshot.paused) timer.toggle();
  };

  const clearConfirm = () => {
    confirmKindRef.current = null;
    setConfirmKind(null);
    setPreferDialog(false);
  };

  /** No and Back. The clock was not paused by the question, so it stays as it was. */
  const declineReset = () => {
    clearConfirm();
    setPreferPrimary(false);
    setPreferReset(focusAfterResetPrompt() === 'reset');
  };

  const acceptReset = () => {
    timer.resetTimer();
    clearConfirm();
    setPreferReset(false);
    setPreferPrimary(true);
  };

  const askReset = () => {
    setPreferPrimary(false);
    setPreferReset(false);
    setPreferDialog(true);
    confirmKindRef.current = 'reset';
    setConfirmKind('reset');
    setControlsHeld(true);
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
  useEffect(() => {
    handleMenuRef.current = (finish) => {
      const accepted = claim('menu');
      if (!accepted) {
        if (pendingExit.current && finish) {
          pendingExit.current = false;
          finish();
        }
        return;
      }
      const snap = timer.readSnapshot();
      const step = backStep({
        running: snap.running,
        paused: snap.paused,
        confirming: confirmKindRef.current !== null,
        leaveArmed: leaveArmed.current,
      });
      switch (step) {
        case 'dismiss':
          declineReset();
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
          if (finish) finish();
          else {
            pendingExit.current = true;
            exitTimer();
          }
          return;
        default: {
          const unexpected: never = step;
          return unexpected;
        }
      }
    };
    onTvBackRef.current = () => {
      handleMenuRef.current();
    };
  });

  usePreventRemove(tv, ({ repeat }) => {
    handleMenuRef.current(repeat);
  });

  useFocusEffect(
    useCallback(() => {
      if (!tv) return undefined;
      // Without this, tvOS still pops the stack on Menu after JavaScript pauses.
      TVEventControl?.enableTVMenuKey();
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        onTvBackRef.current();
        return true;
      });
      return () => {
        subscription.remove();
        TVEventControl?.disableTVMenuKey();
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
        askReset();
        break;
      case 'dismissConfirm':
        declineReset();
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
        clearConfirm();
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

  // Wrist commands call the same start, pause, resume, and reset functions as
  // Select. leaveArmed stays clear, so hardware Back still follows backStep.
  const {
    presentPicker,
    message: watchMessage,
    phase: watchPhase,
    watchControlVisible,
  } = useWatchLink({
    enabled: appleTv,
    snapshot: timer.snapshot,
    config,
    onAction: (action) => {
      if (action === 'ignore') return;
      leaveArmed.current = false;
      if (action === 'reset') {
        // The watch has no Yes or No. It resets the TV clock directly.
        acceptReset();
        return;
      }
      if (confirmKindRef.current) clearConfirm();
      switch (action) {
        case 'start':
          timer.startTimer();
          return;
        case 'pause':
          pauseOnResume();
          return;
        case 'resume':
          timer.toggle();
          setPreferPrimary(true);
          return;
        default: {
          const unexpected: never = action;
          return unexpected;
        }
      }
    },
  });

  const transport = tvTransportButtons({
    phase: timer.snapshot.phase,
    running: timer.snapshot.running,
    paused: timer.snapshot.paused,
    mode: config.mode,
  });
  const transportRoles = transport.map((button) => button.role);
  const showWatch = appleTv && watchControlVisible;
  const appleFrame = appleTv
    ? tvAppleTimerFrame({
        screenWidth: width,
        screenHeight: height,
        safeBottom: safe.bottom,
        safeHorizontal: Math.max(safe.left, safe.right),
        buttonCount: transport.length + (showWatch ? 1 : 0),
        linkStatus: Boolean(watchMessage),
        warning: timer.snapshot.warningActive,
        paused: timer.snapshot.paused,
      })
    : null;
  const metaReserve = appleFrame ? appleFrame.metaBlock : 150;
  const clock = fitClock({
    text: clockText,
    screenWidth: faceReady ? faceBox.width : width,
    screenHeight: faceReady ? faceBox.height : height,
    tenFoot,
    fillFrame: tv,
    horizontalInset: side * 2,
    verticalInset: tv
      ? faceReady
        ? clockChrome.phase + 16 + metaReserve
        : headerBlock + (appleFrame ? appleFrame.faceBottom : safe.bottom) + clockChrome.phase + (appleFrame ? metaReserve + 20 : 170)
      : safe.top + safe.bottom + 58 + 36 + 96 + (landscape ? 16 : 80),
  });
  const labelGap = tv ? 8 : 10 - Math.round(clock.fontSize * 0.22);

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
    leaveArmed.current = false;
    const action = transportPress(role, { running: snap.running, phase: snap.phase });
    switch (action) {
      case 'pause':
        pauseOnResume();
        return;
      case 'resume':
        timer.toggle();
        setPreferPrimary(true);
        return;
      case 'start':
        timer.startTimer();
        return;
      case 'finish':
        timer.completeTimer();
        setPreferPrimary(true);
        return;
      case 'ask-reset':
        askReset();
        return;
      default: {
        const unexpected: never = action;
        return unexpected;
      }
    }
  };

  const transportButtons = (
    <>
      {transport.map((button) => (
        <BigButton
          key={button.role}
          label={button.label}
          color={digits}
          variant={button.variant}
          testID={button.testID}
          tvMetrics={appleFrame?.button}
          onPress={() => pressTransport(button.role)}
          onHost={(node) => {
            hostFor(button.role)(node);
            if (button.role !== 'primary') return;
            setPrimaryNode((current) => (current === node ? current : node));
          }}
          focusable={confirmKind === null}
          hasTVPreferredFocus={
            confirmKind === null &&
            (button.role === 'primary' ? preferPrimary : button.role === 'reset' ? preferReset : false)
          }
          onFocus={
            button.role === 'primary'
              ? () => setPreferPrimary(false)
              : button.role === 'reset'
                ? () => setPreferReset(false)
                : undefined
          }
          focusLeft={tagFor(transportNeighbor(transportRoles, button.role, -1))}
          focusRight={
            showWatch && button.role === transportRoles[transportRoles.length - 1]
              ? watchTag
              : tagFor(transportNeighbor(transportRoles, button.role, 1))
          }
          focusUp={null}
        />
      ))}
      {showWatch ? (
        <BigButton
          label="Watch"
          color={digits}
          variant="ghost"
          testID="timer-watch"
          tvMetrics={appleFrame?.button}
          onPress={presentPicker}
          onHost={onWatchHost}
          focusable={confirmKind === null}
          focusLeft={tagFor(transportRoles[transportRoles.length - 1])}
          focusRight={watchTag}
          focusUp={null}
        />
      ) : null}
    </>
  );
  const Overlay = tv ? FocusGuide : View;
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
        style={[styles.face, tv && { top: headerBlock, bottom: appleFrame ? appleFrame.faceBottom : safe.bottom }]}
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
      <Overlay
        pointerEvents="box-none"
        style={[styles.overlay, { paddingTop: safe.top }]}
        {...(tv ? { autoFocus: true, destinations: primaryNode ? [primaryNode] : [] } : {})}
      >
        {tv && appleFrame ? (
          <View
            collapsable={false}
            pointerEvents={confirmKind === null ? 'box-none' : 'none'}
            style={[
              styles.controlsTv,
              {
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 0,
                bottom: safe.bottom + 8,
                left: appleFrame.inset,
                right: appleFrame.inset,
              },
            ]}
          >
            {watchMessage ? (
              <Text
                pointerEvents="none"
                testID="timer-watch-status"
                numberOfLines={2}
                style={{
                  color: watchLinkTone(watchPhase) === 'alert' ? attention : palette.text,
                  textAlign: 'center',
                  fontFamily: 'Oswald',
                  fontSize: appleFrame.linkFont,
                  lineHeight: appleFrame.linkLine,
                  marginBottom: appleFrame.linkGap,
                  alignSelf: 'stretch',
                }}
              >
                {watchMessage}
              </Text>
            ) : null}
            <View
              style={{
                alignSelf: 'stretch',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: appleFrame.button.gap,
              }}
            >
              {transportButtons}
            </View>
          </View>
        ) : tv ? (
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
            {transportButtons}
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
          {showBack ? <TvFocusPressable
            accent={palette.text}
            accessibilityRole="button"
            testID="timer-back"
            onPress={() => {
              const action = onScreenBackPress({
                tv,
                running: timer.readSnapshot().running,
                paused: timer.readSnapshot().paused,
              });
              switch (action) {
                case 'phone-back':
                  router.back();
                  return;
                case 'toggle': {
                  // Select on this control pauses or resumes. A hardware Back
                  // that also clicks it already claimed menu and must not toggle.
                  const recentMenu =
                    pressClaim.current?.kind === 'menu' && Date.now() - pressClaim.current.at < DUPLICATE_PRESS_MS;
                  if (recentMenu) return;
                  if (!claim('select')) return;
                  timer.toggle();
                  leaveArmed.current = false;
                  setPreferPrimary(true);
                  return;
                }
                case 'leave':
                  onTvBackRef.current();
                  return;
                default: {
                  const unexpected: never = action;
                  return unexpected;
                }
              }
            }}
            hitSlop={tv ? undefined : 12}
            onHost={tv ? onBackHost : undefined}
            focusDown={tv && confirmKind === null ? primaryTag : null}
            focusLeft={tv ? backTag : null}
            focusRight={tv ? backTag : null}
            focusable={onScreenBackFocusable(tv)}
            style={({ pressed }) => [
              styles.backButton,
              { left: Math.max(18, safe.left) },
              tv && styles.backButtonTv,
              tv && pressed ? { opacity: 0.75 } : null,
            ]}
          >
            <Text style={[styles.back, tv && scaleTvStyle(backTv, typeScale), { color: palette.text }]}>Back</Text>
          </TvFocusPressable> : null}
          {tv ? null : (
            <View style={[styles.cornerSlot, { right: Math.max(18, safe.right) }]}>
              <CornerLogo branding={branding} />
            </View>
          )}
        </View>
        {confirmKind === 'reset' ? (
          <View style={[styles.confirm, tv ? styles.confirmTv : null]} testID="reset-confirm">
            <Text style={styles.confirmTitle}>{RESET_CONFIRM.title}</Text>
            <BigButton
              label={RESET_CONFIRM.no}
              color={digits}
              variant="ghost"
              onPress={declineReset}
              testID="confirm-reset-no"
              hasTVPreferredFocus={tv ? preferDialog && RESET_CONFIRM.initialFocus === 'no' : undefined}
              onFocus={tv ? () => setPreferDialog(false) : undefined}
              onHost={tv ? onConfirmCancelHost : undefined}
              focusDown={tv ? confirmResetTag : null}
              focusUp={tv ? confirmCancelTag : null}
              focusable={tv ? true : undefined}
            />
            <BigButton
              label={RESET_CONFIRM.yes}
              color={digits}
              onPress={acceptReset}
              testID="confirm-reset-yes"
              onHost={tv ? onConfirmResetHost : undefined}
              focusUp={tv ? confirmCancelTag : null}
              focusDown={tv ? confirmResetTag : null}
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
          {transport.map((button) => {
            if (button.role === 'primary' && timer.snapshot.phase !== 'idle' && timer.snapshot.phase !== 'finished') {
              return null;
            }
            return (
              <BigButton
                key={button.role}
                label={button.label}
                color={digits}
                variant={button.variant}
                onPress={() => pressTransport(button.role)}
                testID={button.testID}
              />
            );
          })}
        </View>
        ) : null}
      </Overlay>
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
