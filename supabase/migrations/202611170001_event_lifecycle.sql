-- Names are unique among active competitions; deletion is recoverable.
alter table public.private_events add column if not exists deleted_at timestamptz;
create or replace function public.arena_event_name_key(value text) returns text
language sql immutable set search_path=public as $$
 select lower(regexp_replace(coalesce(value,'五院研究生棋类友谊赛'),'[[:space:]　]+','','g'));
$$;
create or replace function public.arena_check_event_name() returns trigger
language plpgsql set search_path=public as $$
declare name_key text;
begin
 if new.deleted_at is not null then return new; end if;
 name_key=public.arena_event_name_key(new.state->'event'->>'name');
 if tg_op='UPDATE' then
  if old.deleted_at is null and public.arena_event_name_key(old.state->'event'->>'name')=name_key then return new; end if;
 end if;
 -- Serialize competing creates/renames, including backup restores. Existing legacy
 -- duplicate names remain readable and scoreable until explicitly renamed/deleted.
 perform pg_advisory_xact_lock(hashtextextended(name_key,170001));
 if exists(select 1 from public.private_events e where e.id<>new.id and e.deleted_at is null and public.arena_event_name_key(e.state->'event'->>'name')=name_key) then
  raise exception '已存在同名竞赛，请使用其他比赛名称。' using errcode='23505';
 end if;
 return new;
end; $$;
drop trigger if exists arena_event_name on public.private_events;
create trigger arena_event_name before insert or update on public.private_events for each row execute function public.arena_check_event_name();

create or replace function public.arena_commit(p_id text,p_revision text,p_state jsonb,p_public jsonb,p_actor uuid default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare current_revision text; archived timestamptz;
begin
 select state->>'revision',deleted_at into current_revision,archived from public.private_events where id=p_id for update;
 if not found or archived is not null or current_revision is distinct from p_revision then return false; end if;
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

create or replace function public.arena_set_event_deleted(p_id text,p_revision text,p_name text,p_deleted boolean,p_state jsonb,p_public jsonb,p_actor uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare current_state jsonb; archived timestamptz;
begin
 select state,deleted_at into current_state,archived from public.private_events where id=p_id for update;
 if not found or (current_state->>'revision') is distinct from p_revision
 or coalesce(current_state->'event'->>'name','五院研究生棋类友谊赛') is distinct from p_name
 or (archived is not null)=p_deleted then return false; end if;
 update public.private_events set state=p_state,deleted_at=case when p_deleted then now() else null end,updated_at=now() where id=p_id;
 if p_deleted then delete from public.public_events where id=p_id;
 else
  insert into public.public_events(id,state) values(p_id,p_public)
  on conflict(id) do update set state=excluded.state,updated_at=now();
 end if;
 insert into public.event_audit(event_id,entry_id,actor_id,sport,message,happened_at)
 values(p_id,(p_state->'audit'->0->>'id')::uuid,p_actor,p_state->'audit'->0->>'sport',p_state->'audit'->0->>'message',(p_state->'audit'->0->>'time')::timestamptz);
 return true;
end; $$;
revoke all on function public.arena_set_event_deleted(text,text,text,boolean,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.arena_set_event_deleted(text,text,text,boolean,jsonb,jsonb,uuid) to service_role;
create or replace function public.arena_create_event(p_id text,p_state jsonb,p_public jsonb,p_actor uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 insert into public.private_events(id,state) values(p_id,p_state);
 return public.arena_commit(p_id,p_state->>'revision',p_state,p_public,p_actor);
end; $$;
revoke all on function public.arena_create_event(text,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.arena_create_event(text,jsonb,jsonb,uuid) to service_role;
revoke all on function public.arena_check_event_name() from public,anon,authenticated;
revoke all on function public.arena_event_name_key(text) from public,anon,authenticated;
grant execute on function public.arena_event_name_key(text) to service_role;
