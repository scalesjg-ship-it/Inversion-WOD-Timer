import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View, type Pressable } from 'react-native';

import { TvFocusPressable, TvTextField } from '@/src/components/TvFocus';
import { useTvSetupFocus } from '@/src/components/TvSetupFocus';
import type { TvFocusTag } from '@/src/components/TvTabFocus';
import { chrome } from '@/src/theme/chrome';
import { isTenFootLayout, tvScaled } from '@/src/tv/layout';
import { tvSetupScaled } from '@/src/tv/setupLayout';
import {
  deletePreset,
  listPresets,
  nextPresetName,
  presetSummary,
  renamePreset,
  savePreset,
  updatePreset,
  type SavedPreset,
} from '@/src/timer/presetStorage';
import type { TimerConfig, TimerMode } from '@/src/timer/types';

export function PresetShelf({
  mode,
  accent,
  config,
  selectedId,
  nameHint,
  onLoad,
  onStart,
  onClearSelection,
}: {
  mode: TimerMode;
  accent: string;
  config: TimerConfig;
  selectedId: string;
  nameHint?: string;
  onLoad: (preset: SavedPreset) => void;
  onStart: (preset: SavedPreset) => void;
  onClearSelection: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const setup = useTvSetupFocus();
  const tv = Platform.isTV === true;
  const tenFoot = isTenFootLayout(width, height, tv);
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    intent: 'create' | 'rename';
    id?: string;
    name: string;
    showInput: boolean;
    confirmOverwrite: boolean;
  } | null>(null);

  const refresh = useCallback(async () => {
    const next = await listPresets(mode);
    setPresets(next);
    return next;
  }, [mode]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listPresets(mode).then((next) => {
        if (active) setPresets(next);
      });
      return () => {
        active = false;
      };
    }, [mode]),
  );

  const selected = presets.find((preset) => preset.id === selectedId);

  const openCreate = () => {
    setNotice(null);
    setConfirmDeleteId(null);
    setEditor({
      intent: 'create',
      name: nextPresetName(presets, config, nameHint),
      showInput: Platform.isTV !== true,
      confirmOverwrite: false,
    });
  };

  const openRename = (preset: SavedPreset) => {
    setNotice(null);
    setConfirmDeleteId(null);
    setEditor({
      intent: 'rename',
      id: preset.id,
      name: preset.name,
      showInput: Platform.isTV !== true,
      confirmOverwrite: false,
    });
  };

  const confirmDelete = (preset: SavedPreset) => {
    if (tv) {
      setNotice(null);
      setConfirmDeleteId(preset.id);
      return;
    }
    Alert.alert('Delete preset', `Remove ${preset.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void remove(preset);
        },
      },
    ]);
  };

  const remove = async (preset: SavedPreset) => {
    try {
      await deletePreset(preset.id);
      setConfirmDeleteId(null);
      setNotice(null);
      await refresh();
      if (preset.id === selectedId) onClearSelection();
    } catch {
      Alert.alert('Preset not deleted', 'The preset is still stored on this device.');
    }
  };

  const commit = async (overwrite: boolean) => {
    if (!editor) return;
    const name = editor.name;
    try {
      if (editor.intent === 'rename') {
        if (!editor.id) return;
        const result = await renamePreset(editor.id, name);
        if (!result.ok && result.reason === 'empty-name') {
          if (tv) setNotice('Give the preset a name before saving it.');
          else Alert.alert('Name the preset', 'Give the preset a name before saving it on this device.');
          return;
        }
        if (!result.ok && result.reason === 'name-taken') {
          if (tv) setNotice('A preset for this timer already uses that name.');
          else Alert.alert('Name already used', 'A preset for this timer already uses that name.');
          return;
        }
        if (!result.ok) {
          if (tv) setNotice('That preset is no longer on this device.');
          else Alert.alert('Preset not found', 'That preset is no longer on this device.');
          await refresh();
          return;
        }
        await refresh();
        setEditor(null);
        onLoad(result.preset);
        return;
      }

      const result = await savePreset({ name, config, overwrite });
      if (!result.ok && result.reason === 'empty-name') {
        if (tv) setNotice('Give the preset a name before saving it.');
        else Alert.alert('Name the preset', 'Give the preset a name before saving it on this device.');
        return;
      }
      if (!result.ok && result.reason === 'name-taken') {
        if (tv) {
          setEditor({ ...editor, confirmOverwrite: true });
          setNotice(`${name.trim()} is already saved. Update it, or edit the name.`);
          return;
        }
        Alert.alert('Update preset', `Replace ${name.trim()} with the current setup?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Update', onPress: () => void commit(true) },
        ]);
        return;
      }
      if (!result.ok) return;
      await refresh();
      setEditor(null);
      setNotice(null);
      onLoad(result.preset);
    } catch {
      Alert.alert('Preset not saved', 'The preset could not be saved on this device.');
    }
  };

  const updateSelected = async () => {
    if (!selected) return;
    try {
      const result = await updatePreset(selected.id, config);
      if (!result.ok) {
        if (tv) setNotice('That preset is no longer on this device.');
        else Alert.alert('Preset not found', 'That preset is no longer on this device.');
        await refresh();
        onClearSelection();
        return;
      }
      await refresh();
      onLoad(result.preset);
    } catch {
      Alert.alert('Preset not saved', 'The preset could not be updated on this device.');
    }
  };

  const previewConfirm = useRef(false);
  useEffect(() => {
    const preview = (globalThis as { __TV_PRESET_PREVIEW__?: string }).__TV_PRESET_PREVIEW__;
    if (preview !== 'confirm' || previewConfirm.current || presets.length === 0) return;
    previewConfirm.current = true;
    setConfirmDeleteId(presets[0].id);
    onLoad(presets[0]);
  }, [onLoad, presets]);

  if (tv) {
    const rowHeight = Math.max(36, tvScaled(44, width, height));
    const labelSize = Math.max(14, tvScaled(18, width, height));
    const shelfUp = setup?.abovePreset ?? null;
    const shelfDown = setup?.startTag ?? null;
    const pending = presets.find((preset) => preset.id === confirmDeleteId);
    const confirming = pending != null && pending.id === selected?.id;
    return (
      <View style={styles.tvWrap} testID={`presets-${mode}`}>
        <View style={styles.tvRow}>
          <Text style={[styles.fieldLabel, { fontSize: labelSize }]}>Presets</Text>
          {editor ? null : (
            <TextButton
              testID="save-preset"
              label="Save preset"
              color={accent}
              tenFoot={false}
              dense
              onPress={openCreate}
              onHost={setup?.bindPreset}
              focusUp={shelfUp}
              focusDown={shelfDown}
            />
          )}
          {editor ? null : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tvNames}
              contentContainerStyle={styles.tvNamesContent}
            >
              {presets.length === 0 ? (
                <Text style={[styles.empty, { fontSize: labelSize }]}>No saved presets yet.</Text>
              ) : (
                presets.map((preset) => (
                  <TextButton
                    key={preset.id}
                    testID={`preset-${preset.id}`}
                    label={preset.name}
                    accessibilityLabel={`${preset.name}. Loads this preset`}
                    color={preset.id === selectedId ? accent : chrome.text}
                    tenFoot={false}
                    dense
                    focusUp={shelfUp}
                    focusDown={shelfDown}
                    onPress={() => {
                      setConfirmDeleteId(null);
                      onLoad(preset);
                    }}
                  />
                ))
              )}
              {selected && !confirming ? (
                <>
                  <TextButton testID="update-preset" label="Update" color={accent} tenFoot={false} dense focusUp={shelfUp} focusDown={shelfDown} onPress={() => void updateSelected()} />
                  <TextButton testID={`preset-rename-${selected.id}`} label="Rename" color={accent} tenFoot={false} dense focusUp={shelfUp} focusDown={shelfDown} onPress={() => openRename(selected)} />
                  <TextButton
                    testID={`preset-delete-${selected.id}`}
                    label="Delete"
                    color="#FF8A7A"
                    tenFoot={false}
                    dense
                    focusUp={shelfUp}
                    focusDown={shelfDown}
                    onPress={() => confirmDelete(selected)}
                  />
                </>
              ) : null}
            </ScrollView>
          )}
          {confirming && selected ? (
            <TextButton
              testID="preset-delete-confirm"
              label="Confirm delete"
              color="#FF8A7A"
              tenFoot={false}
              dense
              focusUp={shelfUp}
              focusDown={shelfDown}
              onPress={() => void remove(selected)}
            />
          ) : null}
        </View>
        {editor ? (
          <View style={styles.tvRow}>
            {editor.showInput ? (
              <TvTextField
                testID="preset-name"
                accessibilityLabel="Preset name"
                value={editor.name}
                onChangeText={(name) => setEditor({ ...editor, name, confirmOverwrite: false })}
                placeholder="Preset name"
                placeholderTextColor={chrome.muted}
                selectTextOnFocus
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={() => void commit(editor.confirmOverwrite)}
                focusUp={shelfUp}
                focusDown={shelfDown}
                style={[styles.nameInput, { minHeight: rowHeight, fontSize: labelSize, flex: 1 }]}
              />
            ) : (
              <Text style={[styles.tvName, { fontSize: labelSize + 2 }]} testID="preset-auto-name" numberOfLines={1}>
                {editor.name}
              </Text>
            )}
            {editor.showInput ? null : (
              <TextButton
                testID="preset-edit-name"
                label="Edit name"
                color={accent}
                tenFoot={false}
                dense
                onHost={setup?.bindPreset}
                focusUp={shelfUp}
                focusDown={shelfDown}
                onPress={() => setEditor({ ...editor, showInput: true })}
              />
            )}
            {editor.confirmOverwrite ? (
              <TextButton testID="preset-overwrite" label="Update" color={accent} tenFoot={false} dense focusUp={shelfUp} focusDown={shelfDown} onPress={() => void commit(true)} />
            ) : null}
            <TextButton testID="preset-name-cancel" label="Cancel" color={accent} tenFoot={false} dense focusUp={shelfUp} focusDown={shelfDown} onPress={() => { setEditor(null); setNotice(null); }} />
            {editor.confirmOverwrite ? null : (
              <TextButton
                testID="preset-name-confirm"
                label={editor.intent === 'rename' ? 'Rename' : 'Save'}
                color={accent}
                tenFoot={false}
                dense
                onHost={editor.showInput ? setup?.bindPreset : undefined}
                focusUp={shelfUp}
                focusDown={shelfDown}
                onPress={() => void commit(false)}
              />
            )}
          </View>
        ) : null}
        {notice ? (
          <Text style={[styles.help, { fontSize: labelSize }]} testID="preset-notice">
            {notice}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID={`presets-${mode}`}>
      <View style={styles.heading}>
        <Text style={[styles.fieldLabel, tenFoot && styles.fieldLabelTv, tv && styles.fieldLabelFrame]}>Presets</Text>
        {editor ? null : (
          <View style={[styles.headingActions, tv && styles.headingActionsApple]}>
            {selected ? (
              <TextButton
                testID="update-preset"
                label="Update"
                color={accent}
                tenFoot={tenFoot}
                prominent
                onPress={() => void updateSelected()}
              />
            ) : null}
            <TextButton testID="save-preset" label="Save preset" color={accent} tenFoot={tenFoot} prominent onPress={openCreate} />
          </View>
        )}
      </View>

      {editor ? (
        <View style={styles.editor}>
          <Text style={[styles.editorTitle, tenFoot && styles.editorTitleTv, tv && styles.editorTitleFrame]}>
            {editor.intent === 'rename' ? 'Rename preset' : 'Save preset'}
          </Text>
          {editor.showInput ? (
            <TvTextField
              testID="preset-name"
              accessibilityLabel="Preset name"
              value={editor.name}
              onChangeText={(name) => setEditor({ ...editor, name })}
              placeholder="Preset name"
              placeholderTextColor={chrome.muted}
              autoFocus={Platform.isTV !== true}
              selectTextOnFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => void commit(false)}
              style={[styles.nameInput, tenFoot && styles.nameInputTv]}
            />
          ) : (
            <Text style={[styles.autoName, tenFoot && styles.autoNameTv, tv && styles.autoNameFrame]} testID="preset-auto-name">
              {editor.name}
            </Text>
          )}
          {Platform.isTV === true && !editor.showInput ? (
            <Text style={[styles.help, tenFoot && styles.helpTv, tv && styles.helpFrame]}>
              The name is filled in. Save it as is, or edit it with the keyboard.
            </Text>
          ) : (
            <Text style={styles.help}>Saved on this device.</Text>
          )}
          <View style={styles.editorActions}>
            {Platform.isTV === true && !editor.showInput ? (
              <TextButton
                testID="preset-edit-name"
                label="Edit name"
                color={accent}
                tenFoot={tenFoot}
                onPress={() => setEditor({ ...editor, showInput: true })}
              />
            ) : null}
            <TextButton testID="preset-name-cancel" label="Cancel" color={accent} tenFoot={tenFoot} onPress={() => setEditor(null)} />
            <TextButton
              testID="preset-name-confirm"
              label={editor.intent === 'rename' ? 'Rename' : 'Save'}
              color={accent}
              tenFoot={tenFoot}
              onPress={() => void commit(false)}
            />
          </View>
        </View>
      ) : null}

      {presets.length === 0 && !editor ? (
        <Text style={[styles.empty, tenFoot && styles.helpTv, tv && styles.helpFrame]}>No saved presets yet.</Text>
      ) : null}
      <View style={styles.list}>
        {presets.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            accent={accent}
            tenFoot={tenFoot}
            selected={preset.id === selectedId}
            onLoad={() => onLoad(preset)}
            onStart={() => onStart(preset)}
            onRename={() => openRename(preset)}
            onDelete={() => confirmDelete(preset)}
          />
        ))}
      </View>
    </View>
  );
}

