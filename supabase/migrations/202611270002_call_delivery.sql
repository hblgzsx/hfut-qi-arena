create table if not exists public.arena_call_delivery (
 event_id text primary key references public.private_events(id) on delete cascade,
 owner text,
 lease_until timestamptz,
 delivered text[] not null default '{}'
);
alter table public.arena_call_delivery enable row level security;
revoke all on public.arena_call_delivery from public,anon,authenticated;
grant all on public.arena_call_delivery to service_role;
create or replace function public.arena_call_claim(p_event text,p_owner text,p_ack text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare row public.arena_call_delivery;
begin
 if length(p_owner)<20 or length(p_owner)>80 then raise exception '无效播报设备'; end if;
 insert into arena_call_delivery(event_id) values(p_event) on conflict do nothing;
 select * into row from arena_call_delivery where event_id=p_event for update;
 if row.owner is distinct from p_owner and row.lease_until>now() then
   return jsonb_build_object('owned',false);
 end if;
 update arena_call_delivery set owner=p_owner,lease_until=now()+interval '120 seconds',
 delivered=case when p_ack<>'' and not p_ack=any(delivered) then array_append(delivered,p_ack) else delivered end
 where event_id=p_event returning * into row;
 return jsonb_build_object('owned',true,'delivered',row.delivered);
end;
$$;
revoke all on function public.arena_call_claim(text,text,text) from public,anon,authenticated;
grant execute on function public.arena_call_claim(text,text,text) to service_role;
