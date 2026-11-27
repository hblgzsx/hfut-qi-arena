create table if not exists public.arena_auto_backups (
 id uuid primary key default gen_random_uuid(),
 event_id text not null references public.private_events(id) on delete cascade,
 created_at timestamptz not null default now(),
 revision text not null,
 state jsonb not null
);
create index if not exists arena_auto_backups_event_time on public.arena_auto_backups(event_id,created_at desc);
alter table public.arena_auto_backups enable row level security;
revoke all on public.arena_auto_backups from public,anon,authenticated;
grant all on public.arena_auto_backups to service_role;

create or replace function public.arena_backup_event(p_id text,p_force boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare current_state jsonb; last_time timestamptz; minutes integer; enabled boolean;
begin
 select state into current_state from private_events where id=p_id and deleted_at is null for update;
 if not found then return jsonb_build_object('saved',false); end if;
 enabled=coalesce((current_state#>>'{event,autoBackup,enabled}')::boolean,false);
 if not enabled and not p_force then return jsonb_build_object('saved',false); end if;
 minutes=coalesce((current_state#>>'{event,autoBackup,intervalMinutes}')::integer,10);
 if minutes<1 or minutes>120 then raise exception '无效备份间隔'; end if;
 select max(created_at) into last_time from arena_auto_backups where event_id=p_id;
 if p_force or last_time is null or last_time<=now()-make_interval(mins=>minutes) then
  insert into arena_auto_backups(event_id,revision,state) values(p_id,current_state->>'revision',current_state);
  delete from arena_auto_backups where event_id=p_id and id not in (
    select id from arena_auto_backups where event_id=p_id order by created_at desc,id desc limit 72
  );
  last_time=now();
  return jsonb_build_object('saved',true,'lastBackupAt',last_time);
 end if;
 return jsonb_build_object('saved',false,'lastBackupAt',last_time);
end;
$$;
create or replace function public.arena_backup_due()
returns void language plpgsql security definer set search_path=public as $$
declare item record;
begin
 for item in select id from private_events where deleted_at is null
   and state#>>'{event,autoBackup,enabled}'='true'
 loop
   perform arena_backup_event(item.id);
 end loop;
end;
$$;
revoke all on function public.arena_backup_event(text,boolean),public.arena_backup_due() from public,anon,authenticated;
grant execute on function public.arena_backup_event(text,boolean),public.arena_backup_due() to service_role;
create extension if not exists pg_cron;
do $$
begin
 if not exists(select 1 from cron.job where jobname='arena-auto-backup') then
   perform cron.schedule('arena-auto-backup','* * * * *','select public.arena_backup_due()');
 end if;
end;
$$;
