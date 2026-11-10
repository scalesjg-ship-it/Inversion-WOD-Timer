import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { Branding } from '@/src/branding/types';

export function LogoBackdrop({
  branding,
  width,
  height,
}: {
  branding: Branding;
  width: number;
  height: number;
}) {
  if (!branding.logoUri || branding.logoPlacement === 'corner' || width <= 0 || height <= 0) {
    return null;
  }

  if (branding.logoPlacement === 'watermark') {
    const size = Math.min(width, height) * 0.78;
    return (
      <Image
        source={{ uri: branding.logoUri }}
        contentFit="contain"
        accessible={false}
        style={{
          position: 'absolute',
          width: size,
          height: size,
          left: (width - size) / 2,
          top: (height - size) / 2,
          opacity: 0.2,
        }}
      />
    );
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={{ uri: branding.logoUri }}
        contentFit="cover"
        blurRadius={branding.logoBlur ? 22 : 0}
        accessible={false}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(7,8,10,0.7)' }]} />
    </View>
  );
}

export function CornerLogo({ branding, size = 64 }: { branding: Branding; size?: number }) {
  if (!branding.logoUri || branding.logoPlacement !== 'corner') return null;
  return (
    <Image
      source={{ uri: branding.logoUri }}
      contentFit="contain"
      accessible={false}
      style={{ width: size, height: size, borderRadius: 12 }}
    />
  );
}
