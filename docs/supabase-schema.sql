create table if not exists public.user_library_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_library_states enable row level security;

create policy "users_can_read_own_library"
on public.user_library_states
for select
to authenticated
using (auth.uid() = user_id);

create policy "users_can_insert_own_library"
on public.user_library_states
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users_can_update_own_library"
on public.user_library_states
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.deezer_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  encrypted_arl text not null,
  arl_hint text,
  deezer_user_id text,
  status text not null default 'connected'
    check (status in ('connected', 'expired', 'invalid')),
  last_verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.deezer_connections enable row level security;

create policy "users_can_read_own_deezer_connection"
on public.deezer_connections
for select
to authenticated
using (auth.uid() = user_id);

create policy "users_can_insert_own_deezer_connection"
on public.deezer_connections
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users_can_update_own_deezer_connection"
on public.deezer_connections
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users_can_delete_own_deezer_connection"
on public.deezer_connections
for delete
to authenticated
using (auth.uid() = user_id);
