-- WEEKLY app (Phase 1) — profile-seeding trigger.
--
-- Runs against the SAME Supabase project as the web app.
--
-- Context: the web app seeded public.profiles inside signUp/signIn (email/pw).
-- The app is OAuth-only (Apple + Google) with no such client hook, so profile
-- rows are now seeded DB-side: an AFTER INSERT trigger on auth.users creates a
-- minimal profiles row (onboarding_complete = false) for every new account.
--
-- SECURITY DEFINER so it runs with the function owner's rights (the insert
-- happens during Supabase's auth flow, not as the end user). ON CONFLICT DO
-- NOTHING keeps it idempotent and prevents resetting an existing user's row.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, onboarding_complete)
  VALUES (NEW.id, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Recreate the trigger idempotently.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
