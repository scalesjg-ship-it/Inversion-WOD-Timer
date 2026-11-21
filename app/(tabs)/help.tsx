import Constants from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor } from '@/src/branding/color';
import { RouteErrorBoundary } from '@/src/components/RouteErrorBoundary';
import { TvFocusPressable } from '@/src/components/TvFocus';
import { useTvTabFocus, type TvFocusTag } from '@/src/components/TvTabFocus';
import { helpNeighbors, helpPlatform, helpSections, helpVersionLine, type HelpBlock } from '@/src/help/copy';
import { chrome } from '@/src/theme/chrome';
import { tvSafeBox, tvScaled } from '@/src/tv/layout';
import { scrollOffsetForFocus } from '@/src/tv/scroll';
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
  const tabFocus = useTvTabFocus();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  const viewport = useRef(0);
  const places = useRef<Record<string, { y: number; height: number }>>({});
  const [tags, setTags] = useState<Record<string, TvFocusTag | null>>({});
  const ids = [...sections.map((section) => section.id), 'help-version'];
  const links = helpNeighbors(ids);
  const remember = useCallback((id: string, tag: TvFocusTag | null) => {
    setTags((current) => (current[id] === tag ? current : { ...current, [id]: tag }));
  }, []);

  const reveal = (id: string) => {
    const place = places.current[id];
    if (!place) return;
    const next = scrollOffsetForFocus(place.y, place.height, viewport.current, offset.current);
    if (next === offset.current) return;
    offset.current = next;
    scrollRef.current?.scrollTo({ y: next, animated: true });
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={{
        paddingHorizontal,
        paddingTop,
        paddingBottom,
        gap: tv ? 18 : 22,
      }}
      onLayout={(event) => {
        viewport.current = event.nativeEvent.layout.height;
      }}
      onScroll={(event) => {
        offset.current = event.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
    >
      <Text style={[styles.pageTitle, { color: accent, fontSize: pageSize }]}>Help</Text>
      {sections.map((section) => {
        const link = links.find((item) => item.id === section.id);
        return (
          <HelpSection
            key={section.id}
            section={section}
            tv={tv}
            accent={accent}
            titleSize={titleSize}
            bodySize={bodySize}
            bodyLine={bodyLine}
            focusUp={link?.up == null ? (tabFocus?.upTag ?? null) : (tags[link.up] ?? null)}
            focusDown={link?.down == null || link.down === section.id ? (tags[section.id] ?? null) : (tags[link.down] ?? null)}
            onTag={remember}
            onFocus={() => reveal(section.id)}
            onLayout={(y, height) => {
              places.current[section.id] = { y, height };
            }}
          />
        );
      })}
      <HelpSection
        section={{ id: 'help-version', title: 'Version', body: version }}
        tv={tv}
        accent={accent}
        titleSize={titleSize}
        bodySize={bodySize}
        bodyLine={bodyLine}
        focusUp={tags[links[links.length - 1]?.up ?? ''] ?? null}
        focusDown={tags['help-version'] ?? null}
        onTag={remember}
        onFocus={() => reveal('help-version')}
        onLayout={(y, height) => {
          places.current['help-version'] = { y, height };
        }}
      />
    </ScrollView>
  );
}

function HelpSection({
  section,
  tv,
  accent,
  titleSize,
  bodySize,
  bodyLine,
  focusUp,
  focusDown,
  onTag,
  onFocus,
  onLayout,
}: {
  section: HelpBlock;
  tv: boolean;
  accent: string;
  titleSize: number;
  bodySize: number;
  bodyLine: number;
  focusUp: TvFocusTag | null;
  focusDown: TvFocusTag | null;
  onTag: (id: string, tag: TvFocusTag | null) => void;
  onFocus: () => void;
  onLayout: (y: number, height: number) => void;
}) {
  const [tag, onHost] = useTvFocusTag();
  useEffect(() => {
    onTag(section.id, tag);
  }, [onTag, section.id, tag]);
  const body = (
    <View>
      <Text style={[styles.title, { color: accent, fontSize: titleSize, lineHeight: titleSize + 6 }]}>{section.title}</Text>
      <Text style={[styles.body, { color: chrome.text, fontSize: bodySize, lineHeight: bodyLine }]}>{section.body}</Text>
    </View>
  );
  if (!tv) {
    return (
      <View
        testID={section.id}
        onLayout={(event) => onLayout(event.nativeEvent.layout.y, event.nativeEvent.layout.height)}
      >
        {body}
      </View>
    );
  }
  return (
    <View onLayout={(event) => onLayout(event.nativeEvent.layout.y, event.nativeEvent.layout.height)}>
      <TvFocusPressable
        testID={section.id}
        accessibilityRole="button"
        accessibilityLabel={`${section.title}. ${section.body}`}
        scale={false}
        onHost={onHost}
        focusUp={focusUp}
        focusDown={focusDown}
        onFocus={onFocus}
        style={styles.section}
      >
        {body}
      </TvFocusPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: chrome.bg },
  scroll: { flex: 1 },
  pageTitle: {
    fontFamily: 'Oswald',
    letterSpacing: 0.4,
  },
  section: {
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  title: {
    fontFamily: 'Oswald',
  },
  body: {
    fontFamily: 'OswaldMedium',
    marginTop: 4,
  },
});
