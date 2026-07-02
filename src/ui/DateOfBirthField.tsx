// Date-of-birth field: a tappable row with a calendar affordance that opens the
// native date picker. On iOS the picker lives in a bottom-sheet modal with
// Cancel/Done, and edits are staged in a draft so scrolling the spinner doesn't
// commit until "Done". Default when empty is exactly 18 years ago (the max
// selectable), never the min. The screen re-validates 18+ from birth_date.
//
// NOTE: @react-native-community/datetimepicker is a NATIVE module (config plugin
// in app.json). The dev client must be rebuilt before this field works.
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { formatBirthDate, getAge } from '../lib/age';
import { C, R, S } from '../theme';

export function DateOfBirthField({
  value,
  onChange,
  maximumDate,
  minimumDate,
  disabled,
  eligible,
  ineligibleMessage,
}: {
  value: Date | null;
  onChange: (d: Date) => void;
  maximumDate: Date; // 18 years ago (also the default when empty)
  minimumDate: Date; // 100 years ago
  disabled?: boolean;
  eligible: boolean;
  ineligibleMessage: string;
}) {
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? maximumDate);

  function open() {
    if (disabled) return;
    setDraft(value ?? maximumDate);
    setShow(true);
  }

  // iOS: stage changes in the draft; commit only on Done.
  function onIosChange(_e: DateTimePickerEvent, selected?: Date) {
    if (selected) setDraft(selected);
  }
  function commit() {
    onChange(draft);
    setShow(false);
  }

  // Android: native dialog owns its own OK/Cancel buttons.
  function onAndroidChange(event: DateTimePickerEvent, selected?: Date) {
    setShow(false);
    if (event.type === 'set' && selected) onChange(selected);
  }

  const showError = !!value && !eligible;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        Date of birth<Text style={styles.req}> *</Text>
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Select date of birth"
        disabled={disabled}
        onPress={open}
        style={({ pressed }) => [styles.input, pressed && styles.pressed]}
      >
        <Text style={value ? styles.valueText : styles.placeholder}>
          {value ? formatBirthDate(value) : 'Select date of birth'}
        </Text>
        <View style={styles.right}>
          {value ? <Text style={styles.age}>{getAge(value)} yrs</Text> : null}
          <Calendar size={18} color={C.textMuted} />
        </View>
      </Pressable>

      <Text style={[styles.helper, showError && styles.helperError]}>{ineligibleMessage}</Text>

      {/* Android: inline native dialog */}
      {show && Platform.OS === 'android' ? (
        <DateTimePicker
          value={value ?? maximumDate}
          mode="date"
          display="default"
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={onAndroidChange}
        />
      ) : null}

      {/* iOS: bottom-sheet modal with Cancel / Done */}
      {Platform.OS === 'ios' ? (
        <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <Pressable style={styles.backdrop} onPress={() => setShow(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Pressable accessibilityRole="button" onPress={() => setShow(false)}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>Date of birth</Text>
              <Pressable accessibilityRole="button" onPress={commit}>
                <Text style={styles.done}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={draft}
              mode="date"
              display="spinner"
              maximumDate={maximumDate}
              minimumDate={minimumDate}
              onChange={onIosChange}
              themeVariant="light"
              style={styles.iosPicker}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: S.lg },
  label: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: S.xs },
  req: { color: C.orange },
  input: {
    height: 52,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: S.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: { opacity: 0.7 },
  valueText: { fontSize: 16, color: C.text },
  placeholder: { fontSize: 16, color: C.textMuted },
  right: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  age: { fontSize: 13, color: C.textMuted },
  helper: { marginTop: S.xs, fontSize: 12, color: C.textMuted },
  helperError: { color: C.danger },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    paddingBottom: S.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  cancel: { fontSize: 16, color: C.textMuted },
  done: { fontSize: 16, fontWeight: '700', color: C.orange },
  iosPicker: { alignSelf: 'center' },
});
