export type AccountRole='pending'|'referee'|'admin'|'superadmin'|'blocked';
export function isAdministrator(role:AccountRole|undefined){return role==='admin'||role==='superadmin';}
export function canGrantRole(actor:{id:string;role:AccountRole},target:{id:string;role:AccountRole},role:AccountRole):boolean {
  if(actor.id===target.id)return false;
  if(actor.role==='superadmin')return ['referee','admin','superadmin','blocked'].includes(role);
  return actor.role==='admin'&&['pending','referee','blocked'].includes(target.role)&&['referee','blocked'].includes(role);
}
export function randomRefereePassword():string {
  // 192 random bits, no Math.random, generated on the server and returned only once.
  const bytes=crypto.getRandomValues(new Uint8Array(24));
  return 'Q!'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')+'a9';
}
