alter type audit_action add value if not exists 'mfa_enrolled';

create table admin_mfa_recovery_codes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  unique (user_id, code_hash)
);

create index admin_mfa_recovery_codes_user_idx
  on admin_mfa_recovery_codes(user_id, created_at desc);

alter table admin_mfa_recovery_codes enable row level security;
