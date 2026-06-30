// Design tokens — WEEKLY: clean white + orange
// Ported verbatim from web src/tokens.js (values unchanged), typed `as const`.
//
// RN consumer note: web used CSS shorthands here (`padding: '14px 16px'`,
// `linear-gradient(...)`, `box-shadow`). The token VALUES are preserved as-is;
// RN consumers map them later (numeric padding, expo-linear-gradient,
// shadow*/elevation). Do NOT rewrite consumers in this phase.

export const C = {
  // ─── THEME NOTE ──────────────────────────────────────────────────────────
  // This app migrated from dark → light theme.
  // Token names were NOT renamed during migration.
  // C.white = '#111111'  ← primary TEXT color (dark)
  // C.cream = '#FFFFFF'  ← text ON orange buttons
  // C.bg    = '#FFFFFF'  ← page background (white)
  // For new tokens, use semantic names:
  //   C.text, C.textMuted, C.surface
  // ─────────────────────────────────────────────────────────────────────────

  // ── Backgrounds ──────────────────────────────────────────────────────────
  bg:           '#FFFFFF',
  bg2:          '#FAFAFA',
  cardDeep:     '#F7F7F7',
  cardElevated: '#FFFFFF',
  cardHov:      '#F5F5F5',

  // ── Text (near-black on white) ────────────────────────────────────────────
  white:  '#111111',                      // primary text — kept as "white" alias for compat
  muted:  'rgba(17,17,17,0.55)',          // secondary text
  cream:  '#FFFFFF',                      // text on colored (orange) buttons

  // ── Lines ─────────────────────────────────────────────────────────────────
  border: 'rgba(17,17,17,0.10)',

  // ── Orange accent (10-15% rule) ───────────────────────────────────────────
  amber:       '#FF6B00',   // primary accent — CTA, active states, badges
  orange:      '#FF6B00',
  orangeSoft:  '#FF8A1F',
  orangeSurface: '#FFF3E8',
  sunlight:    '#FF8A1F',
  purple:      '#8B5CF6',
  purpleT08:   'rgba(139,92,246,0.08)',
  purpleT14:   'rgba(139,92,246,0.14)',
  purpleBorder:'rgba(139,92,246,0.25)',

  // ── Status ────────────────────────────────────────────────────────────────
  success: '#16A34A',
  danger:  '#EF4444',

  // ── Semantic aliases ──────────────────────────────────────────────────────
  brown:     '#FF6B00',   // mapped to orange for compat
  moss:      '#16A34A',
  olive:     '#16A34A',
  leaf:      '#22C55E',
  sage:      '#FFF3E8',
  greenDeep: '#15803D',
  greenBorder:  'rgba(22,163,74,0.20)',
  brownBorder:  'rgba(255,107,0,0.18)',
  mutedBrown:   'rgba(17,17,17,0.55)',

  // ── CTA gradient — orange only ────────────────────────────────────────────
  gradientCTA:    'linear-gradient(135deg, #FF6B00 0%, #FF8A1F 100%)',
  gradientCafe:   '#FFFFFF',   // was dark card, now white
  gradientLeaf:   '#FFF3E8',   // light orange surface
  gradientViolet: '#F7F7F7',   // light gray surface

  // ── Accent washes ─────────────────────────────────────────────────────────
  amberT08:  'rgba(255,107,0,0.08)',
  amberT14:  'rgba(255,107,0,0.12)',
  amberT22:  'rgba(255,107,0,0.18)',
  amberT35:  'rgba(255,107,0,0.28)',
  greenT08:  'rgba(22,163,74,0.08)',
  greenT12:  'rgba(22,163,74,0.12)',
  greenT20:  'rgba(22,163,74,0.18)',
  greenT30:  'rgba(22,163,74,0.28)',

  // ── Backward-compat aliases ───────────────────────────────────────────────
  card:      '#FFFFFF',
  sand:      '#FFFFFF',
  foam:      '#FAFAFA',
  warm:      '#111111',
  rose:      '#FFF3E8',
  violet:    '#FF8A1F',
  oceanMist: '#7CA6A0',
  gray:      'rgba(17,17,17,0.55)',
  gray2:     'rgba(17,17,17,0.10)',
  green:     '#16A34A',
  red:       '#EF4444',
  orangeT08: 'rgba(255,107,0,0.08)',
  orangeT10: 'rgba(255,107,0,0.10)',
  orangeT12: 'rgba(255,107,0,0.12)',
  orangeT15: 'rgba(255,107,0,0.15)',
  orangeT30: 'rgba(255,107,0,0.22)',
  orangeT40: 'rgba(255,107,0,0.30)',
  brownMid:  '#FF8A1F',
  brownDeep: '#FF6B00',

  // ── Preferred semantic aliases for new code ──────────────────────────────
  text:       '#111111',
  textMuted:  '#6B7280',
  surface:    '#FFFFFF',
  surfaceAlt: '#FAFAFA',
} as const;

export const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #FF6B00, #FF8A1F)',
  'linear-gradient(135deg, #16A34A, #22C55E)',
  'linear-gradient(135deg, #2563EB, #60A5FA)',
  'linear-gradient(135deg, #7C3AED, #A78BFA)',
  'linear-gradient(135deg, #DB2777, #F472B6)',
  'linear-gradient(135deg, #EA580C, #FB923C)',
  'linear-gradient(135deg, #0891B2, #38BDF8)',
  'linear-gradient(135deg, #65A30D, #A3E635)',
] as const;

export const F = {
  family:        "'Inter', system-ui, -apple-system, Roboto, sans-serif",
  displayFamily: "'Satoshi', 'Inter', system-ui, sans-serif",
  labelFamily:   "'Archivo', 'Inter', system-ui, sans-serif",
  accentFamily:  "'Inter', system-ui, sans-serif",
  display: { fontSize: 40, fontWeight: 900, letterSpacing: -1.2, fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif" },
  h1:      { fontSize: 28, fontWeight: 850, letterSpacing: -0.8, fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif" },
  h2:      { fontSize: 22, fontWeight: 850, letterSpacing: -0.35, fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif" },
  h3:      { fontSize: 18, fontWeight: 750, fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif" },
  h3light: { fontSize: 18, fontWeight: 400 },
  body:    { fontSize: 15, fontWeight: 400, lineHeight: 1.6, fontFamily: "'Inter', system-ui, sans-serif" },
  sm:      { fontSize: 13, fontWeight: 400, lineHeight: 1.5 },
  label:   { fontSize: 10, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase', color: 'rgba(17,17,17,0.45)', fontFamily: "'Archivo', 'Inter', system-ui, sans-serif" },
} as const;

export const R = {
  sm: 12, md: 16, lg: 20, xl: 24, xxl: 20, pill: 9999, full: '9999px',
} as const;

export const S = {
  micro: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48, hero: 64,
} as const;

export const APP_MAX_WIDTH = 448;

export const E = {
  cardShadow:   '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)',
  liftShadow:   '0 4px 24px rgba(0,0,0,0.10)',
  buttonShadow: '0 4px 16px rgba(255,107,0,0.28)',
} as const;
