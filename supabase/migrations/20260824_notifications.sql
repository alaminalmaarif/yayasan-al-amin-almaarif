create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 1000),
  topic text not null default 'all',
  sent_by uuid references auth.users(id),
  sent_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
create policy "notifications_not_public" on public.notifications for select using (false);
