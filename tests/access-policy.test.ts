import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canGrantRole,isAdministrator,randomRefereePassword,canDeleteReferee} from '../src/access-policy.ts';
test('只有超级管理员可以授予超级管理员或管理员权限，不能自行提权或修改自身权限',()=>{
  const root={id:'root',role:'superadmin' as const},admin={id:'admin',role:'admin' as const},ref={id:'ref',role:'referee' as const},pending={id:'p',role:'pending' as const};
  assert.ok(canGrantRole(root,pending,'superadmin'));assert.ok(canGrantRole(root,pending,'admin'));assert.ok(canGrantRole(root,admin,'superadmin'));
  assert.equal(canGrantRole(admin,pending,'superadmin'),false);assert.equal(canGrantRole(ref,pending,'admin'),false);assert.equal(canGrantRole(root,root,'blocked'),false);assert.equal(canGrantRole(admin,root,'blocked'),false);
  assert.ok(canGrantRole(admin,ref,'blocked'));assert.ok(isAdministrator(root.role));assert.equal(isAdministrator('pending'),false);
});
test('裁判密码使用加密随机源，包含复杂度且不同账号不共用密码',()=>{
  const passwords=Array.from({length:100},()=>randomRefereePassword());assert.equal(new Set(passwords).size,100);assert.ok(passwords.every(p=>p.length>=24&&/[A-Z]/.test(p)&&/[a-z]/.test(p)&&/\d/.test(p)&&/!/.test(p)));
});

test('仅超级管理员可删除其他未删除的裁判，不能删除管理员或自己',()=>{
 const root={id:'root',role:'superadmin' as const},judge={id:'judge',role:'referee' as const};
 assert.equal(canDeleteReferee(root,judge),true);
 for(const role of ['admin','referee','pending','blocked'] as const)assert.equal(canDeleteReferee({id:'other',role},judge),false);
 for(const role of ['admin','superadmin','pending','blocked'] as const)assert.equal(canDeleteReferee(root,{id:'other',role}),false);
 assert.equal(canDeleteReferee(root,{...judge,deleted_at:new Date().toISOString()}),false);
 assert.equal(canDeleteReferee(root,{...judge,id:'root'}),false);
});
