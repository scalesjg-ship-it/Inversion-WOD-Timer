import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { Branding } from '@/src/branding/types';
import { WATERMARK_OPACITY, watermarkFrame } from '@/src/branding/watermark';
import type { WatermarkInsets } from '@/src/branding/watermark';

export function LogoBackdrop({
  branding,
  width,
  height,
  insets,
}: {
  branding: Branding;
  width: number;
  height: number;
  insets?: WatermarkInsets;
}) {
  if (!branding.logoUri || branding.logoPlacement === 'corner' || width <= 0 || height <= 0) {
    return null;
  }

  if (branding.logoPlacement === 'watermark') {
    const frame = watermarkFrame(width, height, insets);
    if (frame.size <= 1) return null;
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: frame.size,
          height: frame.size,
          left: frame.left,
          top: frame.top,
          overflow: 'hidden',
        }}
      >
        <Image
          source={{ uri: branding.logoUri }}
          contentFit="contain"
          contentPosition="center"
          accessible={false}
          style={{ width: '100%', height: '100%', opacity: WATERMARK_OPACITY }}
        />
      </View>
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
