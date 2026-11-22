import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactElement } from 'react';
import {
  BackHandler,
  findNodeHandle,
  ScrollView,
  StyleSheet,
  Text,
  TVEventControl,
  TVFocusGuideView,
  useTVEventHandler,
  useWindowDimensions,
  View,
} from 'react-native';

import { BRAND_TEMPLATES, COLOR_PALETTES, paletteColors, paletteMatches, templateMatches, templatePatch } from '@/src/branding/palettes';
import type { BackgroundStyle, Branding, ClockWeight, LogoPlacement } from '@/src/branding/types';
import { TvLogoTransfer } from '@/src/branding/lan/TvLogoTransfer';
import { ColorPicker } from '@/src/components/ColorPicker';
import { TvFocusPressable, TvTextField } from '@/src/components/TvFocus';
import { requestTvFocus, useTvTabFocus, type TvFocusTag } from '@/src/components/TvTabFocus';
import { TvLogoUrl } from '@/src/components/TvLogoUrl';
import { TvToggle } from '@/src/components/ui';
import { chrome } from '@/src/theme/chrome';
import { scrollOffsetForFocus } from '@/src/tv/scroll';
import { acceptRemotePress } from '@/src/tv/keyAction';
import {
  settingsAction,
  settingsBackTab,
  settingsCategoryRows,
  settingsColorToggleId,
  settingsDetailTestId,
  settingsNeighbor,
  TV_SETTINGS_CATEGORIES,
  tvSettingsMetrics,
  type SettingsCategoryId,
  type SettingsNeighbor,
  type SettingsPlace,
  type SettingsRow,
} from '@/src/tv/settingsLayout';
import { TV_TAB_ROUTES } from '@/src/tv/tabFocus';

const Guide = TVFocusGuideView ?? View;

const PLACEMENTS: { id: LogoPlacement; label: string }[] = [
  { id: 'watermark', label: 'Watermark' },
  { id: 'fullBleed', label: 'Full bleed' },
  { id: 'corner', label: 'Corner' },
];

const BACKGROUNDS: { id: BackgroundStyle; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'vignette', label: 'Vignette' },
  { id: 'edge', label: 'Edge' },
];

const CLOCKS: { id: ClockWeight; label: string }[] = [
  { id: 'bold', label: 'Bold' },
  { id: 'regular', label: 'Regular' },
];

const COLOR_FIELDS = [
  ['Work', 'color-work', 'workColor'],
  ['Rest', 'color-rest', 'restColor'],
  ['Lead-in', 'color-lead', 'leadInColor'],
  ['Warning', 'color-warning', 'warningColor'],
  ['Digits', 'color-digits', 'digitColor'],
  ['Background', 'color-background', 'backgroundColor'],
  ['Accent', 'color-ui', 'uiColor'],
] as const;

const SETTINGS_TAB = TV_TAB_ROUTES.findIndex((tab) => tab.testID === 'tab-settings');

function readHostTag(node: unknown): TvFocusTag | null {
  if (!node || (typeof node !== 'object' && typeof node !== 'function')) return null;
  try {
    const tag = findNodeHandle(node as never);
    return typeof tag === 'number' ? tag : null;
  } catch {
    return null;
  }
}

function settingsRows(): SettingsRow[][] {
  return settingsCategoryRows(
    BRAND_TEMPLATES.map((template) => `template-${template.id}`),
    COLOR_PALETTES.map((palette) => `palette-${palette.id}`),
  );
}

/** One Back press can arrive as both a menu event and a hardware back. */
function takeBack(lastBack: { current: number }): boolean {
  const now = Date.now();
  if (now - lastBack.current < 400) return false;
  lastBack.current = now;
  return true;
}

function visualLines(groups: readonly SettingsRow[]): { key: string; ids: string[] }[] {
  const lines: { key: string; ids: string[] }[] = [];
  groups.forEach((group, groupIndex) => {
    const columns = Math.max(1, group.columns);
    for (let start = 0; start < group.ids.length; start += columns) {
      lines.push({ key: `${groupIndex}-${start}`, ids: group.ids.slice(start, start + columns) });
    }
  });
  return lines;
}

