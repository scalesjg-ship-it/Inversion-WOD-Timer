import { useCallback, useState, type ComponentRef } from 'react';
import { findNodeHandle, type Pressable } from 'react-native';

import type { TvFocusTag } from '@/src/components/TvTabFocus';

type Host = ComponentRef<typeof Pressable>;

function readTag(node: Host | null): TvFocusTag | null {
  if (!node) return null;
  try {
    const tag = findNodeHandle(node);
    return typeof tag === 'number' ? tag : null;
  } catch {
    return null;
  }
}

/** Native tag for nextFocus*. Fabric can report it a frame after the ref attaches. */
export function useTvFocusTag(): [TvFocusTag | null, (node: Host | null) => void] {
  const [tag, setTag] = useState<TvFocusTag | null>(null);
  const onHost = useCallback((node: Host | null) => {
    const apply = (next: TvFocusTag | null) => {
      setTag((current) => (current === next ? current : next));
    };
    const read = readTag(node);
    apply(read);
    if (node && read == null) {
      requestAnimationFrame(() => apply(readTag(node)));
    }
  }, []);
  return [tag, onHost];
}
