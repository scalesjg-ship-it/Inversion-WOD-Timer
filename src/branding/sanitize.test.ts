import { describe, expect, it } from 'vitest';

import { sanitizeBranding } from './storage';

describe('saved gym branding', () => {
  it('keeps any gym name and logo and defaults placement to the watermark', () => {
    const logo = 'data:image/png;base64,AAAA';
    const saved = sanitizeBranding({
      gymName: 'Northside Boxing',
      logoUri: logo,
    });
    expect(saved.gymName).toBe('Northside Boxing');
    expect(saved.logoUri).toBe(logo);
    expect(saved.logoPlacement).toBe('watermark');
    expect(saved.workColor).toBe('#FF4D2E');
    expect(saved.backgroundColor).toBe('#07080A');
  });

  it('reads older work and rest colors and fills the newer roles', () => {
    const saved = sanitizeBranding({
      primaryColor: '#112233',
      accentColor: '#ABCDEF',
    });
    expect(saved.workColor).toBe('#112233');
    expect(saved.restColor).toBe('#ABCDEF');
    expect(saved.uiColor).toBe('#112233');
    expect(saved.leadInColor).toBe('#F5C451');
    expect(saved.warningColor).toBe('#FFB020');
    expect(saved.digitColor).toBe('#F4F7FB');
  });
});
