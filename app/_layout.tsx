// Root layout — providers + auth-gated routing.
// Mirrors web App.jsx routing decisions: signed-out → (auth)/sign-in;
// signed-in + onboarding incomplete → onboarding; else → (tabs).
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider, useSession } from '../src/lib/session';
import { C } from '../src/theme';

const queryClient = new QueryClient();

function RootNavigator() {
  const { authReady, profileReady, user, onboardingComplete } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Wait until both auth and (when signed in) the profile are resolved so we
    // never redirect on a half-known state.
    if (!authReady) return;
    if (user && !profileReady) return;

    const group = segments[0]; // '(auth)' | '(tabs)' | 'onboarding' | 'settings' | 'chat' | undefined
    const inAuthGroup = group === '(auth)';
    const inOnboarding = group === 'onboarding';
    const atRoot = group === undefined; // the bare "/" index landing

    if (!user) {
      if (!inAuthGroup) router.replace('/(auth)/sign-in');
      return;
    }

    if (!onboardingComplete) {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }

    // Signed in + onboarded: bounce off auth/onboarding/root into the app.
    if (inAuthGroup || inOnboarding || atRoot) router.replace('/(tabs)');
  }, [authReady, profileReady, user, onboardingComplete, segments, router]);

  if (!authReady || (user && !profileReady)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.orange} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="chat/[id]" options={{ headerShown: true, title: 'Chat' }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <SessionProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </SessionProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
