import { describe, expect, it } from 'vitest';

import { clockStatusHint } from './copy';

describe('clock status hint', () => {
  it('uses the remote on TV and the touch wording on a phone', () => {
    expect(clockStatusHint(true, 'running')).toBe('Press select to pause');
    expect(clockStatusHint(false, 'running')).toBe('Tap the clock to pause');
    expect(clockStatusHint(true, 'paused')).toBe('Paused · press select to resume');
    expect(clockStatusHint(false, 'paused')).toBe('Paused · tap to resume');
  });
});
