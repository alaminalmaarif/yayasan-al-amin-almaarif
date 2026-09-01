-- PIN wali murid per Anak + Unit, tidak mengikuti tahun ajaran.
create table if not exists public.finance_student_pins (
  id uuid primary key default gen_random_uuid(),
  unit text not null check (unit in ('KB','RA','TPQ','MDT','Pesantren','MTs','MA')),
  student_name text not null,
  pin text not null check (pin ~ '^[0-9]{4,6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(unit, student_name)
);

create table if not exists public.finance_pin_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  student_id uuid references public.finance_students(id),
  student_name text not null,
  unit text not null check (unit in ('KB','RA','TPQ','MDT','Pesantren','MTs','MA')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists finance_pin_sessions_expiry_idx on public.finance_pin_sessions(expires_at);
create index if not exists finance_student_pins_context_idx on public.finance_student_pins(unit, student_name);

alter table public.finance_student_pins enable row level security;
alter table public.finance_pin_sessions enable row level security;

-- PIN dan sesi tidak dapat dibaca langsung oleh anon/authenticated.
-- Edge Functions menggunakan service role untuk operasi PIN.
