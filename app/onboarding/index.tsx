// Onboarding / profile creation — the required first-run flow after sign-in.
// New users land here (routing gate in app/_layout.tsx) and must complete a
// basic profile before entering the tabs. Requirements: name, a date of birth
// that clears the exact 18+ gate, and at least 3 photos. On save we upload the
// photos, flip onboarding_complete via completeOnboarding(), then refreshProfile
// so the router advances.
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useSession } from '../../src/lib/session';
import {
  completeOnboarding,
  MIN_AGE,
  MIN_ONBOARDING_PHOTOS,
  type OnboardingProfileInput,
} from '../../src/features/profile/profile';
import { uploadPhoto } from '../../src/features/profile/upload';
import {
  getBirthYearFromDate,
  getMinimumBirthDateForAge,
  isAtLeastAge,
  toISODateString,
} from '../../src/lib/age';
import { LabeledInput, PhotoGrid, SelectChip, type PhotoItem } from '../../src/ui/form';
import { DateOfBirthField } from '../../src/ui/DateOfBirthField';
import { LocationAutocomplete, type SelectedLocation } from '../../src/ui/LocationAutocomplete';
import { C, F, R, S } from '../../src/theme';

const BIO_MAX = 300;

// Local-only chips: there is no interests column in public.profiles, so these
// are UI sugar this phase and are intentionally NOT persisted.
const INTEREST_OPTIONS = [
  'Coffee', 'Food', 'Study', 'Walk', 'Church',
  'Workout', 'Music', 'Books', 'Tech', 'Outdoors',
] as const;

const MAX_BIRTH_DATE = getMinimumBirthDateForAge(MIN_AGE); // 18 years ago today
const MIN_BIRTH_DATE = getMinimumBirthDateForAge(100); // 100 years ago today

export default function OnboardingScreen() {
  const { user, profile, refreshProfile } = useSession();

  const [name, setName] = useState(profile?.name ?? '');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [city, setCity] = useState(profile?.city ?? '');
  const [lat, setLat] = useState<number | null>(profile?.lat ?? null);
  const [lng, setLng] = useState<number | null>(profile?.lng ?? null);
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [interests, setInterests] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const ageEligible = birthDate ? isAtLeastAge(birthDate, MIN_AGE) : false;
  const nameValid = name.trim().length > 0;
  const photosValid = photos.length >= MIN_ONBOARDING_PHOTOS;
  const canSubmit = nameValid && !!birthDate && ageEligible && photosValid && !submitting;

  const ineligibleMessage = useMemo(
    () => `You must be at least ${MIN_AGE} to use WEEKLY.`,
    [],
  );

  function toggleInterest(tag: string) {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function addPhoto(asset: ImagePickerAsset) {
    setPhotos((prev) => [...prev, { key: Crypto.randomUUID(), uri: asset.uri, asset }]);
  }
  function removePhoto(key: string) {
    setPhotos((prev) => prev.filter((p) => p.key !== key));
  }

  function onSelectLocation(loc: SelectedLocation) {
    setCity(loc.city);
    setLat(loc.lat);
    setLng(loc.lng);
  }
  function onTypeCity(text: string) {
    setCity(text);
    setLat(null); // typed text isn't a resolved place — drop stale coords
    setLng(null);
  }

  async function onSubmit() {
    if (!user?.id || !canSubmit || !birthDate) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      // Upload every picked photo; all must succeed to meet the 3-photo minimum.
      const urls: string[] = [];
      for (const p of photos) {
        if (p.url) {
          urls.push(p.url);
        } else if (p.asset) {
          urls.push(await uploadPhoto(user.id, p.asset));
        }
      }
      if (urls.length < MIN_ONBOARDING_PHOTOS) {
        throw new Error(`At least ${MIN_ONBOARDING_PHOTOS} photos are required.`);
      }

      const input: OnboardingProfileInput = {
        name: name.trim(),
        birth_date: toISODateString(birthDate),
        birth_year: getBirthYearFromDate(birthDate),
        city: city.trim() || null,
        lat,
        lng,
        bio: bio.trim() || null,
        photos: urls,
      };

      await completeOnboarding(user.id, input);
      // Recompute session.onboardingComplete → app/_layout.tsx routes to tabs.
      await refreshProfile();
    } catch (e) {
      const msg = (e as Error)?.message;
      setError(msg && msg.length < 120 ? msg : "Couldn't save your profile. Please try again.");
      setSubmitting(false);
    }
    // On success we leave submitting=true: the router replaces this screen.
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Create your profile</Text>
            <Text style={styles.subtitle}>Help others know who they’re meeting.</Text>
          </View>

          <View style={styles.form}>
            <PhotoGrid
              items={photos}
              onAdd={addPhoto}
              onRemove={removePhoto}
              min={MIN_ONBOARDING_PHOTOS}
              disabled={submitting}
            />

            <LabeledInput
              label="Name"
              required
              placeholder="Your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              maxLength={60}
              editable={!submitting}
              returnKeyType="next"
            />

            <DateOfBirthField
              value={birthDate}
              onChange={setBirthDate}
              maximumDate={MAX_BIRTH_DATE}
              minimumDate={MIN_BIRTH_DATE}
              disabled={submitting}
              eligible={ageEligible}
              ineligibleMessage={ineligibleMessage}
            />

            <LocationAutocomplete
              value={city}
              onChangeText={onTypeCity}
              onSelect={onSelectLocation}
              disabled={submitting}
            />

            <LabeledInput
              label="Bio"
              hint={`${bio.length}/${BIO_MAX}`}
              placeholder="A little about you"
              value={bio}
              onChangeText={(t) => setBio(t.slice(0, BIO_MAX))}
              multiline
              maxLength={BIO_MAX}
              editable={!submitting}
            />

            <View style={styles.field}>
              <Text style={styles.sectionLabel}>Interests</Text>
              <View style={styles.chips}>
                {INTEREST_OPTIONS.map((tag) => (
                  <SelectChip
                    key={tag}
                    label={tag}
                    selected={interests.includes(tag)}
                    onPress={() => toggleInterest(tag)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.actions}>
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                accessibilityRole="button"
                disabled={!canSubmit}
                onPress={onSubmit}
                style={({ pressed }) => [
                  styles.cta,
                  !canSubmit && styles.ctaDisabled,
                  pressed && canSubmit && styles.pressed,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color={C.cream} />
                ) : (
                  <Text style={styles.ctaText}>Continue</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  content: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.xxxl },
  header: { alignItems: 'center', marginBottom: S.lg },
  title: { fontSize: F.h1.fontSize, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  subtitle: { marginTop: S.xs, fontSize: F.body.fontSize, color: C.textMuted, textAlign: 'center' },
  form: { marginTop: S.md },
  field: { marginBottom: S.lg },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: S.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs },
  actions: { marginTop: S.md, gap: S.sm },
  notice: { fontSize: 13, color: C.textMuted, textAlign: 'center' },
  error: { fontSize: 13, color: C.danger, textAlign: 'center' },
  cta: {
    height: 52,
    borderRadius: R.md,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: C.border },
  ctaText: { fontSize: 16, fontWeight: '700', color: C.cream },
  pressed: { opacity: 0.85 },
});
