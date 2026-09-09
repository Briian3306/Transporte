-- CLI-only: guarantee francis@transporteibarra.com.ar can sign in after every db reset.
-- Applied by [db.seed] after seed_auth.sql. Do not use on DESARROLLO.

SET search_path = public, extensions, auth, pg_catalog;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  email_change_token_current,
  email_change_confirm_status,
  is_sso_user,
  is_anonymous
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '2103d8df-a4f7-46fd-9984-74e3ddf1d993',
  'authenticated',
  'authenticated',
  'francis@transporteibarra.com.ar',
  extensions.crypt('Transporte2026', extensions.gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object(
    'sub', '2103d8df-a4f7-46fd-9984-74e3ddf1d993',
    'email', 'francis@transporteibarra.com.ar',
    'email_verified', true,
    'phone_verified', false
  ),
  now(),
  now(),
  '',
  0,
  false,
  false
)
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
  confirmation_token = '',
  recovery_token = '',
  banned_until = NULL,
  deleted_at = NULL,
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  updated_at = now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM auth.identities i
    WHERE i.user_id = '2103d8df-a4f7-46fd-9984-74e3ddf1d993'
      AND i.provider = 'email'
  ) THEN
    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      '2103d8df-a4f7-46fd-9984-74e3ddf1d993',
      '2103d8df-a4f7-46fd-9984-74e3ddf1d993',
      jsonb_build_object(
        'sub', '2103d8df-a4f7-46fd-9984-74e3ddf1d993',
        'email', 'francis@transporteibarra.com.ar',
        'email_verified', true
      ),
      'email',
      now(),
      now(),
      now()
    );
  END IF;
END $$;

SET search_path = public, extensions, pg_catalog;
