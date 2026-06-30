// Phase 1 placeholder screen body. Feature screens are intentionally not built
// yet (Phase 1 = skeleton + auth + ported logic). Replace per-screen later.
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, F, S } from '../theme';

export function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.note}>{note ?? 'Coming soon.'}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.lg },
  title: { fontSize: F.h1.fontSize, fontWeight: '800', color: C.text },
  note: { marginTop: S.xs, fontSize: F.body.fontSize, color: C.textMuted },
});
