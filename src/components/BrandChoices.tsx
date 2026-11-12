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
import { TV_BODY_FONT, TV_SECTION_FONT } from '@/src/tv/layout';

export function BrandChoices({
  branding,
  onChange,
}: {
  branding: Branding;
  onChange: (patch: Partial<Branding>) => void;
}) {
  const tv = Platform.isTV === true;
  return (
    <View style={styles.block}>
      <Text style={[styles.label, tv && styles.labelTv]}>Palettes</Text>
      <Text style={[styles.help, tv && styles.helpTv]}>One tap sets the clock colors. You can still change any of them.</Text>
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
      <Text style={[styles.label, tv && styles.labelTv]}>Templates</Text>
      <Text style={[styles.help, tv && styles.helpTv]}>
        A template sets colors plus the clock weight, logo placement, and background.
      </Text>
      <View style={styles.templates}>
        {BRAND_TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            selected={templateMatches(branding, template)}
            onPress={() => {
              const patch = templatePatch(template);
              if (patch) onChange(patch);
            }}
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
        { borderColor: selected ? chrome.text : chrome.line, opacity: pressed ? 0.8 : 1 },
      ]}
    >
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
    fontSize: TV_SECTION_FONT,
    letterSpacing: 2,
  },
  help: {
    color: chrome.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  helpTv: {
    fontSize: TV_BODY_FONT,
    lineHeight: TV_BODY_FONT + 8,
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
  card: {
    width: '48%',
    flexGrow: 1,
    minHeight: 108,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: chrome.surface,
    padding: 12,
    gap: 8,
  },
  cardTv: {
    minHeight: 160,
    borderRadius: 22,
    borderWidth: 4,
    padding: 16,
    gap: 10,
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
    fontSize: 32,
  },
  mark: {
    color: chrome.text,
    fontFamily: 'Oswald',
    fontSize: 18,
  },
  markTv: {
    fontSize: 32,
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
    fontSize: 22,
    lineHeight: 28,
  },
});
