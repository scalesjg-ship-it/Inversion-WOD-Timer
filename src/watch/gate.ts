/** The wrist link exists only on the Apple TV app. Fire TV and phones do nothing. */
export function watchLinkEnabled(platform: { os: string; tv: boolean }): boolean {
  return platform.os === 'ios' && platform.tv;
}
