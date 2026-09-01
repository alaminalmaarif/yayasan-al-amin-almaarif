-- Fitur baru: saran, master siswa, rekap keuangan, dan pembayaran QRIS manual.
alter table public.feedback_messages add column if not exists sender_name text;
alter table public.feedback_messages add column if not exists status text not null default 'belum_dibaca'
  check (status in ('belum_dibaca','sudah_dibaca','sudah_ditangani'));

create table if not exists public.finance_students (
  id uuid primary key default gen_random_uuid(), academic_year text not null check (academic_year ~ '^\\d{4}/\\d{4}$'),
  unit text not null check (unit in ('KB','RA','TPQ','MDT','Pesantren','MTs','MA')), student_name text not null,
  created_at timestamptz not null default now(), unique(academic_year,unit,student_name)
);
create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(), order_id text unique, academic_year text not null check (academic_year ~ '^\\d{4}/\\d{4}$'),
  unit text not null check (unit in ('KB','RA','TPQ','MDT','Pesantren','MTs','MA')), student_name text not null,
  payment_type text not null check (payment_type in ('Tabungan Wajib','Tabungan Sukarela','SPP','Kegiatan','PPDB','Bantuan')),
  amount bigint not null check(amount>0), payment_status text check(payment_status in ('Lunas','Cicil','Lunasi Cicilan')),
  payment_date date, payment_month text, activity text, purpose text, deduct_mandatory boolean not null default false,
  source text not null check(source in ('manual','qris')), verification_status text not null default 'accepted'
    check(verification_status in ('pending','accepted','rejected')), verification_note text,
  created_at timestamptz not null default now(), verified_at timestamptz
);
create index if not exists finance_transactions_context_idx on public.finance_transactions(academic_year,unit,created_at desc);
create index if not exists finance_students_context_idx on public.finance_students(academic_year,unit,student_name);
-- Identitas siswa dibuat eksplisit agar transaksi tidak hanya bergantung pada nama.
alter table public.finance_transactions add column if not exists student_id uuid references public.finance_students(id);
create index if not exists finance_transactions_student_idx on public.finance_transactions(student_id, academic_year, unit, created_at desc);

-- Backfill transaksi lama yang namanya masih unik pada konteks tahun ajaran + unit.
update public.finance_transactions t
set student_id = s.id
from public.finance_students s
where t.student_id is null
  and t.academic_year = s.academic_year
  and t.unit = s.unit
  and t.student_name = s.student_name;

alter table public.finance_students enable row level security;
alter table public.finance_transactions enable row level security;
-- Semua akses baca/tulis dashboard dilakukan melalui Edge Functions; aplikasi publik hanya memanggil function khusus.
create or replace function public.finance_public_students(p_year text,p_unit text) returns table(student_name text)
language sql security definer set search_path=public as $$ select student_name from finance_students where academic_year=p_year and unit=p_unit order by student_name $$;
grant execute on function public.finance_public_students(text,text) to anon, authenticated;

-- Validasi tambahan untuk menjaga aturan transaksi baru di database.
alter table public.finance_transactions
  drop constraint if exists finance_transactions_deduct_mandatory_check;
alter table public.finance_transactions
  add constraint finance_transactions_deduct_mandatory_check
  check (deduct_mandatory = false or payment_type = 'Kegiatan');

alter table public.finance_transactions
  drop constraint if exists finance_transactions_payment_status_check;
alter table public.finance_transactions
  add constraint finance_transactions_payment_status_check
  check (
    payment_type in ('Tabungan Wajib','Tabungan Sukarela','Bantuan')
    or payment_status in ('Lunas','Cicil','Lunasi Cicilan')
  );
