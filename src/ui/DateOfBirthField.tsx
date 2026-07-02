// Date-of-birth field: a tappable row that opens the native date picker.
// The picker's maximumDate is the 18-years-ago cutoff, so under-18 dates can't
// be chosen; the screen still re-validates 18+ before saving (defense in depth).
//
// NOTE: @react-native-community/datetimepicker is a NATIVE module (config plugin
// added in app.json). The existing dev client must be rebuilt before this field
// renders on device.
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
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
  maximumDate: Date;
  minimumDate: Date;
  disabled?: boolean;
  eligible: boolean;
  ineligibleMessage: string;
}) {
  const [show, setShow] = useState(false);

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      // Android renders a one-shot dialog; close it on any result.
      setShow(false);
      if (event.type === 'set' && selected) onChange(selected);
    } else if (selected) {
      // iOS spinner reports each change while open.
      onChange(selected);
    }
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        Date of birth<Text style={styles.req}> *</Text>
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setShow((s) => !s)}
        style={({ pressed }) => [styles.input, pressed && styles.pressed]}
      >
        <Text style={value ? styles.valueText : styles.placeholder}>
          {value ? formatBirthDate(value) : 'Select your date of birth'}
        </Text>
        {value ? <Text style={styles.age}>{getAge(value)} yrs</Text> : null}
      </Pressable>

      {value && !eligible ? <Text style={styles.errorText}>{ineligibleMessage}</Text> : null}

      {show ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={value ?? maximumDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            onChange={handleChange}
          />
          {Platform.OS === 'ios' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShow(false)}
              style={styles.doneBtn}
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
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
  age: { fontSize: 13, color: C.textMuted },
  errorText: { marginTop: S.xs, fontSize: 12, color: C.danger },
  pickerWrap: { marginTop: S.xs, alignItems: 'center' },
  doneBtn: { alignSelf: 'flex-end', paddingHorizontal: S.md, paddingVertical: S.xs },
  doneText: { fontSize: 16, fontWeight: '700', color: C.orange },
});
