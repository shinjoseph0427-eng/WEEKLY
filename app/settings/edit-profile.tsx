// Edit profile — reuses the onboarding field primitives. Secondary to onboarding
// but enforces the same standards (18+ birth date, min 3 photos) so a save can
// never drop a profile below the requirements. Never touches onboarding_complete
// (the user is already onboarded to reach this screen).
import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useSession } from '../../src/lib/session';
import {
  updateProfile,
  MIN_AGE,
  MIN_ONBOARDING_PHOTOS,
} from '../../src/features/profile/profile';
import { uploadPhoto } from '../../src/features/profile/upload';
import {
  getBirthYearFromDate,
  getMinimumBirthDateForAge,
  isAtLeastAge,
  parseISODate,
  toISODateString,
} from '../../src/lib/age';
import { LabeledInput, PhotoGrid, type PhotoItem } from '../../src/ui/form';
import { DateOfBirthField } from '../../src/ui/DateOfBirthField';
import { LocationAutocomplete, type SelectedLocation } from '../../src/ui/LocationAutocomplete';
import type { Profile } from '../../src/types/db';
import { C, F, R, S } from '../../src/theme';

const BIO_MAX = 300;
const MAX_BIRTH_DATE = getMinimumBirthDateForAge(MIN_AGE);
const MIN_BIRTH_DATE = getMinimumBirthDateForAge(100);

export default function EditProfileScreen() {
  const { user, profile } = useSession();

  if (!user || !profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <ActivityIndicator color={C.orange} />
        </View>
      </SafeAreaView>
    );
  }

  // key by id so the form re-inits if the profile identity ever changes.
  return <EditProfileForm key={profile.id} userId={user.id} profile={profile} />;
}

function EditProfileForm({ userId, profile }: { userId: string; profile: Profile }) {
  const router = useRouter();
  const { refreshProfile } = useSession();

  const [name, setName] = useState(profile.name ?? '');
  const [birthDate, setBirthDate] = useState<Date | null>(parseISODate(profile.birth_date));
  const [city, setCity] = useState(profile.city ?? '');
  const [lat, setLat] = useState<number | null>(profile.lat ?? null);
  const [lng, setLng] = useState<number | null>(profile.lng ?? null);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [photos, setPhotos] = useState<PhotoItem[]>(
    (profile.photos ?? []).map((url) => ({ key: url, uri: url, url })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const ageEligible = birthDate ? isAtLeastAge(birthDate, MIN_AGE) : false;
  const photosValid = photos.length >= MIN_ONBOARDING_PHOTOS;
  const canSave =
    name.trim().length > 0 && !!birthDate && ageEligible && photosValid && !saving;

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
    setLat(null);
    setLng(null);
  }

  async function onSave() {
    if (!canSave || !birthDate) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const urls: string[] = [];
      for (const p of photos) {
        if (p.url) urls.push(p.url);
        else if (p.asset) urls.push(await uploadPhoto(userId, p.asset));
      }
      if (urls.length < MIN_ONBOARDING_PHOTOS) {
        throw new Error(`At least ${MIN_ONBOARDING_PHOTOS} photos are required.`);
      }

      const patch: Partial<Profile> = {
        name: name.trim(),
        birth_date: toISODateString(birthDate),
        birth_year: getBirthYearFromDate(birthDate),
        city: city.trim() || null,
        lat,
        lng,
        bio: bio.trim() || null,
        photos: urls,
      };
      await updateProfile(userId, patch);
      await refreshProfile();
      router.back();
    } catch (e) {
      const msg = (e as Error)?.message;
      setError(msg && msg.length < 120 ? msg : "Couldn't save changes. Please try again.");
      setSaving(false);
    }
  }

  const belowPhotoMin = photos.length < MIN_ONBOARDING_PHOTOS;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Edit profile</Text>

          {belowPhotoMin ? (
            <Text style={styles.warning}>
              Add at least {MIN_ONBOARDING_PHOTOS} photos to save your profile.
            </Text>
          ) : null}

          <View style={styles.form}>
            <PhotoGrid
              items={photos}
              onAdd={addPhoto}
              onRemove={removePhoto}
              min={MIN_ONBOARDING_PHOTOS}
              disabled={saving}
            />

            <LabeledInput
              label="Name"
              required
              placeholder="Your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              maxLength={60}
              editable={!saving}
            />

            <DateOfBirthField
              value={birthDate}
              onChange={setBirthDate}
              maximumDate={MAX_BIRTH_DATE}
              minimumDate={MIN_BIRTH_DATE}
              disabled={saving}
              eligible={ageEligible}
              ineligibleMessage={`You must be at least ${MIN_AGE} to use WEEKLY.`}
            />

            <LocationAutocomplete
              value={city}
              onChangeText={onTypeCity}
              onSelect={onSelectLocation}
              disabled={saving}
            />

            <LabeledInput
              label="Bio"
              hint={`${bio.length}/${BIO_MAX}`}
              placeholder="A little about you"
              value={bio}
              onChangeText={(t) => setBio(t.slice(0, BIO_MAX))}
              multiline
              maxLength={BIO_MAX}
              editable={!saving}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={!canSave}
            onPress={onSave}
            style={({ pressed }) => [
              styles.cta,
              !canSave && styles.ctaDisabled,
              pressed && canSave && styles.pressed,
            ]}
          >
            {saving ? <ActivityIndicator color={C.cream} /> : <Text style={styles.ctaText}>Save</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.xl },
  title: {
    fontSize: F.h2.fontSize,
    fontWeight: '800',
    color: C.text,
    marginBottom: S.md,
    textAlign: 'center',
  },
  warning: {
    fontSize: 13,
    color: C.danger,
    textAlign: 'center',
    marginBottom: S.sm,
  },
  form: { marginTop: S.sm },
  footer: {
    paddingHorizontal: S.lg,
    paddingTop: S.sm,
    paddingBottom: S.sm,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
    gap: S.xs,
  },
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
