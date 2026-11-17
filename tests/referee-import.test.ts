import test from 'node:test';import assert from 'node:assert/strict';import {parseRefereeRows} from '../src/referee-import.ts';
test('裁判名单仅读取姓名邮箱，修整空白，重复邮箱与无效行先阻止创建',()=>{
 assert.deepEqual(parseRefereeRows([['标题'],['姓名','邮箱','QQ'],[' 张三 ','REF@EXAMPLE.COM','123']]),[{name:'张三',email:'ref@example.com',row:3}]);
 assert.throws(()=>parseRefereeRows([['姓名','邮箱'],['张三','a@b.com'],['李四','A@b.com']]),/重复/);
 assert.throws(()=>parseRefereeRows([['姓名','邮箱'],['张三','abc']]),/无效/);
 assert.throws(()=>parseRefereeRows([['姓名','邮箱'],['','a@b.com']]),/姓名/);
 assert.throws(()=>parseRefereeRows([['姓名','邮箱']]),/没有有效/);
 assert.throws(()=>parseRefereeRows([['姓名','邮箱'],...Array.from({length:101},(_,i)=>['裁判'+i,`ref${i}@example.com`])]),/100/);
});
