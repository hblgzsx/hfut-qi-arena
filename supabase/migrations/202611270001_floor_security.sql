-- Secrets and event grants never enter downloadable event state.
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.arena_event_access (
  event_id text primary key references public.private_events(id) on delete cascade,
  password_hash text not null,
  version uuid not null default gen_random_uuid()
);
create table if not exists public.arena_event_grants (
  event_id text not null references public.private_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  secret_hash text,
  version uuid,
  expires_at timestamptz,
  attempts integer not null default 0,
  retry_at timestamptz not null default now(),
  primary key(event_id,user_id)
);
alter table public.arena_event_access enable row level security;
alter table public.arena_event_grants enable row level security;
revoke all on public.arena_event_access,public.arena_event_grants from public,anon,authenticated;
grant all on public.arena_event_access,public.arena_event_grants to service_role;

create or replace function public.arena_access(
  p_event text,p_user uuid,p_action text,p_password text default '',p_secret text default ''
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare access_row public.arena_event_access;
        grant_row public.arena_event_grants;
        secret text;
        is_admin boolean;
begin
  select role in ('admin','superadmin') into is_admin from profiles where id=p_user;
  perform 1 from private_events where id=p_event and deleted_at is null for update;
  if not found then raise exception '竞赛不存在'; end if;
  select * into access_row from arena_event_access where event_id=p_event;
  if p_action='status' then
    if access_row.event_id is null then return jsonb_build_object('configured',false,'allowed',false); end if;
    select * into grant_row from arena_event_grants where event_id=p_event and user_id=p_user;
    return jsonb_build_object('configured',true,'allowed',
      coalesce(grant_row.version=access_row.version and grant_row.expires_at>now()
        and grant_row.secret_hash=encode(digest(p_secret,'sha256'),'hex'),false));
  end if;
  if p_action='set' and not coalesce(is_admin,false) then raise exception '仅管理员可设置赛事密码'; end if;
  if p_action not in ('set','unlock','check') then raise exception '无效操作'; end if;
  insert into arena_event_grants(event_id,user_id) values(p_event,p_user) on conflict do nothing;
  select * into grant_row from arena_event_grants where event_id=p_event and user_id=p_user for update;
  if grant_row.retry_at>now() then return jsonb_build_object('error','尝试过多，请一分钟后重试'); end if;
  if access_row.event_id is not null and (p_action<>'set' or p_secret<>'') then
    if access_row.password_hash<>crypt(p_password,access_row.password_hash) then
      update arena_event_grants set attempts=case when attempts>=4 then 0 else attempts+1 end,
        retry_at=case when attempts>=4 then now()+interval '1 minute' else now() end
        where event_id=p_event and user_id=p_user;
      return jsonb_build_object('error','赛事密码错误');
    end if;
  elsif p_action<>'set' then return jsonb_build_object('error','请管理员先设置当前赛事密码');
  end if;
  if p_action='set' then
    -- Existing password is mandatory for rotation; initial setup needs admin only.
    if access_row.event_id is not null and p_secret='' then return jsonb_build_object('error','修改密码需要当前赛事密码'); end if;
    if length(p_secret)<8 or octet_length(p_secret)>72 then return jsonb_build_object('error','新密码须至少 8 字符且不超过 72 字节'); end if;
    insert into arena_event_access(event_id,password_hash) values(p_event,crypt(p_secret,gen_salt('bf')))
      on conflict(event_id) do update set password_hash=excluded.password_hash,version=gen_random_uuid();
    return jsonb_build_object('ok',true);
  end if;
  update arena_event_grants set attempts=0,retry_at=now() where event_id=p_event and user_id=p_user;
  if p_action='check' then return jsonb_build_object('ok',true); end if;
  secret=encode(gen_random_bytes(32),'hex');
  update arena_event_grants set secret_hash=encode(digest(secret,'sha256'),'hex'),
    version=access_row.version,expires_at=now()+interval '12 hours' where event_id=p_event and user_id=p_user;
  return jsonb_build_object('ok',true,'secret',secret);
end;
$$;
revoke all on function public.arena_access(text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.arena_access(text,uuid,text,text,text) to service_role;
