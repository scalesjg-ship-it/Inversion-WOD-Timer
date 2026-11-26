import { useCallback, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import { tvHomeLayout, tvMenuSceneHeight, tvScale, type TvHomeLayout, type TvMenuOptions } from '@/src/tv/layout';

/** Measures the scroll scene and sizes one row of TV cards to it. */
export function useTvMenuFrame(count: number, options?: TvMenuOptions): {
  frame: TvHomeLayout;
  scale: number;
  onSceneLayout: (event: LayoutChangeEvent) => void;
} {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [scene, setScene] = useState({ width: 0, height: 0 });
  const onSceneLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    const nextHeight = event.nativeEvent.layout.height;
    setScene((current) =>
      current.width === nextWidth && current.height === nextHeight ? current : { width: nextWidth, height: nextHeight },
    );
  }, []);
  const width = scene.width > 0 ? scene.width : windowWidth;
  const height = tvMenuSceneHeight(scene.height, windowHeight);
  const frame = tvHomeLayout(width, height, count, { ...options, windowHeight });
  return { frame, scale: tvScale(windowWidth, windowHeight), onSceneLayout };
}
