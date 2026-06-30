// Venue suggestions for the PLAN card — ported from web src/lib/venueSuggest.js
// (KEEP). All Google Places calls go through the `suggest-venues` Edge Function;
// the API key never touches the client.
import { supabase } from '../../lib/supabase';

export interface Venue {
  name: string;
  address?: string;
  place_type?: string;
  google_place_id?: string;
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export async function suggestVenues(place: string, activity: string): Promise<Venue[]> {
  const p = (place || '').trim();
  const a = (activity || '').trim();
  if (!p && !a) return [];

  try {
    const { data, error } = await supabase.functions.invoke('suggest-venues', {
      body: { place: p, activity: a },
    });
    if (error) {
      console.error('Venue suggestion error:', error);
      return [];
    }
    return (data?.venues || []) as Venue[];
  } catch (e) {
    console.error('Venue suggestion failed:', e);
    return [];
  }
}

export function suggestVenuesDebounced(
  place: string,
  activity: string,
  callback: (venues: Venue[]) => void,
  delay = 400,
): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const venues = await suggestVenues(place, activity);
    callback(venues);
  }, delay);
}

export const CATEGORY_EMOJI: Record<string, string> = {
  matcha: '🍵',
  boba: '🧋',
  kbbq: '🥩',
  karaoke: '🎤',
  dessert: '🍦',
  cafe: '☕',
  food: '🍜',
  other: '📍',
};

// "🧋 Boba Time, Irvine" style prefix; empty for 'other'/unknown.
export function categoryEmojiPrefix(placeType?: string): string {
  if (!placeType || placeType === 'other') return '';
  const emoji = CATEGORY_EMOJI[placeType];
  return emoji ? `${emoji} ` : '';
}
