-- Publish a new event and its password atomically. Never store the password in event JSON.
create or replace function public.arena_create_event_with_password(p_id text,p_state jsonb,p_public jsonb,p_actor uuid,p_password text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare access_result jsonb;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role in ('admin','superadmin')) then raise exception '仅管理员可以创建竞赛'; end if;
 if p_password is null or length(trim(p_password))=0 or length(p_password)<8 or octet_length(p_password)>72 then raise exception '赛事密码须至少 8 字符且不超过 72 字节'; end if;
 if not public.arena_create_event(p_id,p_state,p_public,p_actor) then raise exception '竞赛创建失败'; end if;
 access_result=public.arena_access(p_id,p_actor,'set','',p_password);
 if access_result ? 'error' or not coalesce((access_result->>'ok')::boolean,false) then raise exception '赛事密码初始化失败，创建已取消'; end if;
 return true;
end;
$$;
revoke all on function public.arena_create_event_with_password(text,jsonb,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.arena_create_event_with_password(text,jsonb,jsonb,uuid,text) to service_role;
