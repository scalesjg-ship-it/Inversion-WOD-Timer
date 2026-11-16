import { useEffect } from 'react';

function tabName(): string {
  const value = (globalThis as { __TV_TAB__?: string }).__TV_TAB__;
  return value ?? 'wod';
}

export function usePathname(): string {
  const tab = tabName();
  // rounds-confirm is the same Rounds route as rounds. The preview only adds the delete confirm.
  if (tab === 'rounds' || tab === 'rounds-confirm') return '/rounds';
  if (tab === 'brand') return '/brand';
  return '/';
}

export function useLocalSearchParams(): { mode?: string } {
  if (tabName() === 'setup') return { mode: 'forTime' };
  return {};
}

export const router = {
  push: () => undefined,
  navigate: () => undefined,
  back: () => undefined,
  replace: () => undefined,
};

export function useRouter(): typeof router {
  return router;
}

/** Runs the screen's focus loader once for a static preview. */
export function useFocusEffect(effect: () => void | (() => void)): void {
  useEffect(() => {
    const cleanup = effect();
    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [effect]);
}
