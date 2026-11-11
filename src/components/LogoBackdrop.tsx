import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { Branding } from '@/src/branding/types';
import { WATERMARK_OPACITY, watermarkFrame } from '@/src/branding/watermark';

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
    const frame = watermarkFrame(width, height);
    return (
      <Image
        source={{ uri: branding.logoUri }}
        contentFit="contain"
        accessible={false}
        style={{
          position: 'absolute',
          width: frame.size,
          height: frame.size,
          left: frame.left,
          top: frame.top,
          opacity: WATERMARK_OPACITY,
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
