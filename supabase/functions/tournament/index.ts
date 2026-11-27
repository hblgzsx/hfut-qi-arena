import { createClient } from 'npm:@supabase/supabase-js@2';
import { emptyState, validateState } from '../../../src/engine.ts';
import { applyCloudScore, redactState } from '../../../src/cloud-policy.ts';
import type { Sport } from '../../../src/engine.ts';
import { canGrantRole, isAdministrator, randomRefereePassword } from '../../../src/access-policy.ts';
import type { AccountRole } from '../../../src/access-policy.ts';
import { dispatchTables, assertSafeCorrection } from '../../../src/scheduling.ts';
import { scheduleAction, mayScoreTable, scheduleProtected, assertNoLiveReplacement } from '../../../src/schedule-actions.ts';
import {defaultEvent,eventIsActive} from '../../../src/event-settings.ts';

const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const allowed=Deno.env.get('ALLOWED_ORIGIN')||'*';
const cors={'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  try {
    if(Number(req.headers.get('content-length')||0)>8*1024*1024)return reply({error:'请求过大'},413);
    const raw=await req.text();if(raw.length>8*1024*1024)return reply({error:'请求过大'},413);
    const body=JSON.parse(raw),eventId=body.eventId;
    if(typeof eventId!=='string'||!/^[a-z0-9-]{1,64}$/.test(eventId))return reply({error:'无效赛事标识'},400);
    if(body.action==='floor-tick'){
      // Only derive dispatch from committed state and server time; accept no client state.
      const {data:row,error}=await db.from('private_events').select('state').eq('id',eventId).is('deleted_at',null).maybeSingle();
      if(error)throw error;
      if(!row)return reply({ok:true});
      const current=validateState(row.state);
      if(!eventIsActive(current.event??defaultEvent()))return reply({ok:true});
      const next=dispatchTables(current);
      if(next!==current){
        next.revision=crypto.randomUUID();
        const {error:commitError}=await db.rpc('arena_commit',{p_id:eventId,p_revision:current.revision,p_state:next,p_public:redactState(next,'public')});
        if(commitError)throw commitError;
      }
      return reply({ok:true});
    }
    if(body.action==='floor-tick'){
      // Only derive dispatch from committed state and server time; accept no client state.
      const {data:row,error}=await db.from('private_events').select('state').eq('id',eventId).is('deleted_at',null).maybeSingle();
      if(error)throw error;
      if(!row)return reply({ok:true});
      const current=validateState(row.state);
      if(!eventIsActive(current.event??defaultEvent()))return reply({ok:true});
      const next=dispatchTables(current);
      if(next!==current){
        next.revision=crypto.randomUUID();
        const {error:commitError}=await db.rpc('arena_commit',{p_id:eventId,p_revision:current.revision,p_state:next,p_public:redactState(next,'public')});
        if(commitError)throw commitError;
      }
      return reply({ok:true});
    }
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    const {data:{user},error:authError}=await db.auth.getUser(token);
    if(authError||!user)return reply({error:'请先登录'},401);
    const {data:profile,error:profileError}=await db.from('profiles').select('id,email,display_name,role').eq('id',user.id).single();
    if(profileError||!profile)return reply({error:'账号尚未建立裁判资料，请联系管理员'},403);
    const admin=isAdministrator(profile.role),referee=profile.role==='referee';
    if(body.action==='voice-claim'){
      if(!admin)return reply({error:'请在主屏登录管理员后启用叫号语音'},403);
      const {data,error}=await db.rpc('arena_call_claim',{p_event:eventId,p_owner:String(body.owner??''),p_ack:String(body.ack??'')});
      if(error)throw error;
      return reply(data);
    }
    if(body.action==='voice-claim'){
      if(!admin)return reply({error:'请在主屏登录管理员后启用叫号语音'},403);
      const {data,error}=await db.rpc('arena_call_claim',{p_event:eventId,p_owner:String(body.owner??''),p_ack:String(body.ack??'')});
      if(error)throw error;
      return reply(data);
    }
    if(body.action==='events'){
      if(!admin&&!referee)return reply({error:'请使用已授权账号'},403);
      const {data,error}=await db.from('private_events').select('id,state,deleted_at').order('updated_at',{ascending:false}).limit(1000);
      if(error)throw error;
      const now=Date.now(),items=(data??[]).map(row=>({id:row.id,name:row.state?.event?.name??'五院研究生棋类友谊赛',startsAt:row.state?.event?.startsAt??defaultEvent().startsAt,endsAt:row.state?.event?.endsAt??defaultEvent().endsAt,revision:row.state?.revision,deletedAt:row.deleted_at}));
      return reply({events:items.filter(row=>!row.deletedAt&&(admin||eventIsActive(row,now))),deletedEvents:admin?items.filter(row=>row.deletedAt):[],serverNow:now});
    }
    if(body.action==='create-event'){
      if(!admin)return reply({error:'仅管理员可以创建竞赛'},403);
      const next=validateState(body.state);
      if(!next.event||Object.values(next.tournaments).some(t=>t.players.length||t.seeds.length||Object.keys(t.results).length))return reply({error:'请以完整基本信息创建空白竞赛'},400);
      const newId='event-'+crypto.randomUUID();next.revision=crypto.randomUUID();
      next.audit=[{id:crypto.randomUUID(),time:new Date().toISOString(),sport:'gomoku',message:'已创建独立竞赛：'+next.event.name+' · '+profile.display_name}];
      const {data,error}=await db.rpc('arena_create_event',{p_id:newId,p_state:next,p_public:redactState(next,'public'),p_actor:user.id});if(error)throw error;if(!data)throw new Error('竞赛发布失败，请刷新竞赛列表后重试');
      return reply({eventId:newId,state:next});
    }
    if(body.action==='delete-event'||body.action==='restore-event'){
      if(!admin)return reply({error:'仅管理员可以删除或恢复竞赛'},403);
      const {data:row,error:readError}=await db.from('private_events').select('state,deleted_at').eq('id',eventId).maybeSingle();if(readError)throw readError;
      if(!row)return reply({error:'竞赛不存在'},404);
      const current=validateState(row.state),name=current.event?.name??'五院研究生棋类友谊赛',deleting=body.action==='delete-event';
      if(body.confirmName!==name)return reply({error:'比赛名称不一致，请重新确认'},400);
      if(body.expectedRevision!==current.revision||Boolean(row.deleted_at)===deleting)return reply({error:'竞赛已更新或状态已改变，请刷新后重新确认'},409);
      const next={...current,revision:crypto.randomUUID(),audit:[{id:crypto.randomUUID(),time:new Date().toISOString(),sport:'gomoku' as Sport,message:(deleting?'已删除竞赛（可恢复）：':'已恢复竞赛：')+name+' · '+profile.display_name},...current.audit].slice(0,200)};
      const {data,error}=await db.rpc('arena_set_event_deleted',{p_id:eventId,p_revision:current.revision,p_name:name,p_deleted:deleting,p_state:next,p_public:redactState(next,'public'),p_actor:user.id});if(error)throw error;
      if(!data)return reply({error:'竞赛已更新，请刷新后重新确认'},409);
      return reply({ok:true});
    }
    if(body.action==='create-referee'){
      if(!admin)return reply({error:'仅管理员可以创建裁判账号'},403);
      const email=String(body.email??'').trim().toLowerCase(),displayName=String(body.displayName??'').trim();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!displayName||displayName.length>40)return reply({error:'请填写有效邮箱和 1—40 字裁判姓名'},400);
      const password=randomRefereePassword();
      const {data:created,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:displayName}});
      if(error)throw error;if(!created.user)throw new Error('裁判账号创建失败');
      const {error:updateError}=await db.from('profiles').update({role:'referee'}).eq('id',created.user.id);
      if(updateError){await db.auth.admin.deleteUser(created.user.id);throw updateError;}
      return reply({credential:{email,password,displayName},notice:'密码仅此次返回，请安全提供给对应裁判。'});
    }
    if(body.action==='reset-referee'){
      if(!admin)return reply({error:'仅管理员可以重置裁判密码'},403);
      const {data:target}=await db.from('profiles').select('id,role,email,display_name').eq('id',body.userId).single();
      if(!target||!['referee','blocked'].includes(target.role))return reply({error:'此入口仅可重置裁判账号密码'},403);
      const password=randomRefereePassword();const {error}=await db.auth.admin.updateUserById(target.id,{password});if(error)throw error;
      return reply({credential:{email:target.email,password,displayName:target.display_name},notice:'旧密码已失效，新密码仅此次返回。'});
    }
    if(body.action==='audit'){
      if(!admin)return reply({error:'仅管理员可查看完整修改档案'},403);
      let query=db.from('event_audit').select('sequence,sport,message,happened_at,actor_id').eq('event_id',eventId).order('sequence',{ascending:false}).limit(50);
      if(body.before!==undefined){const before=Number(body.before);if(!Number.isSafeInteger(before)||before<1)return reply({error:'无效分页游标'},400);query=query.lt('sequence',before);}
      const {data,error}=await query;if(error)throw error;return reply({entries:data});
    }
    if(body.action==='members'){
      if(!admin)return reply({error:'仅管理员可以审核裁判'},403);
      const {data,error}=await db.from('profiles').select('id,email,display_name,role').order('created_at');if(error)throw error;return reply({profiles:data});
    }
    if(body.action==='approve'){
      const {data:target}=await db.from('profiles').select('id,role').eq('id',body.userId).single();
      if(!target||!canGrantRole({id:user.id,role:profile.role as AccountRole},target,body.role))return reply({error:'权限不足：仅超级管理员可授权管理员或超级管理员，不能修改自身权限。'},403);
      const {data,error}=await db.from('profiles').update({role:body.role}).eq('id',target.id).select('id');if(error)throw error;if(!data?.length)return reply({error:'账号不存在'},400);return reply({ok:true});
    }
    const load=async()=>{const {data,error}=await db.from('private_events').select('state').eq('id',eventId).is('deleted_at',null).maybeSingle();if(error)throw error;return data?.state?validateState(data.state):null;};
    let state=await load();
    if(state&&referee&&!eventIsActive(state.event??defaultEvent())){
      if(body.action==='read')return reply({state:emptyState(),profile,unavailable:true});
      return reply({error:'当前不在比赛举行时间内，裁判只能为进行中的竞赛录分。'},403);
    }
    if(!state&&admin){
      const {data:existing,error:existingError}=await db.from('private_events').select('id,deleted_at').eq('id',eventId).maybeSingle();if(existingError)throw existingError;
      if(existing?.deleted_at||eventId!=='hfut-2026'){
        if(body.action==='read')return reply({state:emptyState(),profile,unavailable:true});
        return reply({error:'此竞赛已删除或不存在，请切换竞赛或从已删除竞赛中恢复。'},404);
      }
      const init=emptyState();const {error}=await db.from('private_events').insert({id:eventId,state:init});
      if(error&&error.code!=='23505')throw error;
      state=await load();
      if(state){const {error:publishError}=await db.rpc('arena_commit',{p_id:eventId,p_revision:state.revision,p_state:state,p_public:redactState(state,'public')});if(publishError)throw publishError;}
    }
    if (!state) {
      if (body.action==='read') return reply({state:emptyState(),profile,unavailable:true});
      return reply({error:'请先初始化竞赛'},400);
    }
    const access = async (action:string,password='',secret='') => {
      const {data,error} = await db.rpc('arena_access',{p_event:eventId,p_user:user.id,p_action:action,p_password:password,p_secret:secret});
      if(error) throw error;
      if(data.error) throw new Error(data.error);
      return data;
    };
    if (body.action==='event-password') {
      if(!admin) return reply({error:'仅管理员可以设置赛事密码'},403);
      await access('set',String(body.password??''),String(body.newPassword??''));
      return reply({ok:true});
    }
    if (body.action==='unlock-event') return reply(await access('unlock',String(body.password??'')));
    const gate = await access('status','',String(body.eventGrant??''));
    if(referee && !gate.allowed) {
      if(body.action==='read') return reply({state:emptyState(),profile,locked:true,passwordConfigured:gate.configured});
      return reply({error:'请先输入当前赛事密码'},403);
    }
    // Active consoles/referees poll this path; the server wakes rested players.
    if (body.action==='read' && (admin||referee)) {
      const next=dispatchTables(state);
      if(next!==state) {
        next.revision=crypto.randomUUID();
        const {data,error}=await db.rpc('arena_commit',{p_id:eventId,p_revision:state.revision,p_state:next,p_public:redactState(next,'public'),p_actor:user.id});
        if(error) throw error;
        state=data?next:await load();
      }
    }
    if (body.action==='schedule') {
      if(!admin && body.command?.type!=='begin') return reply({error:'仅管理员可修改调度'},403);
      if(body.command?.type!=='begin') {
        await access('check',String(body.password??''));
        if(String(body.reason??'').trim().length<2) throw new Error('请填写操作原因');
      }
      if(body.expectedRevision!==state.revision) return reply({error:'现场已更新，请刷新后重试'},409);
      if(referee) {
        const a=state.schedule?.assignments.find(a=>a.id===body.command?.assignment);
        if(!a || !mayScoreTable(state,user.id,a.sport,a.match)) return reply({error:'只能操作绑定棋盘'},403);
      }
      if(body.command?.type==='configure') {
        const {data:members,error}=await db.from('profiles').select('id').eq('role','referee');
        if(error) throw error;
        const allowed=new Set((members??[]).map(p=>p.id));
        if(Object.keys(body.command.bindings??{}).some(id=>!allowed.has(id))) throw new Error('只能绑定现有裁判账号');
      }
      const next=validateState(scheduleAction(state,body.command));
      next.revision=crypto.randomUUID();
      next.audit=[{id:crypto.randomUUID(),time:new Date().toISOString(),sport:body.command?.sport==='junqi'?'junqi':'gomoku',message:'现场调度 '+body.command?.type+' · '+profile.display_name+' · '+String(body.reason??'确认开赛').slice(0,200)},...state.audit].slice(0,200);
      const {data,error}=await db.rpc('arena_commit',{p_id:eventId,p_revision:state.revision,p_state:next,p_public:redactState(next,'public'),p_actor:user.id});
      if(error) throw error;
      if(!data) return reply({error:'调度提交冲突，请刷新后重试'},409);
      return reply({state:redactState(next,admin?'admin':'referee')});
    }
    if(body.action==='read')return reply({state:state?redactState(state,admin?'admin':referee?'referee':'public'):emptyState(),profile,unavailable:!state});
    if(!state)return reply({error:'请先由管理员初始化赛事'},400);
    if(body.action==='replace'){
      if(!admin)return reply({error:'仅管理员可以修改名单、抽签、奖品与赛事设置'},403);
      if(state.revision!==body.expectedRevision)return reply({error:'赛事已更新，请刷新后重试，避免覆盖其他裁判成绩'},409);
      const next=validateState(body.state);
      if(scheduleProtected(state,next)) {
        await access('check',String(body.password??''));
        if(String(body.reason??'').trim().length<2) throw new Error('修改抽签或顺序必须填写原因');
        // Schedule mutations use the dedicated validated command endpoint.
        if(JSON.stringify(next.schedule)!==JSON.stringify(state.schedule)) throw new Error('请在现场调度中修改棋盘与顺序');
      }
      assertNoLiveReplacement(state,next);
      next.revision=crypto.randomUUID();
      next.audit=[{id:crypto.randomUUID(),time:new Date().toISOString(),sport:(['gomoku','junqi'].includes(body.sport)?body.sport:'gomoku') as Sport,message:`${String(body.message||'赛事更新').slice(0,180)} · ${profile.display_name}`},...state.audit].slice(0,200);
      const {data,error}=await db.rpc('arena_commit',{p_id:eventId,p_revision:state.revision,p_state:next,p_public:redactState(next,'public'),p_actor:user.id});if(error)throw error;if(!data)return reply({error:'提交期间赛事已更新，请刷新后重试'},409);return reply({state:next});
    }
    if(body.action==='score'){
      if(!admin&&!referee)return reply({error:'账号尚未通过管理员审核，不能录分'},403);
      for(let attempt=0;attempt<4;attempt++){
        if(attempt)state=await load();if(!state)throw new Error('赛事不存在');
        if(referee&&!eventIsActive(state.event??defaultEvent()))return reply({error:'比赛已结束，裁判不能继续录分，请联系管理员。'},403);
        if(referee && !mayScoreTable(state,user.id,body.sport,body.id)) return reply({error:'此对局不在你的绑定棋盘上'},403);
        assertSafeCorrection(state,body.sport,body.id);
        const next=dispatchTables(applyCloudScore(state,body,profile.role==='superadmin'?'superadmin':admin?'admin':'referee',profile.display_name));
        const {data,error}=await db.rpc('arena_commit',{p_id:eventId,p_revision:state.revision,p_state:next,p_public:redactState(next,'public'),p_actor:user.id});if(error)throw error;
        if(data)return reply({state:redactState(next,admin?'admin':'referee')});
      }
      return reply({error:'当前提交较多，请稍后重试'},409);
    }
    return reply({error:'不支持的操作'},400);
  }catch(e){return reply({error:e instanceof Error?e.message:'服务处理失败'},400);}
});
