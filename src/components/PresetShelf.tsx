import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { chrome } from '@/src/theme/chrome';
import { focusChrome } from '@/src/tv/controls';
import { isTenFootLayout } from '@/src/tv/layout';
import { tvParallaxProps } from '@/src/tv/pressable';
import { usePointerFocus } from '@/src/tv/usePointerFocus';
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
  const tv = Platform.isTV === true;
  const tenFoot = isTenFootLayout(width, height, tv);
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [editor, setEditor] = useState<{ intent: 'create' | 'rename'; id?: string; name: string; showInput: boolean } | null>(
    null,
  );

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
    setEditor({
      intent: 'create',
      name: nextPresetName(presets, config, nameHint),
      showInput: Platform.isTV !== true,
    });
  };

  const openRename = (preset: SavedPreset) => {
    setEditor({
      intent: 'rename',
      id: preset.id,
      name: preset.name,
      showInput: Platform.isTV !== true,
    });
  };

  const confirmDelete = (preset: SavedPreset) => {
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
          Alert.alert('Name the preset', 'Give the preset a name before saving it on this device.');
          return;
        }
        if (!result.ok && result.reason === 'name-taken') {
          Alert.alert('Name already used', 'A preset for this timer already uses that name.');
          return;
        }
        if (!result.ok) {
          Alert.alert('Preset not found', 'That preset is no longer on this device.');
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
        Alert.alert('Name the preset', 'Give the preset a name before saving it on this device.');
        return;
      }
      if (!result.ok && result.reason === 'name-taken') {
        Alert.alert('Update preset', `Replace ${name.trim()} with the current setup?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Update', onPress: () => void commit(true) },
        ]);
        return;
      }
      if (!result.ok) return;
      await refresh();
      setEditor(null);
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
        Alert.alert('Preset not found', 'That preset is no longer on this device.');
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

  return (
    <View style={styles.wrap} testID={`presets-${mode}`}>
      <View style={styles.heading}>
        <Text style={[styles.fieldLabel, tenFoot && styles.fieldLabelTv, tv && styles.fieldLabelFrame]}>Presets</Text>
        {editor ? null : (
          <View style={styles.headingActions}>
            {selected ? (
              <TextButton testID="update-preset" label="Update" color={accent} tenFoot={tenFoot} onPress={() => void updateSelected()} />
            ) : null}
            <TextButton testID="save-preset" label="Save preset" color={accent} tenFoot={tenFoot} onPress={openCreate} />
          </View>
        )}
      </View>

      {editor ? (
        <View style={styles.editor}>
          <Text style={[styles.editorTitle, tenFoot && styles.editorTitleTv, tv && styles.editorTitleFrame]}>
            {editor.intent === 'rename' ? 'Rename preset' : 'Save preset'}
          </Text>
          {editor.showInput ? (
            <TextInput
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
  const pointer = usePointerFocus();
  const tv = Platform.isTV === true;
  return (
    <View style={[styles.card, tenFoot && styles.cardTv, { borderColor: selected ? accent : chrome.line }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${preset.name}. ${presetSummary(preset.config)}`}
        accessibilityHint="Loads this preset into the setup"
        testID={`preset-${preset.id}`}
        onPress={onLoad}
        onFocus={pointer.onFocus}
        onBlur={pointer.onBlur}
        {...tvParallaxProps()}
        onLongPress={() => {
          Alert.alert(preset.name, 'Rename or delete this preset.', [
            { text: 'Rename', onPress: onRename },
            { text: 'Delete', style: 'destructive', onPress: onDelete },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }}
        style={({ pressed, focused }) => [
          styles.cardMain,
          pressed ? styles.pressed : null,
          focusChrome(tv, Boolean(focused) || pointer.focused, accent),
        ]}
      >
        <Text style={[styles.presetName, tenFoot && styles.presetNameTv, tv && styles.presetNameFrame]} numberOfLines={2}>
          {preset.name}
        </Text>
        <Text style={[styles.presetMeta, tenFoot && styles.presetMetaTv, tv && styles.presetMetaFrame]}>{presetSummary(preset.config)}</Text>
      </Pressable>
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
}: {
  label: string;
  onPress: () => void;
  color: string;
  testID?: string;
  tenFoot: boolean;
  accessibilityLabel?: string;
}) {
  const pointer = usePointerFocus();
  const tv = Platform.isTV === true;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      onPress={onPress}
      onFocus={pointer.onFocus}
      onBlur={pointer.onBlur}
      {...tvParallaxProps()}
      style={({ focused, pressed }) => [
        styles.textButton,
        tenFoot && styles.textButtonTv,
        tv && styles.textButtonApple,
        { opacity: pressed ? 0.72 : 1 },
        focusChrome(tv, Boolean(focused) || pointer.focused, color),
      ]}
    >
      <Text style={[styles.textButtonLabel, tenFoot && styles.textButtonLabelTv, tv && styles.textButtonLabelApple, { color }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
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
