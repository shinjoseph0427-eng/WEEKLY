// Terms of Service — placeholder copy (real copy later). Linked from sign-in +
// settings.
import { ScrollView, StyleSheet, Text } from 'react-native';
import { C, F, S } from '../../src/theme';

export default function TermsScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Terms of Service</Text>
      <Text style={styles.body}>
        Our full terms of service are coming soon. By using WEEKLY you agree to be respectful and to
        follow our community guidelines. We'll publish the complete terms here before launch.
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
