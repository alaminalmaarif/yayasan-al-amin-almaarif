create extension if not exists pgcrypto;
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), order_id text not null unique,
  student_name text not null, unit text not null,
  payment_status text not null check (payment_status in ('lunas','cicil')),
  amount bigint not null check (amount > 0), description text,
  gateway text not null default 'midtrans', gateway_status text not null default 'pending',
  snap_token text, transaction_id text, payment_type text, paid_at timestamptz,
  raw_response jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists payments_created_at_idx on public.payments(created_at desc);
create index if not exists payments_student_idx on public.payments(student_name);
create index if not exists payments_unit_idx on public.payments(unit);
alter table public.payments enable row level security;
drop policy if exists payments_no_public_select on public.payments;
create policy payments_no_public_select on public.payments for select using (false);
create table if not exists public.feedback_messages (id uuid primary key default gen_random_uuid(), message text not null, created_at timestamptz not null default now());
alter table public.feedback_messages enable row level security;
drop policy if exists feedback_no_public_select on public.feedback_messages;
create policy feedback_no_public_select on public.feedback_messages for select using (false);