/**
 * TV settings is a sidebar and one category's options.
 * Up from the first category targets the Settings tab, because the sidebar
 * sits under WOD. Left from the leftmost option returns to the open category.
 * Back from an option returns to the sidebar. Back from the sidebar opens the
 * previous tab and stays in the app.
 */
export function TvSettings({
  branding,
  accent,
  update,
  reset,
}: {
  branding: Branding;
  accent: string;
  update: (patch: Partial<Branding>) => Promise<void> | void;
  reset: () => Promise<void> | void;
}) {
  const { width, height } = useWindowDimensions();
  const metrics = tvSettingsMetrics(width, height);
  const tabFocus = useTvTabFocus();
  const tabFocusRef = useRef(tabFocus);
  const [selected, setSelected] = useState(0);
  const [name, setName] = useState(branding.gymName);
  const [trackedName, setTrackedName] = useState(branding.gymName);
  const [tags, setTags] = useState<Record<string, TvFocusTag | null>>({});
  const [paneWidth, setPaneWidth] = useState(0);
  const hosts = useRef<Record<string, unknown>>({});
  const placeRef = useRef<SettingsPlace>({ zone: 'sidebar', index: 0 });
  const lastBack = useRef(0);
  const pendingDown = useRef(new Set<string>());
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const offset = useRef(0);
  const viewport = useRef(0);
  const places = useRef<Record<string, { y: number; height: number }>>({});
  if (branding.gymName !== trackedName) {
    setTrackedName(branding.gymName);
    setName(branding.gymName);
  }

  const categoryRows = settingsRows();
  useEffect(() => {
    tabFocusRef.current = tabFocus;
  }, [tabFocus]);
  const category = TV_SETTINGS_CATEGORIES[selected] ?? TV_SETTINGS_CATEGORIES[0];
  const selectedTag = tags[category.testID] ?? null;

  const bind = useCallback((id: string, node: unknown) => {
    hosts.current[id] = node;
    const apply = (tag: TvFocusTag | null) => {
      setTags((current) => (current[id] === tag ? current : { ...current, [id]: tag }));
    };
    const tag = readHostTag(node);
    apply(tag);
    if (node && tag == null) requestAnimationFrame(() => apply(readHostTag(hosts.current[id])));
  }, []);

  const tagFor = useCallback(
    (neighbor: SettingsNeighbor, selfId: string): TvFocusTag | null => {
      switch (neighbor.zone) {
        case 'tab':
          return tabFocus?.upTag ?? null;
        case 'self':
          return tags[selfId] ?? null;
        case 'sidebar':
          return tags[TV_SETTINGS_CATEGORIES[neighbor.index]?.testID ?? ''] ?? null;
        case 'detail':
          return tags[neighbor.id] ?? null;
        default: {
          const unexpected: never = neighbor;
          return unexpected;
        }
      }
    },
    [tabFocus?.upTag, tags],
  );

  const linksFor = (place: SettingsPlace, selfId: string) => {
    const up = settingsNeighbor(place, 'up', categoryRows);
    const down = settingsNeighbor(place, 'down', categoryRows);
    const left = settingsNeighbor(place, 'left', categoryRows);
    const right = settingsNeighbor(place, 'right', categoryRows);
    return {
      focusUp: tagFor(up, selfId),
      focusDown: tagFor(down, selfId),
      focusLeft: tagFor(left, selfId),
      focusRight: tagFor(right, selfId),
    };
  };

  const reveal = (id: string) => {
    const place = places.current[id];
    if (!place) return;
    const next = scrollOffsetForFocus(place.y, place.height, viewport.current, offset.current);
    if (next === offset.current) return;
    offset.current = next;
    scrollRef.current?.scrollTo({ y: next, animated: true });
  };

  const rememberPlace = useCallback((id: string, y: number, height: number) => {
    places.current[id] = { y, height };
  }, []);

  const focusDetail = (index: number) => {
    const action = settingsAction({ zone: 'sidebar', index }, 'select', settingsRows());
    if (action.zone !== 'detail') return;
    requestTvFocus(hosts.current[action.id]);
    placeRef.current = { zone: 'detail', index, id: action.id };
  };

  const leaveSettings = useCallback(() => {
    const focus = tabFocusRef.current;
    const count = TV_TAB_ROUTES.length;
    const target = settingsBackTab(focus?.selectedTab ?? SETTINGS_TAB, focus?.previousTab ?? 0, count);
    const route = TV_TAB_ROUTES[target];
    if (focus?.focusTab(target)) return;
    if (route) router.navigate(route.path as Href);
  }, []);

  const handleBack = useCallback(() => {
    if (!takeBack(lastBack)) return;
    const action = settingsAction(placeRef.current, 'back', settingsRows());
    if (action.zone === 'sidebar') {
      const id = TV_SETTINGS_CATEGORIES[action.index]?.testID;
      if (id) requestTvFocus(hosts.current[id]);
      placeRef.current = { zone: 'sidebar', index: action.index };
      setSelected(action.index);
      return;
    }
    if (action.zone === 'leave') leaveSettings();
  }, [leaveSettings]);

  useFocusEffect(
    useCallback(() => {
      TVEventControl?.enableTVMenuKey();
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });
      return () => {
        subscription.remove();
        TVEventControl?.disableTVMenuKey();
      };
    }, [handleBack]),
  );

  useTVEventHandler((event) => {
    if (event.eventType !== 'menu' && event.eventType !== 'back') return;
    const decision = acceptRemotePress(
      event.eventType,
      event.eventKeyAction as number | string | undefined,
      pendingDown.current,
    );
    pendingDown.current = decision.pendingDown;
    if (!decision.accept) return;
    handleBack();
  });

  const reportEntry = tabFocus?.reportEntry;
  useEffect(() => {
    reportEntry?.(SETTINGS_TAB, selectedTag);
  }, [reportEntry, selectedTag]);
  useEffect(() => {
    return () => reportEntry?.(null, null);
  }, [reportEntry]);

  const onSidebar = (index: number) => {
    placeRef.current = { zone: 'sidebar', index };
    setSelected(index);
  };

  const onDetail = (id: string) => {
    placeRef.current = { zone: 'detail', index: selected, id };
    reveal(id);
  };

  const optionLinks = (id: string) => linksFor({ zone: 'detail', index: selected, id }, id);
  const lineWidth = (count: number) => {
    if (count <= 1 || paneWidth <= 0) return undefined;
    return Math.floor((paneWidth - metrics.gap * (count - 1)) / count);
  };

  const choice = (id: string, label: string, active: boolean, onPress: () => void, itemWidth: number | undefined) => (
    <SettingChoice
      key={id}
      id={id}
      label={label}
      selected={active}
      accent={accent}
      width={itemWidth}
      minHeight={Math.max(56, metrics.row - 16)}
      fontSize={metrics.body}
      onPress={onPress}
      onBind={bind}
      onFocus={() => onDetail(id)}
      {...optionLinks(id)}
    />
  );

  const entryDestinations = selectedTag != null ? [selectedTag] : [];
  const firstOption = settingsNeighbor({ zone: 'sidebar', index: selected }, 'right', categoryRows);
  const detailTag = firstOption.zone === 'detail' ? (tags[firstOption.id] ?? null) : null;
  const detailDestinations = detailTag != null ? [detailTag] : [];

  return (
    <View style={styles.screen} testID="screen-settings" collapsable={false}>
      <Guide
        style={[styles.split, { paddingHorizontal: metrics.padH, paddingVertical: metrics.padV, gap: metrics.gap }]}
        collapsable={false}
        {...(Guide === View ? null : { destinations: entryDestinations })}
      >
        <Guide
          style={[styles.sidebar, { width: metrics.sidebarWidth, gap: metrics.gap }]}
          collapsable={false}
          {...(Guide === View ? null : { destinations: entryDestinations, trapFocusLeft: true })}
        >
          <Text style={[styles.title, { fontSize: metrics.title, lineHeight: metrics.title + 6, color: accent }]}>Settings</Text>
          {TV_SETTINGS_CATEGORIES.map((item, index) => {
            const selfId = item.testID;
            const place: SettingsPlace = { zone: 'sidebar', index };
            const open = index === selected;
            return (
              <TvFocusPressable
                key={item.id}
                testID={item.testID}
                accessibilityRole="button"
                accessibilityState={{ selected: open }}
                accessibilityLabel={item.label}
                dim={false}
                scale={false}
                onHost={(node) => bind(selfId, node)}
                onFocus={() => onSidebar(index)}
                onPress={() => focusDetail(index)}
                {...linksFor(place, selfId)}
                style={{
                  minHeight: metrics.row,
                  justifyContent: 'center',
                  paddingHorizontal: 18,
                  borderRadius: 16,
                  backgroundColor: open ? chrome.surfaceRaised : 'transparent',
                }}
              >
                <View style={styles.sideRow}>
                  <View style={[styles.mark, { backgroundColor: open ? accent : 'transparent' }]} />
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: 'Oswald',
                      fontSize: metrics.label,
                      lineHeight: metrics.label + 6,
                      color: open ? chrome.text : chrome.muted,
                    }}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </View>
              </TvFocusPressable>
            );
          })}
        </Guide>
        <Guide
          style={styles.detail}
          collapsable={false}
          testID={settingsDetailTestId(category.id)}
          {...(Guide === View ? null : { destinations: detailDestinations, trapFocusUp: true, trapFocusDown: true, trapFocusRight: true })}
          onLayout={(event) => {
            const next = Math.round(event.nativeEvent.layout.width);
            setPaneWidth((current) => (current === next ? current : next));
          }}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.detailScroll}
            contentContainerStyle={{ gap: metrics.gap, paddingBottom: metrics.gap }}
            onLayout={(event) => {
              viewport.current = event.nativeEvent.layout.height;
            }}
            onScroll={(event) => {
              offset.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            <Text style={[styles.detailTitle, { fontSize: metrics.title, lineHeight: metrics.title + 4, color: accent }]}>
              {category.label}
            </Text>
            <DetailBody
              categoryId={category.id}
              branding={branding}
              accent={accent}
              name={name}
              setName={setName}
              update={update}
              reset={reset}
              metricsHeader={metrics.header}
              metricsBody={metrics.body}
              gap={metrics.gap}
              lineWidth={lineWidth}
              groups={categoryRows[selected] ?? []}
              rememberPlace={rememberPlace}
              choice={choice}
              optionLinks={optionLinks}
              bind={bind}
              onDetail={onDetail}
            />
          </ScrollView>
        </Guide>
      </Guide>
    </View>
  );
}

