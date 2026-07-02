-- WEEKLY app — add full date-of-birth column for exact 18+ verification.
--
-- Context: onboarding previously stored only birth_year, which is insufficient
-- to verify a user is 18+ on the correct calendar day. birth_date becomes the
-- source of truth; birth_year is kept and written as the year of birth_date for
-- backward compatibility with existing code paths (discovery cards, etc.).
--
-- age is intentionally NOT used as a source of truth: it changes daily and must
-- be derived from birth_date at read time.

alter table public.profiles
  add column if not exists birth_date date;

comment on column public.profiles.birth_date is
  'User date of birth for exact 18+ onboarding verification. Source of truth; birth_year is derived from this.';