function PresetCard({
  preset,
  accent,
  tenFoot,
  selected,
  onLoad,
  onStart,
  onRename,
  onDelete,
}: {
  preset: SavedPreset;
  accent: string;
  tenFoot: boolean;
  selected: boolean;
  onLoad: () => void;
  onStart: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const tv = Platform.isTV === true;
  return (
    <View style={[styles.card, tenFoot && styles.cardTv, { borderColor: selected ? accent : chrome.line }]}>
      <TvFocusPressable
        accent={accent}
        accessibilityRole="button"
        accessibilityLabel={`${preset.name}. ${presetSummary(preset.config)}`}
        accessibilityHint="Loads this preset into the setup"
        testID={`preset-${preset.id}`}
        onPress={onLoad}
        onLongPress={() => {
          Alert.alert(preset.name, 'Rename or delete this preset.', [
            { text: 'Rename', onPress: onRename },
            { text: 'Delete', style: 'destructive', onPress: onDelete },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }}
        style={({ pressed }) => [styles.cardMain, pressed ? styles.pressed : null]}
      >
        <Text style={[styles.presetName, tenFoot && styles.presetNameTv, tv && styles.presetNameFrame]} numberOfLines={2}>
          {preset.name}
        </Text>
        <Text style={[styles.presetMeta, tenFoot && styles.presetMetaTv, tv && styles.presetMetaFrame]}>{presetSummary(preset.config)}</Text>
      </TvFocusPressable>
      <View style={styles.cardActions}>
        <TextButton
          testID={`preset-start-${preset.id}`}
          label="Start"
          accessibilityLabel={`Start ${preset.name}`}
          color={accent}
          tenFoot={tenFoot}
          onPress={onStart}
        />
        <TextButton
          testID={`preset-rename-${preset.id}`}
          label="Rename"
          accessibilityLabel={`Rename ${preset.name}`}
          color={accent}
          tenFoot={tenFoot}
          onPress={onRename}
        />
        <TextButton
          testID={`preset-delete-${preset.id}`}
          label="Delete"
          accessibilityLabel={`Delete ${preset.name}`}
          color={accent}
          tenFoot={tenFoot}
          onPress={onDelete}
        />
      </View>
    </View>
  );
}

function TextButton({
  label,
  onPress,
  color,
  testID,
  tenFoot,
  accessibilityLabel,
  prominent = false,
  dense = false,
  focusUp = null,
  focusDown = null,
  onHost,
}: {
  label: string;
  onPress: () => void;
  color: string;
  testID?: string;
  tenFoot: boolean;
  accessibilityLabel?: string;
  /** Apple TV only: draw a boxed button instead of a text link. Phones keep the text link. */
  prominent?: boolean;
  /** Television shelf. A short focusable control so the setup still fits on one screen. */
  dense?: boolean;
  focusUp?: TvFocusTag | null;
  focusDown?: TvFocusTag | null;
  onHost?: (node: ComponentRef<typeof Pressable> | null) => void;
}) {
  const tv = Platform.isTV === true;
  const { width, height } = useWindowDimensions();
  const boxed = tv && prominent && !dense;
  const denseHeight = Math.max(36, tvSetupScaled(44, width, height));
  const denseFont = Math.max(15, tvSetupScaled(20, width, height));
  return (
    <TvFocusPressable
      accent={color}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      onPress={onPress}
      onHost={onHost}
      focusUp={focusUp}
      focusDown={focusDown}
      style={({ pressed }) => [
        styles.textButton,
        tenFoot && !dense && styles.textButtonTv,
        tv && !dense && styles.textButtonApple,
        dense && { minHeight: denseHeight, paddingHorizontal: Math.max(8, tvScaled(10, width, height)) },
        boxed && [styles.textButtonBoxedApple, { borderColor: color }],
        { opacity: pressed ? 0.72 : 1 },
      ]}
    >
      <Text
        style={[
          styles.textButtonLabel,
          tenFoot && !dense && styles.textButtonLabelTv,
          tv && !dense && styles.textButtonLabelApple,
          dense && { fontSize: denseFont },
          boxed && styles.textButtonLabelBoxedApple,
          { color },
        ]}
      >
        {label}
      </Text>
    </TvFocusPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  tvWrap: {
    gap: 4,
    maxWidth: '100%',
    alignItems: 'center',
  },
  tvRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  tvNames: {
    flex: 1,
    minWidth: 0,
  },
  tvNamesContent: {
    alignItems: 'center',
    gap: 6,
  },
  tvName: {
    flexShrink: 1,
    fontFamily: 'Oswald',
    color: chrome.text,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  headingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fieldLabel: {
    color: chrome.muted,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: 'OswaldMedium',
  },
  fieldLabelTv: {
    fontSize: 22,
  },
  editor: {
    gap: 10,
    backgroundColor: chrome.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: chrome.line,
    padding: 12,
  },
  editorTitle: {
    fontFamily: 'Oswald',
    fontSize: 22,
    color: chrome.text,
  },
  editorTitleTv: {
    fontSize: 36,
  },
  editorTitleFrame: {
    fontSize: 48,
  },
  autoName: {
    fontFamily: 'Oswald',
    fontSize: 28,
    color: chrome.text,
  },
  autoNameTv: {
    fontSize: 42,
  },
  nameInput: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: chrome.line,
    backgroundColor: chrome.bg,
    color: chrome.text,
    paddingHorizontal: 14,
    fontSize: 18,
  },
  nameInputTv: {
    minHeight: 72,
    fontSize: 28,
  },
  editorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  help: {
    color: chrome.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  helpTv: {
    fontSize: 22,
    lineHeight: 30,
  },
  empty: {
    color: chrome.muted,
    fontSize: 15,
  },
  list: {
    gap: 10,
  },
  card: {
    backgroundColor: chrome.surface,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  cardTv: {
    borderRadius: 24,
    padding: 18,
    gap: 8,
  },
  cardMain: {
    gap: 4,
    borderRadius: 12,
  },
  pressed: {
    opacity: 0.78,
  },
  presetName: {
    fontFamily: 'Oswald',
    fontSize: 22,
    color: chrome.text,
  },
  presetNameTv: {
    fontSize: 40,
  },
  presetMeta: {
    color: chrome.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  presetMetaTv: {
    fontSize: 22,
    lineHeight: 30,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  textButton: {
    minHeight: 44,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  textButtonTv: {
    minHeight: 64,
    paddingHorizontal: 16,
  },
  textButtonLabel: {
    fontFamily: 'Oswald',
    fontSize: 18,
    letterSpacing: 0.4,
  },
  textButtonLabelTv: {
    fontSize: 26,
  },
  textButtonApple: {
    minHeight: 84,
    paddingHorizontal: 20,
  },
  textButtonLabelApple: {
    fontSize: 36,
  },
  /** Border width stays fixed; focus only tints and scales, so tvOS focus does not resize the frame. */
  textButtonBoxedApple: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 72,
    paddingHorizontal: 22,
    borderRadius: 18,
    borderWidth: 4,
    backgroundColor: 'transparent',
  },
  textButtonLabelBoxedApple: {
    fontSize: 28,
    letterSpacing: 0.4,
    backgroundColor: 'transparent',
  },
  headingActionsApple: {
    gap: 20,
  },
  fieldLabelFrame: {
    fontSize: 32,
  },
  autoNameFrame: {
    fontSize: 56,
  },
  helpFrame: {
    fontSize: 28,
    lineHeight: 36,
  },
  presetNameFrame: {
    fontSize: 48,
    lineHeight: 56,
  },
  presetMetaFrame: {
    fontSize: 28,
    lineHeight: 36,
  },
});
