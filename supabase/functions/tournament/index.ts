import { createClient } from 'npm:@supabase/supabase-js@2';
import { emptyState, validateState } from '../../../src/engine.ts';
import { applyCloudScore, redactState } from '../../../src/cloud-policy.ts';
import type { Sport } from '../../../src/engine.ts';
import { canGrantRole, isAdministrator, randomRefereePassword } from '../../../src/access-policy.ts';
import type { AccountRole } from '../../../src/access-policy.ts';

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
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    const {data:{user},error:authError}=await db.auth.getUser(token);
    if(authError||!user)return reply({error:'请先登录'},401);
    const {data:profile,error:profileError}=await db.from('profiles').select('id,email,display_name,role').eq('id',user.id).single();
    if(profileError||!profile)return reply({error:'账号尚未建立裁判资料，请联系管理员'},403);
    const admin=isAdministrator(profile.role),referee=profile.role==='referee';
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
    const load=async()=>{const {data,error}=await db.from('private_events').select('state').eq('id',eventId).maybeSingle();if(error)throw error;return data?.state?validateState(data.state):null;};
    let state=await load();
    if(!state&&admin){
      const init=emptyState();const {error}=await db.from('private_events').insert({id:eventId,state:init});
      if(error&&error.code!=='23505')throw error;
      state=await load();
      if(state){const {error:publishError}=await db.rpc('arena_commit',{p_id:eventId,p_revision:state.revision,p_state:state,p_public:redactState(state,'public')});if(publishError)throw publishError;}
    }
    if(body.action==='read')return reply({state:state?redactState(state,admin?'admin':referee?'referee':'public'):emptyState(),profile});
    if(!state)return reply({error:'请先由管理员初始化赛事'},400);
    if(body.action==='replace'){
      if(!admin)return reply({error:'仅管理员可以修改名单、抽签、奖品与赛事设置'},403);
      if(state.revision!==body.expectedRevision)return reply({error:'赛事已更新，请刷新后重试，避免覆盖其他裁判成绩'},409);
      const next=validateState(body.state);next.revision=crypto.randomUUID();
      next.audit=[{id:crypto.randomUUID(),time:new Date().toISOString(),sport:(['gomoku','junqi'].includes(body.sport)?body.sport:'gomoku') as Sport,message:`${String(body.message||'赛事更新').slice(0,180)} · ${profile.display_name}`},...state.audit].slice(0,200);
      const {data,error}=await db.rpc('arena_commit',{p_id:eventId,p_revision:state.revision,p_state:next,p_public:redactState(next,'public'),p_actor:user.id});if(error)throw error;if(!data)return reply({error:'提交期间赛事已更新，请刷新后重试'},409);return reply({state:next});
    }
    if(body.action==='score'){
      if(!admin&&!referee)return reply({error:'账号尚未通过管理员审核，不能录分'},403);
      for(let attempt=0;attempt<4;attempt++){
        if(attempt)state=await load();if(!state)throw new Error('赛事不存在');
        const next=applyCloudScore(state,body,admin?'admin':'referee',profile.display_name);
        const {data,error}=await db.rpc('arena_commit',{p_id:eventId,p_revision:state.revision,p_state:next,p_public:redactState(next,'public'),p_actor:user.id});if(error)throw error;
        if(data)return reply({state:redactState(next,admin?'admin':'referee')});
      }
      return reply({error:'当前提交较多，请稍后重试'},409);
    }
    return reply({error:'不支持的操作'},400);
  }catch(e){return reply({error:e instanceof Error?e.message:'服务处理失败'},400);}
});
