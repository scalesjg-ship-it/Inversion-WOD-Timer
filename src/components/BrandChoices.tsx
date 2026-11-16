import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import {
  BRAND_TEMPLATES,
  COLOR_PALETTES,
  paletteColors,
  paletteMatches,
  templateMatches,
  templatePatch,
  type BrandTemplate,
} from '@/src/branding/palettes';
import type { Branding } from '@/src/branding/types';
import { TvFocusPressable } from '@/src/components/TvFocus';
import { Chip } from '@/src/components/ui';
import { chrome } from '@/src/theme/chrome';
import { fitTvStyle, tvScaled, tvTemplateLabelBox, type TvHomeLayout } from '@/src/tv/layout';

export function BrandChoices({
  branding,
  onChange,
  part = 'all',
  focusUp = null,
}: {
  branding: Branding;
  onChange: (patch: Partial<Branding>) => void;
  part?: 'all' | 'templates' | 'palettes';
  /** TV tag of the tab bar. The first template sends Up there. */
  focusUp?: number | null;
}) {
  const tv = Platform.isTV === true;
  const { width, height } = useWindowDimensions();
  const gutter = tv ? tvScaled(6, width, height) : 0;
  const showTemplates = part === 'all' || part === 'templates';
  const showPalettes = part === 'all' || part === 'palettes';
  return (
    <View style={tv ? fitTvStyle(styles.block, width, height) : styles.block}>
      {showTemplates ? (
        <>
          <Text style={[tv ? fitTvStyle(styles.label, width, height) : styles.label, tv && { color: chrome.muted, fontSize: tvScaled(20, width, height), letterSpacing: 1.2 }]}>Color templates</Text>
          {tv ? null : (
          <Text style={styles.help}>
            One press sets the colors, clock, and logo placement. You can still change any color below.
          </Text>
          )}
          <View style={[styles.templates, tv && styles.templatesTv]}>
            {BRAND_TEMPLATES.map((template, index) => (
              <View
                key={template.id}
                style={
                  tv
                    ? {
                        width: '50%',
                        maxWidth: '50%',
                        padding: gutter,
                      }
                    : styles.templateCell
                }
              >
                <TemplateCard
                  template={template}
                  frame={null}
                  compact={tv}
                  selected={templateMatches(branding, template)}
                  focusUp={index === 0 ? focusUp : null}
                  onPress={() => {
                    const patch = templatePatch(template);
                    if (patch) onChange(patch);
                  }}
                />
              </View>
            ))}
          </View>
        </>
      ) : null}
      {showPalettes ? (
        <>
          <Text style={[tv ? fitTvStyle(styles.label, width, height) : styles.label, tv && { color: chrome.muted, fontSize: tvScaled(20, width, height), letterSpacing: 1.2 }]}>Color sets</Text>
          {tv ? null : <Text style={styles.help}>Colors only. The logo placement stays as it is.</Text>}
          <View style={[styles.chips, tv && styles.chipsTv]}>
            {COLOR_PALETTES.map((palette) => (
              <Chip
                key={palette.id}
                label={palette.name}
                color={palette.uiColor}
                selected={paletteMatches(branding, palette)}
                onPress={() => onChange(paletteColors(palette))}
                testID={`palette-${palette.id}`}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function TemplateCard({
  template,
  frame,
  compact = false,
  selected,
  onPress,
  focusUp = null,
}: {
  template: BrandTemplate;
  frame: TvHomeLayout | null;
  compact?: boolean;
  selected: boolean;
  onPress: () => void;
  focusUp?: number | null;
}) {
  const tv = Platform.isTV === true;
  const { width, height } = useWindowDimensions();
  const box = compact ? tvTemplateLabelBox(width, height) : null;
  const palette = COLOR_PALETTES.find((item) => item.id === template.paletteId);
  return (
    <TvFocusPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={`template-${template.id}`}
      focusUp={focusUp}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        box
          ? {
              minHeight: box.height,
              height: box.height,
              borderRadius: tvScaled(10, width, height),
              padding: 0,
              paddingTop: box.padY,
              paddingBottom: box.padY,
              paddingHorizontal: box.padX,
              gap: 0,
              justifyContent: 'center',
            }
          : null,
        {
          width: '100%',
          borderColor: chrome.line,
          opacity: pressed ? 0.8 : 1,
          borderWidth: box ? box.border : tv ? tvScaled(5, width, height) : 1,
        },
      ]}
    >
      {selected && !box ? <View pointerEvents="none" style={[styles.innerRing, tv && styles.innerRingTv]} /> : null}
      <View style={[styles.cardTop, box ? { height: box.lineHeight, alignItems: 'center' } : null]}>
        <Text
          testID={`template-name-${template.id}`}
          style={[
            styles.cardName,
            { color: chrome.text, backgroundColor: 'transparent' },
            box
              ? {
                  fontSize: box.fontSize,
                  lineHeight: box.lineHeight,
                  includeFontPadding: false,
                }
              : null,
          ]}
          numberOfLines={1}
        >
          {template.name}
        </Text>
        {selected ? (
          <Text
            style={[
              styles.mark,
              tv && !box ? styles.markTv : null,
              box ? { fontSize: box.fontSize, lineHeight: box.lineHeight } : null,
            ]}
          >
            ✓
          </Text>
        ) : null}
      </View>
      {compact ? null : (
        <View style={styles.dots}>
          <View style={[styles.dot, { backgroundColor: palette?.digitColor ?? chrome.text }]} />
          <View style={[styles.dot, { backgroundColor: palette?.backgroundColor ?? chrome.bg }]} />
          <View style={[styles.dot, { backgroundColor: palette?.uiColor ?? chrome.text }]} />
        </View>
      )}
      {compact ? null : (
      <Text style={[styles.blurb, { color: chrome.muted }]} numberOfLines={3}>
        {template.blurb}
      </Text>
      )}
    </TvFocusPressable>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  label: {
    marginTop: 8,
    color: chrome.muted,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: 'OswaldMedium',
  },
  labelTv: {
    fontSize: 28,
    letterSpacing: 2,
  },
  help: {
    color: chrome.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  helpTv: {
    fontSize: 22,
    lineHeight: 28,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipsTv: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  templates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  templatesTv: {
    gap: 0,
  },
  templateCell: {
    width: '48%',
    flexGrow: 1,
  },
  card: {
    minHeight: 108,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: chrome.surface,
    padding: 12,
    gap: 8,
    overflow: 'hidden',
  },
  cardTv: {
    minHeight: 128,
    borderRadius: 18,
    padding: 12,
    gap: 6,
  },
  innerRing: {
    position: 'absolute',
    top: 5,
    right: 5,
    bottom: 5,
    left: 5,
    borderWidth: 2,
    borderColor: '#F4F7FB',
    borderRadius: 12,
  },
  innerRingTv: {
    top: 8,
    right: 8,
    bottom: 8,
    left: 8,
    borderWidth: 4,
    borderRadius: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardName: {
    flex: 1,
    color: chrome.text,
    fontFamily: 'Oswald',
    fontSize: 18,
  },
  cardNameTv: {
    fontSize: 26,
  },
  mark: {
    color: chrome.text,
    fontFamily: 'Oswald',
    fontSize: 18,
  },
  markTv: {
    fontSize: 28,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: chrome.line,
  },
  blurb: {
    color: chrome.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  blurbTv: {
    fontSize: 16,
    lineHeight: 20,
  },
});
