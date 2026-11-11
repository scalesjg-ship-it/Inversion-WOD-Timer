export type LogoPlacement = 'watermark' | 'fullBleed' | 'corner';

export interface BrandColors {
  workColor: string;
  restColor: string;
  leadInColor: string;
  warningColor: string;
  digitColor: string;
  backgroundColor: string;
  uiColor: string;
}

export interface Branding extends BrandColors {
  gymName: string;
  logoUri: string | null;
  logoPlacement: LogoPlacement;
  /** Blurs a full-bleed logo so the digits stay readable. */
  logoBlur: boolean;
}

export const DEFAULT_BRANDING: Branding = {
  gymName: 'CrossFit Inversion',
  workColor: '#FF4D2E',
  restColor: '#3DDC97',
  leadInColor: '#F5C451',
  warningColor: '#FFB020',
  digitColor: '#F4F7FB',
  backgroundColor: '#07080A',
  uiColor: '#FF4D2E',
  logoUri: null,
  logoPlacement: 'watermark',
  logoBlur: true,
};

export interface ThemePreset extends BrandColors {
  id: string;
  name: string;
}

export const THEME_PRESETS: ThemePreset[] = [
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
    id: 'dark',
    name: 'Dark',
    workColor: '#F4F7FB',
    restColor: '#8E98A6',
    leadInColor: '#C5CED8',
    warningColor: '#FFD60A',
    digitColor: '#FFFFFF',
    backgroundColor: '#000000',
    uiColor: '#F4F7FB',
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
    id: 'fight',
    name: 'Fight',
    workColor: '#E10600',
    restColor: '#1E4DFF',
    leadInColor: '#F5C451',
    warningColor: '#FFE14A',
    digitColor: '#F4F7FB',
    backgroundColor: '#0B0D12',
    uiColor: '#E10600',
  },
];
