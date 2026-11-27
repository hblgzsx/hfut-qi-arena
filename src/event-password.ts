export function validateNewEventPassword(value:unknown,confirmation?:string):string {
 if(typeof value!=='string'||!value.trim()||Array.from(value).length<8||new TextEncoder().encode(value).length>72)throw new Error('赛事密码须至少 8 个字符，且不超过 72 字节。');
 if(confirmation!==undefined&&value!==confirmation)throw new Error('两次输入的赛事密码不一致。');
 return value;
}
