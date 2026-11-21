import { describe, expect, it } from 'vitest';

import {
  backStep,
  nextDialogFocus,
  nextRunningFocus,
  onScreenBackFocusable,
  onScreenBackPress,
  showsOnScreenBack,
  preferredTransportRole,
  tvTransportButtons,
} from './timerTransport';

const running = { phase: 'work' as const, running: true, paused: false };

describe('TV transport buttons', () => {
  it('starts on Pause, with Reset beside it, for a running countdown clock', () => {
    const buttons = tvTransportButtons({ ...running, mode: 'amrap' });
    expect(buttons.map((button) => button.label)).toEqual(['Pause', 'Reset']);
    expect(preferredTransportRole(buttons)).toBe('primary');
    expect(buttons[0].testID).toBe('timer-pause');
  });

  it('keeps Stop and Reset on a For Time clock, including while it is paused', () => {
    expect(tvTransportButtons({ ...running, mode: 'forTime' }).map((button) => button.label)).toEqual([
      'Pause',
      'Stop',
      'Reset',
    ]);
    expect(
      tvTransportButtons({ phase: 'work', running: false, paused: true, mode: 'forTime' }).map((button) => button.label),
    ).toEqual(['Resume', 'Stop', 'Reset']);
  });

  it('offers Resume for a paused round clock and Go again when the clock is finished', () => {
    expect(
      tvTransportButtons({ phase: 'rest', running: false, paused: true, mode: 'tabata' }).map((button) => button.label),
    ).toEqual(['Resume', 'Reset']);
    expect(
      tvTransportButtons({ phase: 'finished', running: false, paused: false, mode: 'rounds' }).map(
        (button) => button.label,
      ),
    ).toEqual(['Go again', 'Reset']);
    expect(
      tvTransportButtons({ phase: 'idle', running: false, paused: false, mode: 'countdown' }).map(
        (button) => button.label,
      ),
    ).toEqual(['Start']);
  });
});

describe('back on a running clock', () => {
  it('pauses a running clock, stays on an already paused clock, and leaves on the next back', () => {
    expect(backStep({ running: true, paused: false, confirming: false, leaveArmed: false })).toBe('pause');
    expect(backStep({ running: false, paused: true, confirming: false, leaveArmed: false })).toBe('stay');
    expect(backStep({ running: false, paused: true, confirming: false, leaveArmed: true })).toBe('exit');
    expect(backStep({ running: false, paused: false, confirming: false, leaveArmed: false })).toBe('exit');
  });

  it('closes a reset question before leaving', () => {
    expect(backStep({ running: true, paused: false, confirming: true, leaveArmed: true })).toBe('dismiss');
  });
});

describe('TV timer focus', () => {
  const forTime = ['primary', 'stop', 'reset'] as const;
  const amrap = ['primary', 'reset'] as const;

  it('keeps the on-screen Back control out of the TV focus order', () => {
    expect(onScreenBackFocusable(true)).toBe(false);
    expect(onScreenBackFocusable(false)).toBe(true);
    expect(preferredTransportRole(tvTransportButtons({ ...running, mode: 'forTime' }))).not.toBe('back');
  });

  it('drops the on-screen Back button on Apple TV and keeps it on Fire TV and iPhone', () => {
    expect(showsOnScreenBack(true, 'ios')).toBe(false);
    expect(showsOnScreenBack(true, 'android')).toBe(true);
    expect(showsOnScreenBack(false, 'ios')).toBe(true);
    expect(showsOnScreenBack(false, 'android')).toBe(true);
  });

  it('stays on the transport row when Apple TV has no on-screen Back', () => {
    expect(nextRunningFocus('primary', 'up', [...amrap], { onScreenBack: false })).toBe('primary');
    expect(nextRunningFocus('primary', 'down', [...amrap], { onScreenBack: false })).toBe('primary');
    expect(nextRunningFocus('primary', 'right', [...forTime], { onScreenBack: false })).toBe('stop');
    expect(nextRunningFocus('reset', 'left', [...forTime], { onScreenBack: false })).toBe('stop');
    expect(preferredTransportRole(tvTransportButtons({ ...running, mode: 'amrap' }))).toBe('primary');
  });

  it('treats Select on the on-screen Back control as pause or resume', () => {
    expect(onScreenBackPress({ tv: true, running: true, paused: false })).toBe('toggle');
    expect(onScreenBackPress({ tv: true, running: false, paused: true })).toBe('toggle');
    expect(onScreenBackPress({ tv: true, running: false, paused: false })).toBe('leave');
    expect(onScreenBackPress({ tv: false, running: true, paused: false })).toBe('phone-back');
  });

  it('lands on Pause from Back and walks the row without leaving it', () => {
    expect(nextRunningFocus('back', 'down', [...forTime])).toBe('primary');
    expect(nextRunningFocus('primary', 'right', [...forTime])).toBe('stop');
    expect(nextRunningFocus('stop', 'right', [...forTime])).toBe('reset');
    expect(nextRunningFocus('reset', 'right', [...forTime])).toBe('reset');
    expect(nextRunningFocus('reset', 'left', [...forTime])).toBe('stop');
    expect(nextRunningFocus('primary', 'left', [...amrap])).toBe('primary');
    expect(nextRunningFocus('primary', 'up', [...amrap])).toBe('back');
    expect(nextRunningFocus('back', 'up', [...amrap])).toBe('back');
    expect(nextRunningFocus('primary', 'down', [...amrap])).toBe('primary');
  });

  it('keeps a confirm dialog off the Back button', () => {
    expect(nextDialogFocus('safe', 'down')).toBe('destructive');
    expect(nextDialogFocus('destructive', 'up')).toBe('safe');
    expect(nextDialogFocus('safe', 'up')).toBe('safe');
    expect(nextDialogFocus('destructive', 'left')).toBe('destructive');
  });
});
