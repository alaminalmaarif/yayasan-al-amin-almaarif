-- Perbaikan fitur Saran & Masukan + Pengeluaran Rekap Keuangan.
-- Tidak menghapus/mengubah tabel existing yang tidak terkait.

create table if not exists public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null check (academic_year ~ '^\\d{4}/\\d{4}$'),
  unit text not null check (unit in ('KB','RA','TPQ','MDT','Pesantren','MTs','MA')),
  amount bigint not null check (amount > 0),
  purpose text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.finance_expenses add column if not exists academic_year text;
alter table public.finance_expenses add column if not exists unit text;
alter table public.finance_expenses add column if not exists amount bigint;
alter table public.finance_expenses add column if not exists purpose text;
alter table public.finance_expenses add column if not exists note text;
alter table public.finance_expenses add column if not exists created_at timestamptz default now();

create index if not exists finance_expenses_context_idx
  on public.finance_expenses(academic_year, unit, created_at desc);

alter table public.finance_expenses enable row level security;

-- Semua akses admin dilakukan melalui Edge Function dengan service role.
-- Tidak memberi akses langsung anon/authenticated ke tabel ini.
