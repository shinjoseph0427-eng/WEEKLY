// Supabase Edge Function: "places"
// Onboarding/profile location autocomplete proxy for the Google Places API (New).
//
// The Google Places key lives ONLY in this function's secrets
// (GOOGLE_PLACES_API_KEY) — it is never returned, never logged, and never shipped
// to the mobile app. The app calls this via supabase.functions.invoke("places")
// and receives ONLY a normalized shape (never the raw Google payload).
//
// Runtime note: this is Deno (Supabase Edge runtime), NOT the React Native app.
// It is excluded from the app's tsconfig and type-checked by the Supabase/Deno
// toolchain instead.
//
// Deploy WITHOUT --no-verify-jwt so only authenticated users (the app attaches
// the signed-in user's JWT automatically) can call it.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places';

const MIN_INPUT = 2;
const MAX_INPUT = 120;
const MAX_PLACE_ID = 300;
const MAX_SESSION_TOKEN = 100;

// ── Raw Google response shapes (only the fields we read) ─────────────────────
interface PredictionRaw {
  placeId?: string;
  text?: { text?: string };
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
}
interface AutocompleteRaw {
  suggestions?: { placePrediction?: PredictionRaw }[];
}
interface AddressComponentRaw {
  longText?: string;
  shortText?: string;
  types?: string[];
}
interface DetailsRaw {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: AddressComponentRaw[];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// City precedence: locality → postal_town → admin_area_2 → admin_area_1 → fallback.
function extractCity(components: AddressComponentRaw[] | undefined, fallback: string): string {
  if (!components) return fallback;
  const priority = [
    'locality',
    'postal_town',
    'administrative_area_level_2',
    'administrative_area_level_1',
  ];
  for (const t of priority) {
    const hit = components.find((c) => c.types?.includes(t));
    if (hit?.longText) return hit.longText;
  }
  return fallback;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!apiKey) return json({ error: 'Location service is not configured.' }, 500);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const type = body.type;
  const sessionToken =
    typeof body.sessionToken === 'string'
      ? body.sessionToken.slice(0, MAX_SESSION_TOKEN)
      : undefined;

  try {
    // ── Autocomplete ─────────────────────────────────────────────────────────
    if (type === 'autocomplete') {
      const input = typeof body.input === 'string' ? body.input.trim() : '';
      if (input.length < MIN_INPUT) return json({ error: 'Input too short.' }, 400);
      if (input.length > MAX_INPUT) return json({ error: 'Input too long.' }, 400);

      const res = await fetch(AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
        },
        body: JSON.stringify({
          input,
          includedPrimaryTypes: ['(cities)'], // city/region-level only (privacy)
          ...(sessionToken ? { sessionToken } : {}),
        }),
      });
      if (!res.ok) return json({ error: 'Autocomplete request failed.' }, 502);

      const data = (await res.json()) as AutocompleteRaw;
      const suggestions = (data.suggestions ?? [])
        .map((s) => s.placePrediction)
        .filter((p): p is PredictionRaw => Boolean(p?.placeId))
        .map((p) => ({
          placeId: p.placeId as string,
          description: p.text?.text ?? '',
          mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
          secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
        }));

      return json({ suggestions });
    }

    // ── Details ──────────────────────────────────────────────────────────────
    if (type === 'details') {
      const placeId = typeof body.placeId === 'string' ? body.placeId.trim() : '';
      if (!placeId) return json({ error: 'placeId is required.' }, 400);
      if (placeId.length > MAX_PLACE_ID) return json({ error: 'placeId too long.' }, 400);

      const url = new URL(`${DETAILS_URL}/${encodeURIComponent(placeId)}`);
      if (sessionToken) url.searchParams.set('sessionToken', sessionToken);

      const res = await fetch(url.toString(), {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents',
        },
      });
      if (!res.ok) return json({ error: 'Details request failed.' }, 502);

      const data = (await res.json()) as DetailsRaw;
      const lat = data.location?.latitude;
      const lng = data.location?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return json({ error: 'Place has no coordinates.' }, 502);
      }

      const fallback = data.displayName?.text ?? data.formattedAddress ?? '';
      return json({
        place: {
          placeId: data.id ?? placeId,
          city: extractCity(data.addressComponents, fallback),
          formattedAddress: data.formattedAddress ?? null,
          lat,
          lng,
        },
      });
    }

    return json({ error: 'Unknown request type.' }, 400);
  } catch {
    // Never surface upstream/internal details (which could leak request context).
    return json({ error: 'Location request failed.' }, 500);
  }
});
