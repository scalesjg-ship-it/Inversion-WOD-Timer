export type LogoPlacement = 'watermark' | 'fullBleed' | 'corner';

export interface Branding {
  gymName: string;
  /** Work clock, buttons, and the main accent. */
  primaryColor: string;
  /** Rest clock. */
  accentColor: string;
  logoUri: string | null;
  logoPlacement: LogoPlacement;
  /** Blurs a full-bleed logo so the digits stay readable. */
  logoBlur: boolean;
}

export const DEFAULT_BRANDING: Branding = {
  gymName: 'CrossFit Inversion',
  primaryColor: '#FF4D2E',
  accentColor: '#3DDC97',
  logoUri: null,
  logoPlacement: 'watermark',
  logoBlur: true,
};

export const COLOR_SWATCHES: { name: string; primary: string; accent: string }[] = [
  { name: 'Inversion', primary: '#FF4D2E', accent: '#3DDC97' },
  { name: 'Gold', primary: '#F5C451', accent: '#F4F7FB' },
  { name: 'Royal', primary: '#4C8DFF', accent: '#F5C451' },
  { name: 'Ice', primary: '#E8EEF7', accent: '#7EB6FF' },
];
