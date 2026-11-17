import {useState} from 'react';
export function EventDeleteForm({name,saving,onDelete}:{name:string;saving:boolean;onDelete:()=>Promise<void>}){
 const [confirmation,setConfirmation]=useState(''),[error,setError]=useState('');
 return <form className="event-form" onSubmit={async e=>{e.preventDefault();if(confirmation!==name)return;setError('');try{await onDelete();}catch(err){setError((err as Error).message);}}}>
 <p>删除“{name}”后，它将从竞赛列表和公开大屏移除，裁判无法继续录分。名单、赛果、奖品与记录会保留在已删除竞赛中，可恢复。</p>
 <label>输入完整比赛名称确认<input autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
 {error&&<p role="alert">{error}</p>}<div className="modal-actions"><button type="submit" className="button primary" disabled={saving||confirmation!==name}>{saving?'正在删除…':'确认删除此竞赛'}</button></div>
 </form>;
}
