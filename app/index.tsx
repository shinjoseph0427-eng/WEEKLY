// Neutral entry route for "/". The auth gate in app/_layout.tsx redirects to
// (auth)/sign-in, onboarding, or (tabs) once auth + profile resolve; this just
// shows a spinner so "/" never renders an unmatched route on cold start.
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { C } from '../src/theme';

export default function Index() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={C.orange} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
});
