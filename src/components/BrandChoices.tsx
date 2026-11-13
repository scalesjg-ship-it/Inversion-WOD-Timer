import { Platform, StyleSheet, Text, View } from 'react-native';

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
import { TV_FOCUS_BORDER } from '@/src/tv/controls';
import { tvColumnBasis } from '@/src/tv/layout';

export function BrandChoices({
  branding,
  onChange,
}: {
  branding: Branding;
  onChange: (patch: Partial<Branding>) => void;
}) {
  const tv = Platform.isTV === true;
  const columns = tv ? 3 : 2;
  return (
    <View style={styles.block}>
      <Text style={[styles.label, tv && styles.labelTv]}>Color templates</Text>
      <Text style={[styles.help, tv && styles.helpTv]}>
        One press sets the colors, clock, and logo placement. You can still change any color below.
      </Text>
      <View style={[styles.templates, tv && styles.templatesTv]}>
        {BRAND_TEMPLATES.map((template) => (
          <View
            key={template.id}
            style={
              tv
                ? { width: tvColumnBasis(columns), maxWidth: tvColumnBasis(columns), padding: 6 }
                : styles.templateCell
            }
          >
            <TemplateCard
              template={template}
              selected={templateMatches(branding, template)}
              onPress={() => {
                const patch = templatePatch(template);
                if (patch) onChange(patch);
              }}
            />
          </View>
        ))}
      </View>
      <Text style={[styles.label, tv && styles.labelTv]}>Color sets</Text>
      <Text style={[styles.help, tv && styles.helpTv]}>Colors only. The logo placement stays as it is.</Text>
      <View style={styles.chips}>
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
    </View>
  );
}

function TemplateCard({
  template,
  selected,
  onPress,
}: {
  template: BrandTemplate;
  selected: boolean;
  onPress: () => void;
}) {
  const tv = Platform.isTV === true;
  const palette = COLOR_PALETTES.find((item) => item.id === template.paletteId);
  return (
    <TvFocusPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={`template-${template.id}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        tv && styles.cardTv,
        {
          width: '100%',
          borderColor: chrome.line,
          opacity: pressed ? 0.8 : 1,
          borderWidth: tv ? TV_FOCUS_BORDER : 1,
        },
      ]}
    >
      {selected ? <View pointerEvents="none" style={[styles.innerRing, tv && styles.innerRingTv]} /> : null}
      <View style={styles.cardTop}>
        <Text style={[styles.cardName, tv && styles.cardNameTv]} numberOfLines={1}>
          {template.name}
        </Text>
        {selected ? <Text style={[styles.mark, tv && styles.markTv]}>✓</Text> : null}
      </View>
      <View style={styles.dots}>
        <View style={[styles.dot, { backgroundColor: palette?.digitColor ?? chrome.text }]} />
        <View style={[styles.dot, { backgroundColor: palette?.backgroundColor ?? chrome.bg }]} />
        <View style={[styles.dot, { backgroundColor: palette?.uiColor ?? chrome.text }]} />
      </View>
      <Text style={[styles.blurb, tv && styles.blurbTv]} numberOfLines={2}>
        {template.blurb}
      </Text>
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
