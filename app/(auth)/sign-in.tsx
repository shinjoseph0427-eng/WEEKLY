// Sign-in — clean 2-button OAuth screen (rewrite of web AuthPage.jsx).
// Apple (official AppleAuthenticationButton on iOS) + Google. Terms/Privacy
// links as small print. Wires to signInWithApple / signInWithGoogle.
import { useState } from 'react';
import { Link } from 'expo-router';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AUTH_CANCELLED, signInWithApple, signInWithGoogle } from '../../src/lib/auth';
import { C, F, R, S } from '../../src/theme';

export default function SignInScreen() {
  const [busy, setBusy] = useState<null | 'apple' | 'google'>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(provider: 'apple' | 'google', fn: () => Promise<unknown>) {
    setError(null);
    setBusy(provider);
    try {
      await fn();
      // On success the auth listener in SessionProvider drives navigation.
    } catch (e) {
      const msg = (e as Error)?.message;
      if (msg !== AUTH_CANCELLED) {
        setError("Couldn't sign you in. Please try again.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>WEEKLY</Text>
          <Text style={styles.tagline}>Meet someone new this week.</Text>
        </View>

        <View style={styles.buttons}>
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={R.md}
              style={styles.appleButton}
              onPress={() => run('apple', signInWithApple)}
            />
          )}

          <Pressable
            accessibilityRole="button"
            disabled={busy !== null}
            onPress={() => run('google', signInWithGoogle)}
            style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}
          >
            {busy === 'google' ? (
              <ActivityIndicator color={C.text} />
            ) : (
              <Text style={styles.googleLabel}>Continue with Google</Text>
            )}
          </Pressable>

          {error && <Text style={styles.error}>{error}</Text>}
        </View>

        <Text style={styles.smallprint}>
          By continuing you agree to our{' '}
          <Link href="/settings/terms" style={styles.linkText}>
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/settings/privacy" style={styles.linkText}>
            Privacy Policy
          </Link>
          .
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: {
    flex: 1,
    paddingHorizontal: S.lg,
    paddingBottom: S.xl,
    justifyContent: 'space-between',
  },
  header: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  brand: {
    fontSize: F.display.fontSize,
    fontWeight: '900',
    letterSpacing: 2,
    color: C.text,
  },
  tagline: { marginTop: S.sm, fontSize: F.body.fontSize, color: C.textMuted },
  buttons: { gap: S.sm },
  appleButton: { height: 52, width: '100%' },
  googleButton: {
    height: 52,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  googleLabel: { fontSize: 16, fontWeight: '600', color: C.text },
  error: { color: C.danger, fontSize: F.sm.fontSize, textAlign: 'center', marginTop: S.xs },
  smallprint: {
    marginTop: S.lg,
    fontSize: 12,
    lineHeight: 18,
    color: C.textMuted,
    textAlign: 'center',
  },
  linkText: { color: C.orange, fontWeight: '600' },
});
