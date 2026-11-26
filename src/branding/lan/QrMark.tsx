import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { tvScaled } from '@/src/tv/layout';

import { QR_MARK_AT_1080, qrMarkSide, qrModules, qrSvgPath } from './qrMatrix';

export function QrMark({ value }: { value: string }) {
  const { width, height } = useWindowDimensions();
  const matrix = useMemo(() => qrModules(value), [value]);
  const path = useMemo(() => qrSvgPath(matrix), [matrix]);
  const modules = Math.max(matrix.length, 1);
  const side = qrMarkSide(tvScaled(QR_MARK_AT_1080, width, height), modules);
  return (
    <View
      testID="tv-brand-qr"
      focusable={false}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.card}
    >
      <Svg width={side} height={side} viewBox={`0 0 ${modules} ${modules}`} accessible={false}>
        <Rect x={0} y={0} width={modules} height={modules} fill="#FFFFFF" />
        <Path d={path} fill="#000000" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    overflow: 'hidden',
  },
});
