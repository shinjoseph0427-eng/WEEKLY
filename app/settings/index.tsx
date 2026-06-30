// Settings hub — links to profile/safety/legal screens + sign out.
// Privacy and Terms are linked here per the locked decision.
import { Link } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { signOut } from '../../src/lib/auth';
import { C, F, R, S } from '../../src/theme';

const ROWS: { href: string; label: string }[] = [
  { href: '/settings/edit-profile', label: 'Edit profile' },
  { href: '/settings/blocked', label: 'Blocked users' },
  { href: '/settings/privacy', label: 'Privacy Policy' },
  { href: '/settings/terms', label: 'Terms of Service' },
  { href: '/settings/delete-account', label: 'Delete account' },
];

export default function SettingsIndex() {
  async function handleSignOut() {
    try {
      await signOut();
      // SIGNED_OUT routes back to sign-in via SessionProvider.
    } catch {
      Alert.alert('Sign out failed', 'Please try again.');
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.group}>
        {ROWS.map((r) => (
          <Link key={r.href} href={r.href} asChild>
            <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <Text style={styles.rowText}>{r.label}</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      <Pressable
        onPress={handleSignOut}
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, gap: S.lg },
  group: {
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    overflow: 'hidden',
  },
  row: { padding: S.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  pressed: { opacity: 0.6 },
  rowText: { fontSize: F.body.fontSize, color: C.text },
  signOut: {
    padding: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  signOutText: { fontSize: F.body.fontSize, color: C.danger, fontWeight: '600' },
});
