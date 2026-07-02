// Shared form primitives for profile screens (onboarding + edit-profile).
// Small, style-only building blocks — no data logic lives here.
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { C, R, S } from '../theme';

// ── Labeled text input ───────────────────────────────────────────────────────
type LabeledInputProps = TextInputProps & {
  label: string;
  required?: boolean;
  hint?: string;
};

export function LabeledInput({ label, required, hint, style, ...props }: LabeledInputProps) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.req}> *</Text> : null}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <TextInput
        placeholderTextColor={C.textMuted}
        style={[styles.input, props.multiline ? styles.inputMultiline : null, style]}
        {...props}
      />
    </View>
  );
}

// ── Selectable chip (local-only interests, etc.) ─────────────────────────────
export function SelectChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

// ── Multi-photo grid (enforces a minimum count in the screen) ────────────────
// A photo is either already uploaded (`url` set, edit case) or freshly picked
// (`asset` set, needs upload on save). `uri` is what we display for both.
export interface PhotoItem {
  key: string;
  uri: string;
  asset?: ImagePicker.ImagePickerAsset;
  url?: string;
}

export function PhotoGrid({
  items,
  onAdd,
  onRemove,
  min = 3,
  max = 6,
  disabled,
}: {
  items: PhotoItem[];
  onAdd: (asset: ImagePicker.ImagePickerAsset) => void;
  onRemove: (key: string) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('Allow photo access to add pictures.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        onAdd(res.assets[0]);
      }
    } catch {
      setError("Couldn't open your photos. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const canAdd = items.length < max;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          Photos<Text style={styles.req}> *</Text>
        </Text>
        <Text style={styles.hint}>
          {items.length}/{min} min
        </Text>
      </View>

      <View style={styles.photoGrid}>
        {items.map((it) => (
          <View key={it.key} style={styles.photoTile}>
            <Image source={{ uri: it.uri }} style={styles.photoImg} contentFit="cover" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              disabled={disabled}
              onPress={() => onRemove(it.key)}
              style={styles.removeBtn}
            >
              <Text style={styles.removeX}>×</Text>
            </Pressable>
          </View>
        ))}

        {canAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add photo"
            disabled={disabled || busy}
            onPress={add}
            style={({ pressed }) => [styles.photoTile, styles.addTile, pressed && styles.pressed]}
          >
            {busy ? <ActivityIndicator color={C.orange} /> : <Text style={styles.addPlus}>＋</Text>}
          </Pressable>
        ) : null}
      </View>

      {items.length < min ? (
        <Text style={styles.helperText}>Add at least {min} photos.</Text>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: S.lg },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S.xs,
  },
  label: { fontSize: 14, fontWeight: '700', color: C.text },
  req: { color: C.orange },
  hint: { fontSize: 12, color: C.textMuted },
  input: {
    height: 52,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: S.md,
    fontSize: 16,
    color: C.text,
  },
  inputMultiline: {
    height: 108,
    paddingTop: S.sm,
    textAlignVertical: 'top',
  },
  chip: {
    paddingHorizontal: S.md,
    paddingVertical: S.xs,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  chipSelected: { borderColor: C.orange, backgroundColor: C.orangeSurface },
  chipText: { fontSize: 14, fontWeight: '600', color: C.text },
  chipTextSelected: { color: C.orange },
  pressed: { opacity: 0.7 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  photoTile: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: R.md,
    overflow: 'hidden',
    backgroundColor: C.orangeSurface,
  },
  photoImg: { width: '100%', height: '100%' },
  addTile: {
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
    backgroundColor: C.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: { fontSize: 28, color: C.orange, fontWeight: '600' },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeX: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', lineHeight: 17 },
  helperText: { marginTop: S.xs, fontSize: 12, color: C.textMuted },
  errorText: { marginTop: S.xs, fontSize: 12, color: C.danger },
});