function DetailBody({
  categoryId,
  branding,
  accent,
  name,
  setName,
  update,
  reset,
  metricsHeader,
  metricsBody,
  gap,
  lineWidth,
  groups,
  rememberPlace,
  choice,
  optionLinks,
  bind,
  onDetail,
}: {
  categoryId: SettingsCategoryId;
  branding: Branding;
  accent: string;
  name: string;
  setName: (value: string) => void;
  update: (patch: Partial<Branding>) => Promise<void> | void;
  reset: () => Promise<void> | void;
  metricsHeader: number;
  metricsBody: number;
  gap: number;
  lineWidth: (count: number) => number | undefined;
  groups: readonly SettingsRow[];
  rememberPlace: (id: string, y: number, height: number) => void;
  choice: (id: string, label: string, active: boolean, onPress: () => void, itemWidth: number | undefined) => ReactElement;
  optionLinks: (id: string) => {
    focusUp: TvFocusTag | null;
    focusDown: TvFocusTag | null;
    focusLeft: TvFocusTag | null;
    focusRight: TvFocusTag | null;
  };
  bind: (id: string, node: unknown) => void;
  onDetail: (id: string) => void;
}) {
  const heading = (label: string) => (
    <Text key={label} style={[styles.header, { fontSize: metricsHeader, lineHeight: metricsHeader + 4 }]}>
      {label}
    </Text>
  );

  const lines = (title: string, group: SettingsRow | undefined, render: (id: string, itemWidth: number | undefined) => ReactElement) => {
    if (!group) return null;
    const rows = visualLines([group]);
    return (
      <View key={title} style={{ gap }}>
        {heading(title)}
        {rows.map((line) => (
          <View
            key={line.key}
            style={[styles.line, { gap }]}
            onLayout={(event) => {
              const next = event.nativeEvent.layout;
              for (const id of line.ids) rememberPlace(id, next.y, next.height);
            }}
          >
            {line.ids.map((id) => render(id, lineWidth(Math.max(1, group.columns))))}
          </View>
        ))}
      </View>
    );
  };

  switch (categoryId) {
    case 'brand':
      return (
        <View style={{ gap }}>
          {heading('Gym name')}
          <View
            onLayout={(event) => {
              const next = event.nativeEvent.layout;
              rememberPlace('brand-name', next.y, next.height);
            }}
          >
            <TvTextField
              testID="brand-name"
              value={name}
              onChangeText={setName}
              onHost={(node) => bind('brand-name', node)}
              onFocus={() => onDetail('brand-name')}
              {...optionLinks('brand-name')}
              onEndEditing={() => {
                const next = name.trim().slice(0, 48);
                if (!next) {
                  setName(branding.gymName);
                  return;
                }
                void update({ gymName: next });
              }}
              style={[styles.name, { minHeight: 64, fontSize: metricsBody }]}
              maxLength={48}
            />
          </View>
        </View>
      );
    case 'look':
      return (
        <View style={{ gap }}>
          {lines('Templates', groups[0], (id, itemWidth) => {
            const template = BRAND_TEMPLATES.find((item) => `template-${item.id}` === id);
            return choice(id, template?.name ?? id, template ? templateMatches(branding, template) : false, () => {
              if (!template) return;
              const patch = templatePatch(template);
              if (patch) void update(patch);
            }, itemWidth);
          })}
          {lines('Placement', groups[1], (id, itemWidth) => {
            const placement = PLACEMENTS.find((item) => `placement-${item.id}` === id);
            return choice(id, placement?.label ?? id, branding.logoPlacement === placement?.id, () => {
              if (placement) void update({ logoPlacement: placement.id });
            }, itemWidth);
          })}
        </View>
      );
    case 'display':
      return (
        <View style={{ gap }}>
          {lines('Background', groups[0], (id, itemWidth) => {
            const style = BACKGROUNDS.find((item) => `background-${item.id}` === id);
            return choice(id, style?.label ?? id, branding.backgroundStyle === style?.id, () => {
              if (style) void update({ backgroundStyle: style.id });
            }, itemWidth);
          })}
          {lines('Clock', groups[1], (id, itemWidth) => {
            const weight = CLOCKS.find((item) => `clock-${item.id}` === id);
            return choice(id, weight?.label ?? id, branding.clockWeight === weight?.id, () => {
              if (weight) void update({ clockWeight: weight.id });
            }, itemWidth);
          })}
        </View>
      );
    case 'colors':
      return (
        <View style={{ gap }}>
          {lines('Palettes', groups[0], (id, itemWidth) => {
            const palette = COLOR_PALETTES.find((item) => `palette-${item.id}` === id);
            return choice(id, palette?.name ?? id, palette ? paletteMatches(branding, palette) : false, () => {
              if (palette) void update(paletteColors(palette));
            }, itemWidth);
          })}
          {heading('Colors')}
          {COLOR_FIELDS.map(([label, testID, key]) => {
            const toggleId = settingsColorToggleId(testID);
            return (
              <View
                key={testID}
                onLayout={(event) => {
                  const next = event.nativeEvent.layout;
                  rememberPlace(toggleId, next.y, next.height);
                }}
              >
                <ColorPicker
                  label={label}
                  testID={testID}
                  value={branding[key]}
                  onChange={(next) => void update({ [key]: next })}
                  onHost={(node) => bind(toggleId, node)}
                  onFocus={() => onDetail(toggleId)}
                  {...optionLinks(toggleId)}
                />
              </View>
            );
          })}
        </View>
      );
    case 'logo': {
      const field = optionLinks('logo-url');
      const save = optionLinks('logo-url-load');
      const blur = optionLinks('logo-blur');
      const resetLinks = optionLinks('reset-brand');
      return (
        <View style={{ gap }}>
          <TvLogoTransfer branding={branding} update={async (patch) => update(patch)} accent={accent}>
            <TvLogoUrl
              onStored={async (logoUri) => update({ logoUri })}
              field={{
                ...field,
                onHost: (node) => bind('logo-url', node),
                onFocus: () => onDetail('logo-url'),
              }}
              save={{
                ...save,
                onHost: (node) => bind('logo-url-load', node),
                onFocus: () => onDetail('logo-url-load'),
              }}
            />
          </TvLogoTransfer>
          <TvToggle
            label="Blur the full-bleed logo"
            value={branding.logoBlur}
            onValueChange={(logoBlur) => void update({ logoBlur })}
            disabled={branding.logoPlacement !== 'fullBleed'}
            testID="logo-blur"
            accent={accent}
            onHost={(node) => bind('logo-blur', node)}
            onFocus={() => onDetail('logo-blur')}
            {...blur}
          />
          <SettingChoice
            id="reset-brand"
            label="Reset to Inversion"
            selected={false}
            accent="#FF8A7A"
            width={undefined}
            minHeight={Math.max(56, metricsBody + 28)}
            fontSize={metricsBody}
            onPress={() => void reset()}
            onBind={bind}
            onFocus={() => onDetail('reset-brand')}
            {...resetLinks}
          />
        </View>
      );
    }
    default: {
      const unexpected: never = categoryId;
      return unexpected;
    }
  }
}

