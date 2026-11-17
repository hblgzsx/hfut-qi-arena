export interface RefereeRow {name:string;email:string;row:number}
export function parseRefereeRows(rows:unknown[][]):RefereeRow[]{
 const norm=(v:unknown)=>String(v??'').trim().replace(/\s/g,'').toLowerCase();
 const names=['姓名','裁判姓名','name'],emails=['邮箱','电子邮箱','邮箱地址','email'];
 const header=rows.findIndex(row=>row.some(c=>names.includes(norm(c)))&&row.some(c=>emails.includes(norm(c))));
 if(header<0)throw new Error('第一个工作表需要“姓名”和“邮箱”表头。');
 const nameCol=rows[header].findIndex(c=>names.includes(norm(c))),emailCol=rows[header].findIndex(c=>emails.includes(norm(c))),result:RefereeRow[]=[],seen=new Set<string>();
 for(let i=header+1;i<rows.length;i++){
  const row=rows[i];if(row.every(c=>!String(c??'').trim()))continue;
  const name=String(row[nameCol]??'').trim(),email=String(row[emailCol]??'').trim().toLowerCase();
  if(!name||name.length>40)throw new Error(`第 ${i+1} 行：姓名需为 1—40 字。`);
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error(`第 ${i+1} 行：邮箱格式无效。`);
  if(seen.has(email))throw new Error(`第 ${i+1} 行：邮箱 ${email} 重复。`);
  seen.add(email);result.push({name,email,row:i+1});
  if(result.length>100)throw new Error('每批最多创建 100 名裁判，请拆分文件。');
 }
 if(!result.length)throw new Error('报名表没有有效裁判数据。');
 return result;
}
