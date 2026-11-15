import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { moduleRuns, qrModules } from './qrMatrix';

export function QrMark({ value }: { value: string }) {
  const { height } = useWindowDimensions();
  const target = Math.round(Math.min(220, Math.max(140, height * 0.2)));
  const matrix = useMemo(() => qrModules(value), [value]);
  const module = Math.max(4, Math.floor(target / Math.max(matrix.length, 1)));
  const side = module * matrix.length;
  return (
    <View
      testID="tv-brand-qr"
      focusable={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.card}
    >
      <View style={{ width: side, height: side }}>
        {matrix.map((row, y) => (
          <View key={y} style={{ flexDirection: 'row', height: module }}>
            {moduleRuns(row).map((run, index) => (
              <View
                key={index}
                style={{
                  width: run.length * module,
                  height: module,
                  backgroundColor: run.dark ? '#07080A' : '#FFFFFF',
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
  },
});
