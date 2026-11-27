export interface RefereeExportRow {name:string;email:string;password?:string;status?:string;note?:string}
export type CredentialField='name'|'email'|'password'|'status'|'note';
export const CREDENTIAL_FIELDS:Record<CredentialField,string>={name:'姓名',email:'邮箱',password:'密码',status:'状态',note:'说明'};
export function refereeExportData(rows:RefereeExportRow[],emails:string[],fields:CredentialField[]){
 if(!fields.length||fields.some(f=>!Object.hasOwn(CREDENTIAL_FIELDS,f))||new Set(fields).size!==fields.length)throw new Error('请至少选择一个有效的导出字段。');
 const selected=rows.filter(r=>emails.includes(r.email));if(!selected.length)throw new Error('请至少选择一名裁判。');
 return selected.map(r=>Object.fromEntries(fields.map(f=>[CREDENTIAL_FIELDS[f],f==='password'?(r.password||'不可读取（仅本次创建或重置后可导出）'):r[f]??''])));
}
