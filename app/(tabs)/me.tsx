// Me tab — settings hub entry (web MePage.jsx). Body is a placeholder this
// phase; it just routes into the settings stack so those screens are reachable.
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, F, R, S } from '../../src/theme';

export default function MeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>Me</Text>
        <Link href="/settings" style={styles.row}>
          <Text style={styles.rowText}>Settings</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, padding: S.lg, gap: S.md },
  title: { fontSize: F.h1.fontSize, fontWeight: '800', color: C.text },
  row: {
    padding: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  rowText: { fontSize: F.body.fontSize, color: C.text, fontWeight: '600' },
});
