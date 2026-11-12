import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TvFocusPressable } from '@/src/components/TvFocus';
import { chrome } from '@/src/theme/chrome';
import { TV_BODY_FONT, TV_TITLE_FONT, tvSafeBox } from '@/src/tv/layout';

/** Props passed to a route's `ErrorBoundary` export. */
type RouteErrorProps = {
  error: Error;
  retry: () => Promise<void>;
};

/**
 * Readable stand-in for expo-router's default boundary.
 * The default draws a 16pt line in a narrow centered column, so on a television
 * the message runs off the left of the glass.
 */
export function RouteErrorBoundary({ error, retry }: RouteErrorProps) {
  const tv = Platform.isTV === true;
  const box = tvSafeBox(tv);
  const detail = error.name && error.name !== 'Error' ? `${error.name}: ${error.message}` : error.message;

  return (
    <View
      style={[styles.safe, tv && { paddingHorizontal: box.horizontal, paddingTop: box.vertical, paddingBottom: box.vertical }]}
    >
      <ScrollView contentContainerStyle={[styles.content, tv && styles.contentTv]} testID="route-error">
        <Text style={[styles.title, tv && styles.titleTv]}>Something went wrong</Text>
        <Text style={[styles.message, tv && styles.messageTv]} testID="route-error-message">
          {detail}
        </Text>
      </ScrollView>
      <TvFocusPressable
        accessibilityRole="button"
        hasTVPreferredFocus
        testID="route-error-retry"
        onPress={() => {
          void retry();
        }}
        style={({ pressed }) => [styles.retry, tv && styles.retryTv, pressed ? { opacity: 0.75 } : null]}
      >
        <Text style={[styles.retryLabel, tv && styles.retryLabelTv]}>Retry</Text>
      </TvFocusPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: chrome.bg,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  content: {
    gap: 12,
    paddingBottom: 24,
  },
  contentTv: {
    gap: 28,
    paddingBottom: 36,
  },
  title: {
    color: chrome.text,
    fontFamily: 'Oswald',
    fontSize: 32,
    lineHeight: 40,
  },
  titleTv: {
    fontSize: TV_TITLE_FONT,
    lineHeight: TV_TITLE_FONT + 8,
  },
  message: {
    color: chrome.text,
    fontSize: 18,
    lineHeight: 26,
  },
  messageTv: {
    fontSize: TV_BODY_FONT,
    lineHeight: TV_BODY_FONT + 10,
  },
  retry: {
    alignSelf: 'flex-start',
    minHeight: 52,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: chrome.line,
    backgroundColor: chrome.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryTv: {
    minHeight: 88,
    paddingHorizontal: 36,
    borderRadius: 18,
    borderWidth: 4,
  },
  retryLabel: {
    color: chrome.text,
    fontFamily: 'Oswald',
    fontSize: 20,
  },
  retryLabelTv: {
    fontSize: 36,
  },
});
