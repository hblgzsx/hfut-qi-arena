-- Resolve pre-existing duplicate active names without touching rosters/results.
begin;
do $$
declare row_record record; next_state jsonb; settings jsonb; candidate text; suffix integer; entry jsonb; old_revision text;
begin
 for row_record in
  select id,state from (
   select id,state,row_number() over(partition by public.arena_event_name_key(state->'event'->>'name') order by (id='hfut-2026') desc,updated_at,id) as ordinal
   from public.private_events where deleted_at is null
  ) ranked where ordinal>1
 loop
  old_revision=row_record.state->>'revision';
  settings=coalesce(row_record.state->'event','{"name":"五院研究生棋类友谊赛","colleges":["经济学院","计算机与信息学院","建筑与艺术学院","外国语学院","微电子学院"],"startsAt":"2026-11-29T14:00","endsAt":"2026-11-29T18:00","venue":"科教楼 B 座 501 报告厅"}'::jsonb);
  candidate=left(settings->>'name',44)||'（历史-'||right(row_record.id,8)||'）';suffix=1;
  while exists(select 1 from public.private_events e where e.id<>row_record.id and e.deleted_at is null and public.arena_event_name_key(e.state->'event'->>'name')=public.arena_event_name_key(candidate)) loop
   candidate=left(settings->>'name',40)||'（历史-'||right(row_record.id,8)||'-'||suffix||'）';suffix=suffix+1;
  end loop;
  entry=jsonb_build_object('id',gen_random_uuid(),'sport','gomoku','time',now(),'message','系统整理历史重名竞赛：'||(settings->>'name')||' → '||candidate||'；名单、赛程和成绩保持原状');
  next_state=jsonb_set(row_record.state,'{event}',jsonb_set(settings,'{name}',to_jsonb(candidate)));
  next_state=jsonb_set(next_state,'{revision}',to_jsonb(gen_random_uuid()::text));
  next_state=jsonb_set(next_state,'{audit}',(select jsonb_agg(item order by ordinal) from jsonb_array_elements(jsonb_build_array(entry)||coalesce(row_record.state->'audit','[]'::jsonb)) with ordinality as entries(item,ordinal) where ordinal<=200));
  -- Reuse the existing redacted public snapshot; change metadata only.
  if not public.arena_commit(row_record.id,old_revision,next_state,
   jsonb_set(jsonb_set((select state from public.public_events where id=row_record.id),'{event}',next_state->'event'),'{revision}',next_state->'revision'),null)
  then raise exception 'Competition changed during name migration; retry'; end if;
 end loop;
end; $$;
commit;
