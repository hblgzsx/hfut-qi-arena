-- Apply once in Supabase SQL Editor. No client can write tournament tables directly.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 40),
  email text not null,
  role text not null default 'pending' check (role in ('pending','referee','admin','blocked')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
create policy "read own profile" on public.profiles for select to authenticated using (id=auth.uid());

create or replace function public.on_arena_signup() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,display_name,email,role)
  values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'裁判'),40),coalesce(new.email,''),'pending');
  return new;
end; $$;
revoke all on function public.on_arena_signup() from public,anon,authenticated;
drop trigger if exists arena_signup on auth.users;
create trigger arena_signup after insert on auth.users for each row execute function public.on_arena_signup();

create table if not exists public.private_events (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.private_events enable row level security;
revoke all on public.private_events from anon,authenticated;

create table if not exists public.public_events (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.public_events enable row level security;
revoke all on public.public_events from anon,authenticated;
grant select on public.public_events to anon,authenticated;
create policy "public scoreboard" on public.public_events for select to anon,authenticated using (true);

-- Atomic CAS: private state and redacted public snapshot commit in the SAME transaction.
-- Only the server-held service_role may invoke this function.
create or replace function public.arena_commit(p_id text,p_revision text,p_state jsonb,p_public jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare current_revision text;
begin
  select state->>'revision' into current_revision from public.private_events where id=p_id for update;
  if not found or current_revision is distinct from p_revision then return false; end if;
  update public.private_events set state=p_state,updated_at=now() where id=p_id;
  insert into public.public_events(id,state) values(p_id,p_public)
    on conflict(id) do update set state=excluded.state,updated_at=now();
  return true;
end; $$;
revoke all on function public.arena_commit(text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.arena_commit(text,text,jsonb,jsonb) to service_role;
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='public_events' and schemaname='public') then
    alter publication supabase_realtime add table public.public_events;
  end if;
end; $$;
