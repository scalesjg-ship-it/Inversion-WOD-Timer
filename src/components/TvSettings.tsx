import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';

import { BRAND_TEMPLATES, COLOR_PALETTES, paletteColors, paletteMatches, templateMatches, templatePatch } from '@/src/branding/palettes';
import type { BackgroundStyle, Branding, ClockWeight, LogoPlacement } from '@/src/branding/types';
import { TvLogoTransfer } from '@/src/branding/lan/TvLogoTransfer';
import { ColorPicker } from '@/src/components/ColorPicker';
import { TvFocusPressable, TvTextField } from '@/src/components/TvFocus';
import { useTvTabFocus, type TvFocusTag } from '@/src/components/TvTabFocus';
import { TvLogoUrl } from '@/src/components/TvLogoUrl';
import { TvToggle } from '@/src/components/ui';
import { chrome } from '@/src/theme/chrome';
import { scrollOffsetForFocus } from '@/src/tv/scroll';
import { nextSettingsFocus, tvSettingsGroups, tvSettingsMetrics } from '@/src/tv/settingsLayout';
import { useTvFocusTag } from '@/src/tv/useTvFocusTag';

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

const COLORS = [
  ['Work', 'color-work', 'workColor'],
  ['Rest', 'color-rest', 'restColor'],
  ['Lead-in', 'color-lead', 'leadInColor'],
  ['Warning', 'color-warning', 'warningColor'],
  ['Digits', 'color-digits', 'digitColor'],
  ['Background', 'color-background', 'backgroundColor'],
  ['Accent', 'color-ui', 'uiColor'],
] as const;

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
  const [advanced, setAdvanced] = useState(false);
  const [tags, setTags] = useState<Record<string, TvFocusTag | null>>({});
  const [name, setName] = useState(branding.gymName);
  const [trackedName, setTrackedName] = useState(branding.gymName);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  const viewport = useRef(0);
  const places = useRef<Record<string, { y: number; height: number }>>({});
  if (branding.gymName !== trackedName) {
    setTrackedName(branding.gymName);
    setName(branding.gymName);
  }

  const templateIds = BRAND_TEMPLATES.map((template) => `template-${template.id}`);
  const paletteIds = COLOR_PALETTES.map((palette) => `palette-${palette.id}`);
  const groups = tvSettingsGroups(templateIds, paletteIds, advanced);
  const remember = useCallback((id: string, tag: TvFocusTag | null) => {
    setTags((current) => (current[id] === tag ? current : { ...current, [id]: tag }));
  }, []);
  const tagFor = (id: string | null) => (id ? tags[id] ?? null : tabFocus?.upTag ?? null);

  const reveal = (id: string) => {
    const place = places.current[id];
    if (!place) return;
    const next = scrollOffsetForFocus(place.y, place.height, viewport.current, offset.current);
    if (next === offset.current) return;
    offset.current = next;
    scrollRef.current?.scrollTo({ y: next, animated: true });
  };

  const choice = (id: string, label: string, selected: boolean, onPress: () => void, basis?: `${number}%`) => (
    <SettingChoice
      key={id}
      id={id}
      label={label}
      selected={selected}
      accent={accent}
      rowHeight={metrics.row}
      basis={basis}
      onPress={onPress}
      onTag={remember}
      onFocus={() => reveal(id)}
      focusUp={tagFor(nextSettingsFocus(id, 'up', groups))}
      focusDown={tagFor(nextSettingsFocus(id, 'down', groups))}
      focusLeft={tagFor(nextSettingsFocus(id, 'left', groups))}
      focusRight={tagFor(nextSettingsFocus(id, 'right', groups))}
    />
  );

  return (
    <ScrollView
      ref={scrollRef}
      testID="screen-settings"
      style={styles.scroll}
      contentContainerStyle={{
        paddingHorizontal: metrics.padH,
        paddingTop: metrics.padV,
        paddingBottom: metrics.padV,
        gap: metrics.gap,
      }}
      onLayout={(event) => {
        viewport.current = event.nativeEvent.layout.height;
      }}
      onScroll={(event) => {
        offset.current = event.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
    >
      <Text style={[styles.title, { fontSize: metrics.title, lineHeight: metrics.title + 6, color: accent }]}>Settings</Text>
      <Text style={[styles.header, { fontSize: metrics.header, lineHeight: metrics.header + 4 }]}>Brand</Text>
      <View
        style={[styles.row, { minHeight: metrics.row }]}
        onLayout={(event) => {
          places.current['brand-name'] = { y: event.nativeEvent.layout.y, height: event.nativeEvent.layout.height };
        }}
      >
        <Text style={[styles.rowLabel, { fontSize: Math.max(16, metrics.header - 4) }]}>Gym name</Text>
        <TvTextField
          testID="brand-name"
          focusUp={tagFor(nextSettingsFocus('brand-name', 'up', groups))}
          focusDown={tagFor(nextSettingsFocus('brand-name', 'down', groups))}
          value={name}
          onChangeText={setName}
          onFocus={() => reveal('brand-name')}
          onEndEditing={() => {
            const next = name.trim().slice(0, 48);
            if (!next) {
              setName(branding.gymName);
              return;
            }
            void update({ gymName: next });
          }}
          style={[styles.name, { minHeight: metrics.row - 8, fontSize: Math.max(18, metrics.header - 2) }]}
          maxLength={48}
        />
      </View>
      <Text style={[styles.header, { fontSize: metrics.header, lineHeight: metrics.header + 4 }]}>Look</Text>
      <View style={styles.choices}>
        {BRAND_TEMPLATES.map((template) =>
          choice(`template-${template.id}`, template.name, templateMatches(branding, template), () => {
            const patch = templatePatch(template);
            if (patch) void update(patch);
          }, '18%'),
        )}
      </View>
      <View style={styles.choices}>
        {PLACEMENTS.map((placement) =>
          choice(`placement-${placement.id}`, placement.label, branding.logoPlacement === placement.id, () => {
            void update({ logoPlacement: placement.id });
          }),
        )}
      </View>
      <Text style={[styles.header, { fontSize: metrics.header, lineHeight: metrics.header + 4 }]}>Display</Text>
      <View style={styles.choices}>
        {BACKGROUNDS.map((style) =>
          choice(`background-${style.id}`, style.label, branding.backgroundStyle === style.id, () => {
            void update({ backgroundStyle: style.id });
          }),
        )}
      </View>
      <View style={styles.choices}>
        {CLOCKS.map((weight) =>
          choice(`clock-${weight.id}`, weight.label, branding.clockWeight === weight.id, () => {
            void update({ clockWeight: weight.id });
          }),
        )}
      </View>
      {choice('settings-more', advanced ? 'Hide more' : 'More', advanced, () => setAdvanced((current) => !current))}
      {advanced ? (
        <View style={{ gap: metrics.gap }} testID="settings-advanced">
          <Text style={[styles.header, { fontSize: metrics.header, lineHeight: metrics.header + 4 }]}>Colors</Text>
          <View style={styles.choices}>
            {COLOR_PALETTES.map((palette) =>
              choice(`palette-${palette.id}`, palette.name, paletteMatches(branding, palette), () => {
                void update(paletteColors(palette));
              }),
            )}
          </View>
          {COLORS.map(([label, testID, key]) => (
            <ColorPicker
              key={testID}
              label={label}
              testID={testID}
              value={branding[key]}
              compact
              onChange={(next) => void update({ [key]: next })}
            />
          ))}
          <Text style={[styles.header, { fontSize: metrics.header, lineHeight: metrics.header + 4 }]}>Logo</Text>
          <TvLogoTransfer branding={branding} update={async (patch) => update(patch)} accent={accent}>
            <TvLogoUrl onStored={async (logoUri) => update({ logoUri })} />
            <TvToggle
              label="Blur the full-bleed logo"
              value={branding.logoBlur}
              onValueChange={(logoBlur) => void update({ logoBlur })}
              disabled={branding.logoPlacement !== 'fullBleed'}
              testID="logo-blur"
              accent={accent}
            />
          </TvLogoTransfer>
          <SettingChoice
            id="reset-brand"
            label="Reset to Inversion"
            selected={false}
            accent="#FF8A7A"
            rowHeight={metrics.row}
            onPress={() => void reset()}
            onTag={remember}
            onFocus={() => reveal('reset-brand')}
            focusUp={null}
            focusDown={null}
            focusLeft={null}
            focusRight={null}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

function SettingChoice({
  id,
  label,
  selected,
  accent,
  rowHeight,
  basis,
  onPress,
  onTag,
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
  rowHeight: number;
  basis?: `${number}%`;
  onPress: () => void;
  onTag: (id: string, tag: TvFocusTag | null) => void;
  onFocus: () => void;
  focusUp: TvFocusTag | null;
  focusDown: TvFocusTag | null;
  focusLeft: TvFocusTag | null;
  focusRight: TvFocusTag | null;
}) {
  const [tag, onHost] = useTvFocusTag();
  useEffect(() => {
    onTag(id, tag);
  }, [id, onTag, tag]);
  return (
    <TvFocusPressable
      testID={id}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accent={accent}
      onHost={onHost}
      onPress={onPress}
      onFocus={onFocus}
      focusUp={focusUp}
      focusDown={focusDown}
      focusLeft={focusLeft}
      focusRight={focusRight}
      style={({ pressed }) => [
        styles.choice,
        {
          minHeight: rowHeight,
          width: basis,
          flexGrow: 0,
          borderColor: selected ? accent : chrome.line,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={[styles.choiceLabel, { fontSize: Math.max(16, Math.round(rowHeight * 0.34)) }]} numberOfLines={1}>
        {label}
      </Text>
    </TvFocusPressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: chrome.bg },
  title: { fontFamily: 'Oswald' },
  header: {
    fontFamily: 'OswaldMedium',
    color: chrome.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { width: 140, fontFamily: 'OswaldMedium', color: chrome.text },
  name: {
    flex: 1,
    color: chrome.text,
    fontFamily: 'Oswald',
    borderWidth: 2,
    borderColor: chrome.line,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  choiceLabel: { fontFamily: 'OswaldMedium', color: chrome.text },
});
