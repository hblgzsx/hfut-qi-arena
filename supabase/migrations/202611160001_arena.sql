-- Apply once in Supabase SQL Editor. No client can write tournament tables directly.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 40),
  email text not null,
  role text not null default 'pending' check (role in ('pending','referee','admin','superadmin','blocked')),
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
  values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'管理员申请'),40),coalesce(new.email,''),'pending');
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

-- Append-only audit archive. Snapshot keeps 200 recent entries; this archive keeps ALL entries.
create table if not exists public.event_audit (
  sequence bigint generated always as identity primary key,
  event_id text not null,
  entry_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  sport text not null,
  message text not null,
  happened_at timestamptz not null,
  unique(event_id,entry_id)
);
create index if not exists event_audit_event_sequence on public.event_audit(event_id,sequence desc);
alter table public.event_audit enable row level security;
revoke all on public.event_audit from anon,authenticated;
grant all on public.profiles,public.private_events,public.public_events,public.event_audit to service_role;
grant usage,select on sequence public.event_audit_sequence_seq to service_role;

-- Atomic CAS: private state and redacted public snapshot commit in the SAME transaction.
-- Only the server-held service_role may invoke this function.
create or replace function public.arena_commit(p_id text,p_revision text,p_state jsonb,p_public jsonb,p_actor uuid default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare current_revision text;
begin
  select state->>'revision' into current_revision from public.private_events where id=p_id for update;
  if not found or current_revision is distinct from p_revision then return false; end if;
  update public.private_events set state=p_state,updated_at=now() where id=p_id;
  insert into public.public_events(id,state) values(p_id,p_public)
    on conflict(id) do update set state=excluded.state,updated_at=now();
  if jsonb_array_length(p_state->'audit')>0 then
    insert into public.event_audit(event_id,entry_id,actor_id,sport,message,happened_at)
    values(p_id,(p_state->'audit'->0->>'id')::uuid,p_actor,p_state->'audit'->0->>'sport',p_state->'audit'->0->>'message',(p_state->'audit'->0->>'time')::timestamptz)
    on conflict(event_id,entry_id) do nothing;
  end if;
  return true;
end; $$;
revoke all on function public.arena_commit(text,text,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.arena_commit(text,text,jsonb,jsonb,uuid) to service_role;
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='public_events' and schemaname='public') then
    alter publication supabase_realtime add table public.public_events;
  end if;
end; $$;
