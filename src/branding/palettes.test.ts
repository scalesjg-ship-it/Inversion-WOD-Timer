import { describe, expect, it } from 'vitest';

import { DEFAULT_BRANDING } from './types';
import { sanitizeBranding } from './storage';
import {
  BRAND_TEMPLATES,
  COLOR_PALETTES,
  clockEdgeHeight,
  clockFontFamily,
  paletteColors,
  paletteMatches,
  templateMatches,
  templatePatch,
} from './palettes';

describe('brand palettes and templates', () => {
  it('offers a one-tap set for the clock colors', () => {
    expect(COLOR_PALETTES.length).toBeGreaterThanOrEqual(8);
    const names = COLOR_PALETTES.map((palette) => palette.name);
    expect(names).toEqual(
      expect.arrayContaining(['Classic Black/Yellow', 'Patriot Red/White/Blue', 'Neon', 'Monochrome', 'Ocean', 'Forest']),
    );
    for (const palette of COLOR_PALETTES) {
      const saved = sanitizeBranding(paletteColors(palette));
      expect(paletteMatches(saved, palette)).toBe(true);
      expect(saved.gymName).toBe(DEFAULT_BRANDING.gymName);
      expect(saved.logoUri).toBeNull();
    }
  });

  it('applies a template as colors plus layout and leaves the logo file alone', () => {
    expect(BRAND_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    for (const template of BRAND_TEMPLATES) {
      const patch = templatePatch(template);
      expect(patch).not.toBeNull();
      expect(patch).not.toHaveProperty('gymName');
      expect(patch).not.toHaveProperty('logoUri');
      const saved = sanitizeBranding({ ...DEFAULT_BRANDING, logoUri: 'data:image/png;base64,AAAA', ...patch });
      expect(templateMatches(saved, template)).toBe(true);
      expect(saved.logoUri).toBe('data:image/png;base64,AAAA');
      expect(saved.gymName).toBe(DEFAULT_BRANDING.gymName);
    }
  });

  it('drops the template match once a color is tweaked', () => {
    const template = BRAND_TEMPLATES[0];
    if (!template) throw new Error('missing template');
    const patch = templatePatch(template);
    const tweaked = sanitizeBranding({ ...DEFAULT_BRANDING, ...patch, digitColor: '#112233' });
    expect(templateMatches(tweaked, template)).toBe(false);
  });

  it('keeps the shipped clock bold on a flat field until a template says otherwise', () => {
    expect(clockFontFamily('bold')).toBe('Oswald');
    expect(clockFontFamily('regular')).toBe('OswaldMedium');
    expect(clockEdgeHeight('solid')).toBe(8);
    expect(clockEdgeHeight('vignette')).toBe(8);
    expect(clockEdgeHeight('edge')).toBeGreaterThan(8);
  });
});
