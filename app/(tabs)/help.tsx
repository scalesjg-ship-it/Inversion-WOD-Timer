import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor } from '@/src/branding/color';
import { RouteErrorBoundary } from '@/src/components/RouteErrorBoundary';
import { TvFocusPressable } from '@/src/components/TvFocus';
import { useTvTabFocus, type TvFocusTag } from '@/src/components/TvTabFocus';
import { helpNeighbors, helpPlatform, helpSections, helpVersionLine, type HelpBlock } from '@/src/help/copy';
import { chrome } from '@/src/theme/chrome';
import { tvHelpColumn } from '@/src/tv/helpLayout';
import { tvSafeBox, tvScaled } from '@/src/tv/layout';
import { useTvFocusTag } from '@/src/tv/useTvFocusTag';

export function ErrorBoundary(props: { error: Error; retry: () => Promise<void> }) {
  return <RouteErrorBoundary {...props} />;
}

function installedBuild(): string {
  const ios = Constants.platform?.ios?.buildNumber;
  if (typeof ios === 'string' && ios.trim()) return ios.trim();
  const android = Constants.platform?.android?.versionCode;
  if (typeof android === 'number') return String(android);
  const configIos = Constants.expoConfig?.ios?.buildNumber;
  if (typeof configIos === 'string' && configIos.trim()) return configIos.trim();
  const configAndroid = Constants.expoConfig?.android?.versionCode;
  if (typeof configAndroid === 'number') return String(configAndroid);
  return '';
}

export default function HelpScreen() {
  const { branding } = useBranding();
  const { width, height } = useWindowDimensions();
  const tv = Platform.isTV === true;
  const platform = helpPlatform({ os: Platform.OS, tv });
  const sections = helpSections(platform);
  const version = helpVersionLine(Constants.expoConfig?.version, installedBuild());
  const accent = readableDigitColor(branding.uiColor, branding.backgroundColor);
  const box = tvSafeBox(tv, width, height);
  const titleSize = tv ? tvScaled(40, width, height) : 22;
  const bodySize = tv ? tvScaled(28, width, height) : 16;
  const bodyLine = tv ? tvScaled(36, width, height) : 22;
  const pageSize = tv ? tvScaled(52, width, height) : 28;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: branding.backgroundColor }]} edges={tv ? [] : ['top']} testID="screen-help">
      <HelpList
        tv={tv}
        sections={sections}
        version={version}
        accent={accent}
        titleSize={titleSize}
        bodySize={bodySize}
        bodyLine={bodyLine}
        pageSize={pageSize}
        paddingHorizontal={tv ? box.horizontal : 20}
        paddingTop={tv ? box.vertical : 16}
        paddingBottom={tv ? box.vertical : 28}
      />
    </SafeAreaView>
  );
}

