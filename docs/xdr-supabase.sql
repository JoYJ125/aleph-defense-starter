-- XDR 거부 규칙·알림 저장용 테이블입니다. Supabase 대시보드의 SQL Editor 에서 학생이 직접 한 번 실행합니다.
-- 서버(Vercel API)만 서버 전용 키로 읽고 씁니다. 브라우저용 역할(anon·authenticated)에는 아무 권한도 주지 않습니다.

create table if not exists public.xdr_deny_rules (
  id text primary key,
  srcip text not null,
  evidence_alert_id text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  reason text not null,
  created_at timestamptz not null,
  expires_at timestamptz not null
);

create table if not exists public.xdr_alert_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  line text not null
);

create index if not exists xdr_deny_rules_srcip_idx on public.xdr_deny_rules (srcip, expires_at);

alter table public.xdr_deny_rules enable row level security;
alter table public.xdr_alert_log enable row level security;

revoke all on public.xdr_deny_rules from public, anon, authenticated;
revoke all on public.xdr_alert_log from public, anon, authenticated;
grant select, insert, update, delete on public.xdr_deny_rules to service_role;
grant select, insert on public.xdr_alert_log to service_role;
grant usage, select on sequence public.xdr_alert_log_id_seq to service_role;

-- 적용 후 확인: anon·authenticated 행이 나오지 않아야 합니다.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('xdr_deny_rules', 'xdr_alert_log')
  and grantee in ('anon', 'authenticated', 'PUBLIC');
