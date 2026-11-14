import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BigButton } from '@/src/components/ui';
import { chrome } from '@/src/theme/chrome';
import { TV_TITLE_FONT, tvSafeBox, tvScale, tvScaled } from '@/src/tv/layout';

/** One settings group at a time, with large previous and next controls. */
export function TvPager({
  pages,
  accent,
}: {
  pages: { key: string; label: string; content: ReactNode }[];
  accent: string;
}) {
  const [index, setIndex] = useState(0);
  const { width, height } = useWindowDimensions();
  const scale = tvScale(width, height);
  const safe = tvSafeBox(true, width, height);
  const page = pages[Math.min(index, Math.max(0, pages.length - 1))];
  if (!page) return null;
  const title = tvScaled(TV_TITLE_FONT, width, height);
  return (
    <View style={[styles.pager, { paddingHorizontal: safe.horizontal, paddingTop: safe.vertical, gap: Math.round(16 * scale) }]}>
      <Text style={[styles.title, { fontSize: title, lineHeight: title + Math.round(8 * scale) }]}>{page.label}</Text>
      <View style={styles.body}>{page.content}</View>
      <View style={[styles.nav, { gap: Math.round(20 * scale), paddingBottom: safe.vertical }]}>
        <View style={styles.navButton}>
          <BigButton
            label="Previous"
            color={accent}
            variant="ghost"
            testID="tv-page-prev"
            onPress={() => setIndex((current) => Math.max(0, current - 1))}
          />
        </View>
        <Text style={[styles.count, { fontSize: tvScaled(28, width, height) }]}>
          {index + 1} / {pages.length}
        </Text>
        <View style={styles.navButton}>
          <BigButton
            label="Next"
            color={accent}
            variant="ghost"
            testID="tv-page-next"
            onPress={() => setIndex((current) => Math.min(pages.length - 1, current + 1))}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
  title: {
    fontFamily: 'Oswald',
    color: chrome.text,
  },
  body: {
    flex: 1,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navButton: {
    flex: 1,
  },
  count: {
    fontFamily: 'Oswald',
    color: chrome.muted,
    minWidth: 88,
    textAlign: 'center',
  },
});