function HelpList({
  tv,
  sections,
  version,
  accent,
  titleSize,
  bodySize,
  bodyLine,
  pageSize,
  paddingHorizontal,
  paddingTop,
  paddingBottom,
}: {
  tv: boolean;
  sections: HelpBlock[];
  version: string;
  accent: string;
  titleSize: number;
  bodySize: number;
  bodyLine: number;
  pageSize: number;
  paddingHorizontal: number;
  paddingTop: number;
  paddingBottom: number;
}) {
  const items: HelpBlock[] = [...sections, { id: 'help-version', title: 'Version', body: version }];
  if (tv) {
    return (
      <TvHelp
        items={items}
        accent={accent}
        titleSize={titleSize}
        bodySize={bodySize}
        bodyLine={bodyLine}
        pageSize={pageSize}
        paddingHorizontal={paddingHorizontal}
        paddingTop={paddingTop}
        paddingBottom={paddingBottom}
      />
    );
  }
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{
        paddingHorizontal,
        paddingTop,
        paddingBottom,
        gap: 22,
      }}
    >
      <Text style={[styles.pageTitle, { color: accent, fontSize: pageSize }]}>Help</Text>
      {items.map((section) => (
        <View key={section.id} testID={section.id}>
          <Text style={[styles.title, { color: accent, fontSize: titleSize, lineHeight: titleSize + 6 }]}>{section.title}</Text>
          <Text style={[styles.body, { color: chrome.text, fontSize: bodySize, lineHeight: bodyLine }]}>{section.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

/**
 * Same shell as the WOD screen when the menu fits: a plain view, not a scroller,
 * and every row stretches the full width under the tab bar. The Help tab is the
 * rightmost tab, so a narrow left column leaves Down with nothing to land on.
 */
function TvHelp({
  items,
  accent,
  titleSize,
  bodySize,
  bodyLine,
  pageSize,
  paddingHorizontal,
  paddingTop,
  paddingBottom,
}: {
  items: HelpBlock[];
  accent: string;
  titleSize: number;
  bodySize: number;
  bodyLine: number;
  pageSize: number;
  paddingHorizontal: number;
  paddingTop: number;
  paddingBottom: number;
}) {
  const tabFocus = useTvTabFocus();
  const { width, height } = useWindowDimensions();
  const [tags, setTags] = useState<Record<string, TvFocusTag | null>>({});
  const [focusedId, setFocusedId] = useState(items[0]?.id ?? 'help-version');
  const links = helpNeighbors(items.map((item) => item.id));
  const focused = items.find((item) => item.id === focusedId) ?? items[0];
  const column = tvHelpColumn(width, height, items.length, pageSize);
  const remember = useCallback((id: string, tag: TvFocusTag | null) => {
    setTags((current) => (current[id] === tag ? current : { ...current, [id]: tag }));
  }, []);
  const readingLines = Math.max(2, Math.floor(column.readingHeight / Math.max(bodyLine, 1)));

  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal,
        paddingTop,
        paddingBottom,
      }}
      collapsable={false}
    >
      <Text style={[styles.pageTitle, { color: accent, fontSize: pageSize }]}>Help</Text>
      <View style={[styles.tvList, { gap: column.gap, marginTop: column.gap }]} collapsable={false}>
        {items.map((section) => {
          const link = links.find((item) => item.id === section.id);
          const self = tags[section.id] ?? null;
          return (
            <TvHelpRow
              key={section.id}
              section={section}
              accent={accent}
              titleSize={Math.max(18, Math.round(column.rowHeight * 0.46))}
              rowHeight={column.rowHeight}
              focusUp={link?.up == null ? (tabFocus?.upTag ?? null) : (tags[link.up] ?? null)}
              focusDown={link?.down == null ? self : (tags[link.down] ?? null)}
              onTag={remember}
              onFocus={() => setFocusedId(section.id)}
            />
          );
        })}
      </View>
      {focused ? (
        <View style={[styles.tvReading, { height: column.readingHeight }]}>
          <Text style={[styles.title, { color: accent, fontSize: titleSize, lineHeight: titleSize + 6 }]} numberOfLines={1}>
            {focused.title}
          </Text>
          <Text
            style={[styles.body, { color: chrome.text, fontSize: bodySize, lineHeight: bodyLine }]}
            numberOfLines={readingLines}
          >
            {focused.body}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function TvHelpRow({
  section,
  accent,
  titleSize,
  rowHeight,
  focusUp,
  focusDown,
  onTag,
  onFocus,
}: {
  section: HelpBlock;
  accent: string;
  titleSize: number;
  rowHeight: number;
  focusUp: TvFocusTag | null;
  focusDown: TvFocusTag | null;
  onTag: (id: string, tag: TvFocusTag | null) => void;
  onFocus: () => void;
}) {
  const [tag, onHost] = useTvFocusTag();
  useEffect(() => {
    onTag(section.id, tag);
  }, [onTag, section.id, tag]);
  return (
    <TvFocusPressable
      testID={section.id}
      accessibilityRole="button"
      accessibilityLabel={`${section.title}. ${section.body}`}
      scale={false}
      onHost={onHost}
      focusUp={focusUp}
      focusDown={focusDown}
      onFocus={onFocus}
      style={[styles.section, { minHeight: rowHeight, height: rowHeight, alignSelf: 'stretch' }]}
    >
      <Text
        numberOfLines={1}
        style={[styles.title, { color: accent, fontSize: titleSize, lineHeight: titleSize + 4 }]}
      >
        {section.title}
      </Text>
    </TvFocusPressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: chrome.bg },
  scroll: { flex: 1 },
  pageTitle: {
    fontFamily: 'Oswald',
    letterSpacing: 0.4,
  },
  tvList: {
    width: '100%',
    alignSelf: 'stretch',
  },
  tvReading: {
    width: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  section: {
    borderRadius: 16,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Oswald',
  },
  body: {
    fontFamily: 'OswaldMedium',
    marginTop: 4,
  },
});
