// Delete account (Apple-mandatory). Soft delete via the delete_user_account RPC
// (deleteAccount in src/lib/auth.ts). Minimal confirm UI this phase.
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { deleteAccount } from '../../src/lib/auth';
import { C, F, R, S } from '../../src/theme';

export default function DeleteAccountScreen() {
  function confirmDelete() {
    Alert.alert(
      'Delete account?',
      'This deactivates your account. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              // SIGNED_OUT routes back to sign-in via SessionProvider.
            } catch {
              Alert.alert('Delete failed', 'Please try again.');
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.body}>
        Deleting your account deactivates your profile and signs you out. This action cannot be
        undone.
      </Text>
      <Pressable
        onPress={confirmDelete}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>Delete my account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, padding: S.lg, gap: S.lg },
  body: { fontSize: F.body.fontSize, color: C.text, lineHeight: 22 },
  button: {
    padding: S.md,
    borderRadius: R.md,
    backgroundColor: C.danger,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: F.body.fontSize, fontWeight: '700' },
});
