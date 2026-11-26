export type LogoPlacement = 'watermark' | 'fullBleed' | 'corner';

/** Oswald Bold is the clock the app shipped with. Regular is Oswald Medium. */
export type ClockWeight = 'regular' | 'bold';

/** Solid is the flat field the app shipped with. */
export type BackgroundStyle = 'solid' | 'vignette' | 'edge';

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
  clockWeight: ClockWeight;
  backgroundStyle: BackgroundStyle;
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
  clockWeight: 'bold',
  backgroundStyle: 'solid',
};

export interface ThemePreset extends BrandColors {
  id: string;
  name: string;
}

