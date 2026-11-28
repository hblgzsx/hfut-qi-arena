import {supabase} from './cloud';
export async function signOutCurrentDevice(){
 if(!supabase)throw new Error('当前未连接云端账号');
 const {error}=await supabase.auth.signOut({scope:'local'});
 if(error){const {data:{session}}=await supabase.auth.getSession();if(session)throw error;}
 // Event grants belong to the signed-out user; never leave them for the next login.
 try{for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key?.startsWith('qi-event-grant:'))sessionStorage.removeItem(key);}}catch{}
 return error?'已退出本机；网络异常，云端会话撤销尚未确认。':'已退出当前设备的登录';
}
