CREATE TABLE IF NOT EXISTS public.learning_memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.learning_memos
ADD COLUMN IF NOT EXISTS owner_id uuid;

ALTER TABLE public.learning_memos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learning_memos_public_read
ON public.learning_memos;

REVOKE ALL PRIVILEGES ON TABLE public.learning_memos
FROM PUBLIC, anon, authenticated;

SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'learning_memos'
      AND column_name = 'owner_id'
      AND udt_name = 'uuid'
  ) AS owner_id_is_uuid,
  COALESCE((
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.learning_memos'::regclass
  ), false) AS rls_enabled,
  NOT has_table_privilege('anon', 'public.learning_memos', 'SELECT') AS anon_select_denied,
  NOT has_table_privilege('authenticated', 'public.learning_memos', 'SELECT') AS authenticated_select_denied,
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'learning_memos'
      AND cmd IN ('ALL', 'SELECT')
      AND roles && ARRAY['public'::name, 'anon'::name, 'authenticated'::name]
  ) AS no_public_read_policy,
  NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint_row
    JOIN pg_attribute AS column_row
      ON column_row.attrelid = constraint_row.conrelid
      AND column_row.attnum = ANY (constraint_row.conkey)
    WHERE constraint_row.conrelid = 'public.learning_memos'::regclass
      AND constraint_row.contype = 'f'
      AND column_row.attname = 'owner_id'
      AND constraint_row.confrelid = 'auth.users'::regclass
  ) AS owner_id_has_no_auth_users_fk;