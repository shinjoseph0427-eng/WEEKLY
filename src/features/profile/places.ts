// Location autocomplete adapter — calls a Supabase Edge Function that proxies
// Google Places server-side. The Places key lives ONLY in the Edge Function's
// secrets (read there via Deno.env); it never ships in the app, and this module
// never calls the Google endpoint directly or reads any EXPO_PUBLIC key.
//
// supabase.functions.invoke automatically attaches the signed-in user's JWT, so
// the function can authenticate/limit callers. We normalize the function's
// response here (small adapter) so the UI shape stays stable regardless of the
// deployed contract.
import { supabase } from '../../lib/supabase';

// Name of the deployed Edge Function. If your function is named differently
// (e.g. "google-places" / "places-proxy"), change it here in one place.
export const PLACES_FUNCTION_NAME = 'places';

// ── UI-facing shapes (kept stable for LocationAutocomplete) ──────────────────
export interface PlacePrediction {
  id: string; // placeId
  primary: string; // e.g. "Fullerton"
  secondary: string; // e.g. "CA, USA"
}

export interface PlaceLocation {
  placeId: string;
  city: string;
  formattedAddress: string | null;
  lat: number;
  lng: number;
}

// ── Expected Edge Function response shapes (see contract in the task) ─────────
interface AutocompleteResult {
  suggestions?: {
    placeId?: string;
    description?: string;
    mainText?: string;
    secondaryText?: string;
  }[];
}

interface DetailsResult {
  place?: {
    placeId?: string;
    city?: string;
    displayName?: string;
    formattedAddress?: string;
    lat?: number;
    lng?: number;
  };
}

/**
 * City/region predictions for a query via the Edge Function `autocomplete`
 * action. Returns an empty array for a genuine no-match, but THROWS when the
 * function/network fails so the UI can distinguish "no results" from "search
 * unavailable" and offer the manual-city fallback. `sessionToken` groups
 * keystrokes + the details call for Google billing.
 */
export async function searchPlaces(
  input: string,
  sessionToken?: string,
): Promise<PlacePrediction[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];

  if (__DEV__) console.log('[places] autocomplete →', trimmed.length, 'chars');

  const { data, error } = await supabase.functions.invoke<AutocompleteResult>(
    PLACES_FUNCTION_NAME,
    { body: { type: 'autocomplete', input: trimmed, sessionToken } },
  );

  if (error) {
    // FunctionsHttpError carries the (non-secret) response; surface status only.
    if (__DEV__) console.log('[places] autocomplete error:', error.message);
    throw error;
  }

  const suggestions = (data?.suggestions ?? [])
    .filter((s): s is NonNullable<typeof s> => Boolean(s?.placeId))
    .map((s) => ({
      id: s.placeId as string,
      primary: s.mainText ?? s.description ?? '',
      secondary: s.secondaryText ?? '',
    }));

  if (__DEV__) console.log('[places] suggestions:', suggestions.length);
  return suggestions;
}

/**
 * Resolve a prediction to a display city + coordinates via the Edge Function
 * `details` action. Throws on failure so the caller can fall back to a plain
 * city (with null lat/lng) rather than saving faked coordinates.
 */
export async function getPlaceDetails(
  placeId: string,
  sessionToken?: string,
): Promise<PlaceLocation> {
  const { data, error } = await supabase.functions.invoke<DetailsResult>(
    PLACES_FUNCTION_NAME,
    { body: { type: 'details', placeId, sessionToken } },
  );
  if (error) throw new Error('Could not load place details.');

  const place = data?.place;
  const lat = place?.lat;
  const lng = place?.lng;
  if (!place || typeof lat !== 'number' || typeof lng !== 'number') {
    throw new Error('Place has no coordinates.');
  }

  return {
    placeId: place.placeId ?? placeId,
    city: place.city ?? place.displayName ?? place.formattedAddress ?? '',
    formattedAddress: place.formattedAddress ?? null,
    lat,
    lng,
  };
}
