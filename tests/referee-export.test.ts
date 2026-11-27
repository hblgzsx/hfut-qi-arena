import test from 'node:test';
import assert from 'node:assert/strict';
import {refereeExportData} from '../src/referee-export-data.ts';
const rows=[{name:'甲裁判',email:'a@example.test',password:'TEST-ONLY-PASSWORD',status:'创建成功'},{name:'乙裁判',email:'b@example.test'}];
test('裁判信息仅按所选人员和字段导出，未勾密码时无密码',()=>{const result=refereeExportData(rows,['a@example.test'],['name','email']);assert.deepEqual(result,[{姓名:'甲裁判',邮箱:'a@example.test'}]);assert.ok(!JSON.stringify(result).includes('TEST-ONLY-PASSWORD'));assert.deepEqual(refereeExportData(rows,['a@example.test'],['password']),[{密码:'TEST-ONLY-PASSWORD'}]);});
test('不能读取的旧密码明确标记，不伪造密码，空选择被拒绝',()=>{const result=refereeExportData(rows,['b@example.test'],['name','password']);assert.match(result[0].密码,/不可读取/);assert.throws(()=>refereeExportData(rows,[],['name']),/至少选择一名/);assert.throws(()=>refereeExportData(rows,['a@example.test'],[]),/至少选择一个/);assert.throws(()=>refereeExportData(rows,['a@example.test'],['invalid' as never]),/有效/);});
