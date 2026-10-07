-- 학습 DB 전용 권한 점검·회수 SQL입니다.
-- 대상은 public.learning_memos 하나뿐입니다. RLS와 정책은 변경하지 않습니다.
-- 아래 1단계 결과를 먼저 저장하고, 2단계를 실행한 뒤 3단계 결과와 대조하세요.

-- 1) 적용 전 확인
-- role_table_grants는 anon/authenticated에 표시되는 직접 권한을 확인합니다.
SELECT
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'learning_memos'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- PUBLIC 권한도 포함해 직접 부여된 권한을 확인합니다.
SELECT
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'learning_memos'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- 두 역할이 실제로 사용할 수 있는 테이블 권한(직접·PUBLIC·상속 포함)을 확인합니다.
WITH roles(role_name) AS (
  VALUES ('anon'::name), ('authenticated'::name)
),
privileges(privilege_type) AS (
  VALUES
    ('SELECT'::text),
    ('INSERT'::text),
    ('UPDATE'::text),
    ('DELETE'::text),
    ('TRUNCATE'::text),
    ('REFERENCES'::text),
    ('TRIGGER'::text)
)
SELECT
  r.role_name,
  p.privilege_type,
  has_table_privilege(
    r.role_name,
    'public.learning_memos',
    p.privilege_type
  ) AS has_privilege
FROM roles AS r
CROSS JOIN privileges AS p
ORDER BY r.role_name, p.privilege_type;

-- 2) 권한 회수
-- 이 트랜잭션은 권한만 바꾸며, 다른 테이블·RLS·정책을 변경하지 않습니다.
BEGIN;

REVOKE ALL PRIVILEGES
ON TABLE public.learning_memos
FROM PUBLIC, anon, authenticated;

-- 상속 등으로 유효 권한이 남으면 중단되어 REVOKE도 롤백됩니다.
DO $$
BEGIN
  IF EXISTS (
    WITH roles(role_name) AS (
      VALUES ('anon'::name), ('authenticated'::name)
    ),
    privileges(privilege_type) AS (
      VALUES
        ('SELECT'::text),
        ('INSERT'::text),
        ('UPDATE'::text),
        ('DELETE'::text),
        ('TRUNCATE'::text),
        ('REFERENCES'::text),
        ('TRIGGER'::text)
    )
    SELECT 1
    FROM roles AS r
    CROSS JOIN privileges AS p
    WHERE has_table_privilege(
      r.role_name,
      'public.learning_memos',
      p.privilege_type
    )
  ) THEN
    RAISE EXCEPTION
      'anon 또는 authenticated에 유효 테이블 권한이 남았습니다. 권한 상속을 확인하세요.';
  END IF;
END
$$;

COMMIT;

-- 3) 적용 후 확인: 아래 세 조회를 적용 전 결과와 대조합니다.
SELECT
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'learning_memos'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

SELECT
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'learning_memos'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY grantee, privilege_type;

WITH roles(role_name) AS (
  VALUES ('anon'::name), ('authenticated'::name)
),
privileges(privilege_type) AS (
  VALUES
    ('SELECT'::text),
    ('INSERT'::text),
    ('UPDATE'::text),
    ('DELETE'::text),
    ('TRUNCATE'::text),
    ('REFERENCES'::text),
    ('TRIGGER'::text)
)
SELECT
  r.role_name,
  p.privilege_type,
  has_table_privilege(
    r.role_name,
    'public.learning_memos',
    p.privilege_type
  ) AS has_privilege
FROM roles AS r
CROSS JOIN privileges AS p
ORDER BY r.role_name, p.privilege_type;
