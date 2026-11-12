import { describe, expect, it } from 'vitest';

import { parseLogoUrl } from './logoUrl';

describe('TV logo links', () => {
  it('accepts a direct https image link', () => {
    expect(parseLogoUrl('  https://gym.example/logo.png  ')).toBe('https://gym.example/logo.png');
    expect(parseLogoUrl('https://cdn.example/a/b/mark.jpg?v=2')).toBe('https://cdn.example/a/b/mark.jpg?v=2');
  });

  it('rejects anything that is not a public https URL', () => {
    expect(parseLogoUrl('')).toBeNull();
    expect(parseLogoUrl('http://gym.example/logo.png')).toBeNull();
    expect(parseLogoUrl('file:///tmp/logo.png')).toBeNull();
    expect(parseLogoUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(parseLogoUrl('javascript:alert(1)')).toBeNull();
    expect(parseLogoUrl('https://user:pass@gym.example/logo.png')).toBeNull();
    expect(parseLogoUrl('not a url')).toBeNull();
    expect(parseLogoUrl('https://localhost/logo.png')).toBeNull();
  });
});
