import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { TvFocusPressable } from '@/src/components/TvFocus';
import type { TvFocusTag } from '@/src/components/TvTabFocus';
import { useTvFocusTag } from '@/src/tv/useTvFocusTag';

/**
 * Code, Pair with code, and Unpair watch sit in the timer status slot.
 * The Siri Remote reaches them with Up from the transport row.
 */
export function WatchPairBar({
  message,
  code,
  offerPair,
  offerUnpair,
  color,
  fontSize,
  lineHeight,
  gap,
  onPair,
  onUnpair,
  onRefresh,
  focusDown,
  onTag,
}: {
  message: string | null;
  code: string | null;
  offerPair: boolean;
  offerUnpair: boolean;
  color: string;
  fontSize: number;
  lineHeight: number;
  gap: number;
  onPair: () => void;
  onUnpair: () => void;
  onRefresh: () => void;
  focusDown: TvFocusTag | null;
  onTag: (tag: TvFocusTag | null) => void;
}) {
  const [tag, onHost] = useTvFocusTag();
  const action = pairAction(code, offerPair, offerUnpair);

  useEffect(() => {
    onTag(action ? tag : null);
    return () => onTag(null);
  }, [action, onTag, tag]);

  const labelStyle = {
    color,
    textAlign: 'center' as const,
    fontFamily: 'Oswald',
    fontSize,
    lineHeight,
  };

  return (
    <View pointerEvents="box-none" style={[styles.bar, { marginBottom: gap }]}>
      {code ? (
        <TvFocusPressable
          testID="watch-pair-code"
          accessibilityRole="button"
          accessibilityLabel={`Pairing code ${code}`}
          onPress={onRefresh}
          onHost={onHost}
          focusDown={focusDown}
          focusUp={tag}
          focusLeft={tag}
          focusRight={tag}
          style={styles.hit}
        >
          <Text style={[labelStyle, styles.code]} numberOfLines={1}>
            {code}
          </Text>
        </TvFocusPressable>
      ) : null}
      {offerPair ? (
        <TvFocusPressable
          testID="watch-pair-with-code"
          accessibilityRole="button"
          accessibilityLabel="Pair with code"
          onPress={onPair}
          onHost={onHost}
          focusDown={focusDown}
          focusUp={tag}
          focusLeft={tag}
          focusRight={tag}
          style={styles.hit}
        >
          <Text style={labelStyle} numberOfLines={1}>
            Pair with code
          </Text>
        </TvFocusPressable>
      ) : null}
      {offerUnpair ? (
        <TvFocusPressable
          testID="watch-unpair"
          accessibilityRole="button"
          accessibilityLabel="Unpair watch"
          onPress={onUnpair}
          onHost={onHost}
          focusDown={focusDown}
          focusUp={tag}
          focusLeft={tag}
          focusRight={tag}
          style={styles.hit}
        >
          <Text style={labelStyle} numberOfLines={1}>
            Unpair watch
          </Text>
        </TvFocusPressable>
      ) : null}
      {message ? (
        <Text pointerEvents="none" testID="timer-watch-status" numberOfLines={code ? 1 : 2} style={labelStyle}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

function pairAction(code: string | null, offerPair: boolean, offerUnpair: boolean): 'code' | 'pair' | 'unpair' | null {
  if (code) return 'code';
  if (offerPair) return 'pair';
  if (offerUnpair) return 'unpair';
  return null;
}

const styles = StyleSheet.create({
  bar: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  hit: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: Platform.isTV === true ? 4 : 8,
  },
  code: {
    letterSpacing: 6,
  },
});
