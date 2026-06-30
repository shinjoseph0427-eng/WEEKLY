// Privacy Policy — placeholder copy (real copy later). Linked from sign-in +
// settings.
import { ScrollView, StyleSheet, Text } from 'react-native';
import { C, F, S } from '../../src/theme';

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Privacy Policy</Text>
      <Text style={styles.body}>
        Our full privacy policy is coming soon. WEEKLY collects only what's needed to match you with
        people nearby this week. We'll publish the complete policy here before launch.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, gap: S.md },
  heading: { fontSize: F.h2.fontSize, fontWeight: '800', color: C.text },
  body: { fontSize: F.body.fontSize, color: C.text, lineHeight: 22 },
});
