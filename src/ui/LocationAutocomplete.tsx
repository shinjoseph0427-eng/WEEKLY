// City-level location field. Autocomplete is served by a Supabase Edge Function
// (Google Places is proxied server-side; no key in the app). If the function
// fails, the field still works as a plain text input — it never fabricates
// coordinates. On selecting a suggestion we resolve city + lat/lng via the
// function's details action.
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import {
  getPlaceDetails,
  searchPlaces,
  type PlacePrediction,
} from '../features/profile/places';
import { C, R, S } from '../theme';

export interface SelectedLocation {
  city: string;
  lat: number | null;
  lng: number | null;
}

export function LocationAutocomplete({
  value,
  onChangeText,
  onSelect,
  disabled,
}: {
  value: string;
  onChangeText: (city: string) => void; // manual typing: parent clears lat/lng
  onSelect: (loc: SelectedLocation) => void; // suggestion chosen: parent stores coords
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [searchError, setSearchError] = useState(false);

  // One session token per mount groups keystrokes + the final details call.
  const sessionToken = useRef<string>(Crypto.randomUUID()).current;
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQuery(value), [value]);
  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    [],
  );

  function handleText(t: string) {
    setQuery(t);
    onChangeText(t); // parent updates city text and clears lat/lng
    if (debounce.current) clearTimeout(debounce.current);
    if (t.trim().length < 2) {
      setPredictions([]);
      setSearchError(false);
      setOpen(false);
      return;
    }
    setLoading(true);
    setSearchError(false);
    setOpen(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await searchPlaces(t, sessionToken);
        setPredictions(res);
        setSearchError(false);
      } catch {
        // Function/network failed → offer manual entry instead of "No matches".
        setPredictions([]);
        setSearchError(true);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  async function choose(p: PlacePrediction) {
    setOpen(false);
    setQuery(p.primary);
    setResolving(true);
    try {
      const loc = await getPlaceDetails(p.id, sessionToken);
      const city = loc.city || p.primary;
      setQuery(city);
      onSelect({ city, lat: loc.lat, lng: loc.lng });
    } catch {
      // Keep the chosen city as text but without coordinates (never faked).
      onSelect({ city: p.primary, lat: null, lng: null });
    } finally {
      setResolving(false);
    }
  }

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Location</Text>
        <Text style={styles.hint}>Optional</Text>
      </View>

      <View>
        <TextInput
          value={query}
          onChangeText={handleText}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          editable={!disabled && !resolving}
          placeholder="City you’re in"
          placeholderTextColor={C.textMuted}
          autoCapitalize="words"
          style={styles.input}
        />
        {resolving ? (
          <ActivityIndicator style={styles.inlineSpinner} color={C.orange} size="small" />
        ) : null}
      </View>

      {open ? (
        <View style={styles.suggestBox}>
          {loading ? (
            <View style={styles.suggestRow}>
              <ActivityIndicator color={C.orange} size="small" />
            </View>
          ) : searchError ? (
            <Text style={styles.suggestEmpty}>
              Location search is unavailable. You can still type your city.
            </Text>
          ) : predictions.length > 0 ? (
            predictions.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                onPress={() => choose(p)}
                style={({ pressed }) => [styles.suggestRow, pressed && styles.pressed]}
              >
                <Text style={styles.suggestPrimary}>{p.primary}</Text>
                {p.secondary ? <Text style={styles.suggestSecondary}>{p.secondary}</Text> : null}
              </Pressable>
            ))
          ) : (
            <Text style={styles.suggestEmpty}>No matches</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: S.lg },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S.xs,
  },
  label: { fontSize: 14, fontWeight: '700', color: C.text },
  hint: { fontSize: 12, color: C.textMuted },
  input: {
    height: 52,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: S.md,
    fontSize: 16,
    color: C.text,
  },
  inlineSpinner: { position: 'absolute', right: S.md, top: 16 },
  suggestBox: {
    marginTop: S.xs,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    backgroundColor: C.surface,
    overflow: 'hidden',
  },
  suggestRow: {
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  suggestPrimary: { fontSize: 15, color: C.text, fontWeight: '600' },
  suggestSecondary: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  suggestEmpty: { paddingHorizontal: S.md, paddingVertical: S.sm, fontSize: 14, color: C.textMuted },
  pressed: { opacity: 0.6 },
});
