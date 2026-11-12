import type { BackgroundStyle, BrandColors, Branding, ClockWeight, LogoPlacement, ThemePreset } from './types';

/**
 * One-tap clock colors. Digit, background, and accent are the roles a coach
 * notices first; the phase colors stay in the same family so the timer still reads.
 */
export const COLOR_PALETTES: ThemePreset[] = [
  {
    id: 'classic',
    name: 'Classic Black/Yellow',
    workColor: '#F5C518',
    restColor: '#F4F7FB',
    leadInColor: '#FFE56A',
    warningColor: '#FFB020',
    digitColor: '#F5C518',
    backgroundColor: '#07080A',
    uiColor: '#F5C518',
  },
  {
    id: 'patriot',
    name: 'Patriot Red/White/Blue',
    workColor: '#FF4D5A',
    restColor: '#6AA6FF',
    leadInColor: '#F4F7FB',
    warningColor: '#FFD23F',
    digitColor: '#F4F7FB',
    backgroundColor: '#0B1D36',
    uiColor: '#FF4D5A',
  },
  {
    id: 'neon',
    name: 'Neon',
    workColor: '#FF2BD6',
    restColor: '#39FF14',
    leadInColor: '#5CE1FF',
    warningColor: '#FFE600',
    digitColor: '#F8F7FF',
    backgroundColor: '#120018',
    uiColor: '#FF2BD6',
  },
  {
    id: 'mono',
    name: 'Monochrome',
    workColor: '#FFFFFF',
    restColor: '#B7C0CA',
    leadInColor: '#E6EDF4',
    warningColor: '#FFFFFF',
    digitColor: '#FFFFFF',
    backgroundColor: '#000000',
    uiColor: '#FFFFFF',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    workColor: '#5EF0D4',
    restColor: '#8EBEFF',
    leadInColor: '#F4F7FB',
    warningColor: '#FFD23F',
    digitColor: '#E7F8FF',
    backgroundColor: '#041820',
    uiColor: '#5EF0D4',
  },
  {
    id: 'forest',
    name: 'Forest',
    workColor: '#8DFF78',
    restColor: '#C8F5A0',
    leadInColor: '#F4F7FB',
    warningColor: '#FFB020',
    digitColor: '#F3FFE8',
    backgroundColor: '#07140C',
    uiColor: '#8DFF78',
  },
  {
    id: 'inversion',
    name: 'Inversion',
    workColor: '#FF4D2E',
    restColor: '#3DDC97',
    leadInColor: '#F5C451',
    warningColor: '#FFB020',
    digitColor: '#F4F7FB',
    backgroundColor: '#07080A',
    uiColor: '#FF4D2E',
  },
  {
    id: 'contrast',
    name: 'High-contrast',
    workColor: '#FFFFFF',
    restColor: '#00FF6A',
    leadInColor: '#FFE600',
    warningColor: '#FF2A2A',
    digitColor: '#FFFFFF',
    backgroundColor: '#000000',
    uiColor: '#FFFFFF',
  },
];

/** Older name for the built-in color sets. */
export const THEME_PRESETS = COLOR_PALETTES;

export interface BrandTemplate {
  id: string;
  name: string;
  paletteId: string;
  logoPlacement: LogoPlacement;
  clockWeight: ClockWeight;
  backgroundStyle: BackgroundStyle;
  blurb: string;
}

export const BRAND_TEMPLATES: BrandTemplate[] = [
  {
    id: 'inversion-classic',
    name: 'Inversion',
    paletteId: 'inversion',
    logoPlacement: 'watermark',
    clockWeight: 'bold',
    backgroundStyle: 'solid',
    blurb: 'Bold clock, watermark logo, flat background',
  },
  {
    id: 'classic-board',
    name: 'Classic Board',
    paletteId: 'classic',
    logoPlacement: 'corner',
    clockWeight: 'bold',
    backgroundStyle: 'solid',
    blurb: 'Black and yellow, logo in the corner',
  },
  {
    id: 'patriot-arena',
    name: 'Patriot Arena',
    paletteId: 'patriot',
    logoPlacement: 'corner',
    clockWeight: 'bold',
    backgroundStyle: 'edge',
    blurb: 'Red, white, and blue with a thick edge bar',
  },
  {
    id: 'night-shift',
    name: 'Night Shift',
    paletteId: 'mono',
    logoPlacement: 'watermark',
    clockWeight: 'regular',
    backgroundStyle: 'vignette',
    blurb: 'Monochrome, softer clock, darkened edges',
  },
  {
    id: 'ocean-wall',
    name: 'Ocean Wall',
    paletteId: 'ocean',
    logoPlacement: 'fullBleed',
    clockWeight: 'bold',
    backgroundStyle: 'vignette',
    blurb: 'Full-bleed logo on a deep ocean field',
  },
  {
    id: 'forest-club',
    name: 'Forest Club',
    paletteId: 'forest',
    logoPlacement: 'corner',
    clockWeight: 'regular',
    backgroundStyle: 'solid',
    blurb: 'Green field, logo in the corner',
  },
];

const COLOR_KEYS: (keyof BrandColors)[] = [
  'workColor',
  'restColor',
  'leadInColor',
  'warningColor',
  'digitColor',
  'backgroundColor',
  'uiColor',
];

export function paletteById(id: string): ThemePreset | null {
  return COLOR_PALETTES.find((palette) => palette.id === id) ?? null;
}

export function paletteColors(palette: ThemePreset): BrandColors {
  return {
    workColor: palette.workColor,
    restColor: palette.restColor,
    leadInColor: palette.leadInColor,
    warningColor: palette.warningColor,
    digitColor: palette.digitColor,
    backgroundColor: palette.backgroundColor,
    uiColor: palette.uiColor,
  };
}

export function paletteMatches(branding: BrandColors, palette: ThemePreset): boolean {
  const colors = paletteColors(palette);
  return COLOR_KEYS.every((key) => branding[key].toUpperCase() === colors[key].toUpperCase());
}

/** Colors plus layout. Does not touch the gym name or the saved logo file. */
export function templatePatch(template: BrandTemplate): Partial<Branding> | null {
  const palette = paletteById(template.paletteId);
  if (!palette) return null;
  return {
    ...paletteColors(palette),
    logoPlacement: template.logoPlacement,
    clockWeight: template.clockWeight,
    backgroundStyle: template.backgroundStyle,
  };
}

export function templateMatches(branding: Branding, template: BrandTemplate): boolean {
  const palette = paletteById(template.paletteId);
  if (!palette || !paletteMatches(branding, palette)) return false;
  return (
    branding.logoPlacement === template.logoPlacement &&
    branding.clockWeight === template.clockWeight &&
    branding.backgroundStyle === template.backgroundStyle
  );
}

export function clockFontFamily(weight: ClockWeight): 'Oswald' | 'OswaldMedium' {
  switch (weight) {
    case 'regular':
      return 'OswaldMedium';
    case 'bold':
      return 'Oswald';
    default: {
      const unexpected: never = weight;
      return unexpected;
    }
  }
}

/** Solid and vignette keep the original 8pt phase bar. Edge is the thicker template. */
export function clockEdgeHeight(style: BackgroundStyle): number {
  switch (style) {
    case 'solid':
    case 'vignette':
      return 8;
    case 'edge':
      return 28;
    default: {
      const unexpected: never = style;
      return unexpected;
    }
  }
}
