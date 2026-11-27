alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists deleted_by uuid;
create index if not exists arena_profiles_active_search on public.profiles(role,created_at desc) where deleted_at is null;

-- A restored event or a new binding must reference a live referee account.
-- Profile row locks serialize configuration against deletion and role changes.
create or replace function public.arena_guard_referee_bindings()
returns trigger language plpgsql security definer set search_path=public as $$
declare binding record; judge record;
begin
 if tg_op='UPDATE' then
  if new.state#>'{schedule,bindings}' is not distinct from old.state#>'{schedule,bindings}'
    and not (old.deleted_at is not null and new.deleted_at is null) then return new; end if;
 end if;
 for binding in select key,value from jsonb_each(coalesce(new.state#>'{schedule,bindings}','{}'::jsonb)) order by key loop
  if jsonb_typeof(binding.value)='array' and jsonb_array_length(binding.value)>0 then
   select role,deleted_at into judge from public.profiles where id::text=binding.key for share;
   if not found or judge.role<>'referee' or judge.deleted_at is not null then raise exception '裁判账号已删除或停用，请刷新后重新分配'; end if;
  end if;
 end loop;
 return new;
end;
$$;
revoke all on function public.arena_guard_referee_bindings() from public,anon,authenticated;
drop trigger if exists arena_guard_referee_bindings on public.private_events;
create trigger arena_guard_referee_bindings before insert or update of state,deleted_at on public.private_events
 for each row execute function public.arena_guard_referee_bindings();

create or replace function public.arena_referee_links(p_user uuid)
returns jsonb language sql security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',coalesce(state#>>'{event,name}',id),'deleted',deleted_at is not null,'tables',state#>array['schedule','bindings',p_user::text]) order by id),'[]'::jsonb)
 from public.private_events
 where jsonb_typeof(state#>array['schedule','bindings',p_user::text])='array'
   and jsonb_array_length(state#>array['schedule','bindings',p_user::text])>0;
$$;
revoke all on function public.arena_referee_links(uuid) from public,anon,authenticated;
grant execute on function public.arena_referee_links(uuid) to service_role;

create or replace function public.arena_manage_referee(p_actor uuid,p_target uuid,p_action text,p_email text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor_role text; target public.profiles; links jsonb;
begin
 select role into actor_role from public.profiles where id=p_actor and deleted_at is null;
 if actor_role is distinct from 'superadmin' then raise exception '仅超级管理员可以删除或恢复裁判'; end if;
 if p_actor=p_target then raise exception '不能删除自己的账号'; end if;
 if p_action not in ('delete','restore') then raise exception '无效裁判管理操作'; end if;
 -- Lock events first, following the same event -> profile order as event commits.
 perform id from public.private_events order by id for update;
 select * into target from public.profiles where id=p_target for update;
 if not found then raise exception '裁判账号不存在'; end if;
 if lower(trim(p_email)) is distinct from lower(target.email) then raise exception '确认邮箱与裁判账号不一致'; end if;
 if p_action='delete' then
  if target.deleted_at is not null or target.role<>'referee' then raise exception '只能删除尚未删除的裁判账号'; end if;
  links=public.arena_referee_links(p_target);
  if jsonb_array_length(links)>0 then return jsonb_build_object('ok',false,'error','此裁判仍绑定比赛，请先解除全部比赛绑定后再删除','bindings',links); end if;
  update public.profiles set role='blocked',deleted_at=now(),deleted_by=p_actor where id=p_target;
  -- Revoke event grants. Existing sessions are rejected by the profile gate.
  delete from public.arena_event_grants where user_id=p_target;
 else
  if target.deleted_at is null or target.role<>'blocked' then raise exception '该账号不是已删除裁判'; end if;
  update public.profiles set role='referee',deleted_at=null,deleted_by=null where id=p_target;
 end if;
 return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.arena_manage_referee(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.arena_manage_referee(uuid,uuid,text,text) to service_role;

create or replace function public.arena_member_directory(p_actor uuid,p_query text default '',p_group text default 'referee',p_page integer default 1,p_size integer default 20)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor_role text; total_count integer; records jsonb; counts jsonb;
begin
 select role into actor_role from profiles where id=p_actor and deleted_at is null;
 if actor_role is null or actor_role not in ('admin','superadmin') then raise exception '仅管理员可查看账号目录'; end if;
 if p_page<1 or p_page>100000 or p_size not in (10,20,50) or length(p_query)>100 then raise exception '无效账号分页参数'; end if;
 if p_group not in ('referee','blocked','privileged','pending','deleted') then raise exception '无效账号筛选'; end if;
 if p_group in ('privileged','pending','deleted') and actor_role<>'superadmin' then raise exception '仅超级管理员可查看此账号分组'; end if;
 select jsonb_build_object('referee',count(*) filter(where role='referee' and deleted_at is null),'blocked',count(*) filter(where role='blocked' and deleted_at is null),'privileged',case when actor_role='superadmin' then count(*) filter(where role in ('admin','superadmin') and deleted_at is null) else 0 end,'pending',case when actor_role='superadmin' then count(*) filter(where role='pending' and deleted_at is null) else 0 end,'deleted',case when actor_role='superadmin' then count(*) filter(where deleted_at is not null) else 0 end) into counts from profiles;
 with filtered as (
  select id,email,display_name,role,created_at,deleted_at from profiles
  where (case when p_group='deleted' then deleted_at is not null else deleted_at is null and (case when p_group='privileged' then role in ('admin','superadmin') else role=p_group end) end)
   and (strpos(lower(display_name),lower(trim(p_query)))>0 or strpos(lower(email),lower(trim(p_query)))>0)
 ), paged as (select * from filtered order by created_at desc,id limit p_size offset (p_page-1)*p_size)
 select (select count(*) from filtered),coalesce(jsonb_agg(to_jsonb(paged)),'[]'::jsonb) into total_count,records from paged;
 return jsonb_build_object('profiles',records,'total',total_count,'counts',counts,'page',p_page,'pageSize',p_size);
end;
$$;
revoke all on function public.arena_member_directory(uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.arena_member_directory(uuid,text,text,integer,integer) to service_role;
