import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { PRODUCT_NAME } from '@/src/productName';
import { chrome } from '@/src/theme/chrome';
import { TV_SAFE_HORIZONTAL } from '@/src/tv/layout';

type Variant = 'wordmark' | 'kicker';

/**
 * Two-line product lockup. "ANTHEM" stays the large line and "GYM TIMER" sits
 * under it, centered on that line, so the longer name fits a phone and a TV.
 */
export function ProductMark({
  variant,
  color,
  large = false,
}: {
  variant: Variant;
  color?: string;
  /** Ten-foot wordmark, including a TV. Kickers ignore this and key off the TV runtime. */
  large?: boolean;
}) {
  const { width } = useWindowDimensions();
  const tv = Platform.isTV === true;
  const ink = color ?? (variant === 'kicker' ? chrome.muted : chrome.text);
  const titleSize = titleFontSize(variant, tv, large);
  const subSize = subtitleFontSize(variant, tv, large);
  const gutter = widthBudgetGutter(variant, tv);
  const budget = width > 0 ? Math.max(titleSize * 4, width - gutter) : undefined;

  return (
    <View
      accessible
      accessibilityLabel={PRODUCT_NAME}
      style={[
        styles.block,
        variant === 'kicker' ? styles.kickerBlock : styles.wordmarkBlock,
        variant === 'wordmark' && (tv || large) && styles.wordmarkBlockLarge,
      ]}
    >
      <Text
        style={[
          styles.title,
          variant === 'kicker' ? styles.kickerTitle : styles.wordmarkTitle,
          { color: ink, fontSize: titleSize, maxWidth: budget },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        Anthem
      </Text>
      <Text
        style={[
          styles.sub,
          variant === 'kicker' ? styles.kickerSub : styles.wordmarkSub,
          { color: ink, fontSize: subSize, maxWidth: budget },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        Gym Timer
      </Text>
    </View>
  );
}

function titleFontSize(variant: Variant, tv: boolean, large: boolean): number {
  switch (variant) {
    case 'kicker':
      return tv ? 32 : 13;
    case 'wordmark':
      if (tv) return 32;
      if (large) return 28;
      return 14;
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }
}

function subtitleFontSize(variant: Variant, tv: boolean, large: boolean): number {
  switch (variant) {
    case 'kicker':
      return tv ? 16 : 10;
    case 'wordmark':
      if (tv) return 16;
      if (large) return 14;
      return 10;
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }
}

/** Horizontal space already taken by screen padding and, for a kicker, the Back control. */
function widthBudgetGutter(variant: Variant, tv: boolean): number {
  const padding = tv ? TV_SAFE_HORIZONTAL * 2 : 40;
  const back = variant === 'kicker' ? (tv ? 220 : 96) : 0;
  return padding + back;
}

const styles = StyleSheet.create({
  block: {
    alignItems: 'center',
    maxWidth: '100%',
  },
  wordmarkBlock: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  wordmarkBlockLarge: {
    marginTop: 12,
  },
  kickerBlock: {
    alignSelf: 'flex-end',
    flexShrink: 1,
  },
  title: {
    fontFamily: 'OswaldMedium',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  wordmarkTitle: {
    letterSpacing: 4,
  },
  kickerTitle: {
    letterSpacing: 2,
  },
  sub: {
    fontFamily: 'OswaldMedium',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  wordmarkSub: {
    letterSpacing: 2,
    marginTop: 1,
  },
  kickerSub: {
    letterSpacing: 1.4,
    marginTop: 1,
  },
});