function SettingChoice({
  id,
  label,
  selected,
  accent,
  width,
  minHeight,
  fontSize,
  onPress,
  onBind,
  onFocus,
  focusUp,
  focusDown,
  focusLeft,
  focusRight,
}: {
  id: string;
  label: string;
  selected: boolean;
  accent: string;
  width: number | undefined;
  minHeight: number;
  fontSize: number;
  onPress: () => void;
  onBind: (id: string, node: unknown) => void;
  onFocus: () => void;
  focusUp: TvFocusTag | null;
  focusDown: TvFocusTag | null;
  focusLeft: TvFocusTag | null;
  focusRight: TvFocusTag | null;
}) {
  return (
    <TvFocusPressable
      testID={id}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accent={accent}
      onHost={(node) => onBind(id, node)}
      onPress={onPress}
      onFocus={onFocus}
      focusUp={focusUp}
      focusDown={focusDown}
      focusLeft={focusLeft}
      focusRight={focusRight}
      style={{
        minHeight,
        width,
        flexGrow: width ? 0 : 1,
        borderRadius: 14,
        paddingHorizontal: 16,
        justifyContent: 'center',
        backgroundColor: selected ? chrome.surfaceRaised : chrome.surface,
        borderWidth: 2,
        borderColor: selected ? accent : chrome.line,
      }}
    >
      <Text style={{ fontFamily: 'OswaldMedium', fontSize, lineHeight: fontSize + 4, color: selected ? accent : chrome.text }} numberOfLines={1}>
        {label}
      </Text>
    </TvFocusPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: chrome.bg },
  split: { flex: 1, flexDirection: 'row' },
  sidebar: {
    borderRightWidth: 2,
    borderRightColor: chrome.line,
    paddingRight: 16,
  },
  detail: { flex: 1, minWidth: 0 },
  detailScroll: { flex: 1 },
  title: { fontFamily: 'Oswald' },
  detailTitle: { fontFamily: 'Oswald' },
  header: {
    fontFamily: 'OswaldMedium',
    color: chrome.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sideRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mark: { width: 8, alignSelf: 'stretch', borderRadius: 4, minHeight: 28 },
  line: { flexDirection: 'row', alignItems: 'stretch' },
  name: {
    color: chrome.text,
    fontFamily: 'Oswald',
    borderWidth: 2,
    borderColor: chrome.line,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: chrome.surface,
  },
});
