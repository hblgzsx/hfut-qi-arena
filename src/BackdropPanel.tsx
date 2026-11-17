import {useEffect,useRef,useState} from 'react';
import {eventId} from './cloud';
type Viewer=import('pptx-preview/dist/previewer/PPTXPreviewer').PPTXPreviewer;
async function storedDeck(file?:File):Promise<File|undefined>{
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('qi-arena-presentations',1);r.onupgradeneeded=()=>r.result.createObjectStore('decks');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction('decks',file?'readwrite':'readonly'),store=tx.objectStore('decks'),request=file?store.put(file,eventId):store.get(eventId);let value:File|undefined;request.onsuccess=()=>{value=file??request.result;};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
export function BackdropPanel({canUpload,onClose}:{canUpload:boolean;onClose:()=>void}){
 const host=useRef<HTMLDivElement>(null),viewer=useRef<Viewer|null>(null),fileRef=useRef<File|null>(null),generation=useRef(0);
 const [name,setName]=useState(''),[busy,setBusy]=useState(true),[error,setError]=useState(''),[count,setCount]=useState(0),[index,setIndex]=useState(0),[fullscreen,setFullscreen]=useState(false);
 async function render(file:File,persist=false,targetIndex=0){const request=++generation.current;setBusy(true);setError('');
  try{if(!/\.pptx$/i.test(file.name))throw new Error('请选择 .pptx 文件；旧版 .ppt 请先另存为 .pptx。');if(file.size>25*1024*1024)throw new Error('PPTX 超过 25 MB，请先压缩图片。');
   const data=await file.arrayBuffer(),{init}=await import('pptx-preview');if(request!==generation.current||!host.current)return;
   viewer.current?.destroy();host.current.replaceChildren();const width=Math.max(240,host.current.getBoundingClientRect().width),height=Math.max(180,host.current.clientHeight);const v=init(host.current,{width,height,mode:'slide'});viewer.current=v;
   await v.preview(data);if(request!==generation.current)return;if(v.slideCount>100){v.destroy();throw new Error('最多支持 100 页，请拆分演示文稿。');}
   fileRef.current=file;setName(file.name);setCount(v.slideCount);const page=Math.max(0,Math.min(v.slideCount-1,targetIndex));if(page)v.renderSingleSlide(page);setIndex(page);if(persist)try{await storedDeck(file);}catch{setError('已加载，可正常展示；本机空间不足，未能保存，刷新后需重新上传。');}
  }catch(e){if(request===generation.current){setError((e as Error).message||'PPTX 读取失败，请另存后重试。');setCount(0);}}finally{if(request===generation.current)setBusy(false);}
 }
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  void (async()=>{try{
   let file=await storedDeck().catch(()=>undefined);if(!active)return;
   if(!file){const response=await fetch(`${import.meta.env.BASE_URL}backgrounds/awards.pptx`,{signal:controller.signal});if(!response.ok)throw new Error('颁奖模板加载失败，请重试或上传 PPTX 文件。');file=new File([await response.blob()],'内置颁奖模板.pptx',{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});}
   if(active)await render(file);
  }catch(e){if(active){setError((e as Error).message||'颁奖模板加载失败，请重试或上传 PPTX 文件。');setBusy(false);}}})();
  const resize=()=>{if(fileRef.current)void render(fileRef.current,false,viewer.current?.currentIndex??0);};let timer:ReturnType<typeof setTimeout>;const onResize=()=>{clearTimeout(timer);timer=setTimeout(resize,200);};window.addEventListener('resize',onResize);const change=()=>setFullscreen(!!document.fullscreenElement);document.addEventListener('fullscreenchange',change);return()=>{active=false;controller.abort();generation.current++;clearTimeout(timer);viewer.current?.destroy();window.removeEventListener('resize',onResize);document.removeEventListener('fullscreenchange',change);};
 },[]);
 function go(next:number){const n=Math.max(0,Math.min(count-1,next));viewer.current?.renderSingleSlide(n);setIndex(n);}
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.target as HTMLElement).matches('input,select,textarea'))return;if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();go(index+1);}if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(index-1);}if(e.key==='Escape'&&!document.fullscreenElement)onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[index,count,onClose]);
 return <div className={'backdrop-workspace'+(fullscreen?' is-fullscreen':'')}><header><div><b>颁奖背景 · PPTX 展示</b><small>{name||'上传背景演示文稿，选择页面后全屏展示'}</small></div><div className="backdrop-actions">{canUpload&&<label className="button secondary small">上传 PPTX<input aria-label="上传背景 PPTX" type="file" hidden accept=".pptx" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void render(file,true);}}/></label>}<a className="button secondary small" href={`${import.meta.env.BASE_URL}backgrounds/awards.pptx`} download="背景-含军棋五子棋颁奖页.pptx">下载颁奖模板</a><button className="button secondary small" onClick={async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{setError('浏览器未允许全屏，请使用浏览器全屏功能。');}}}>{fullscreen?'退出全屏':'全屏展示'}</button><button className="button secondary small" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();onClose();}}>退出展示</button></div></header>
 <main ref={host} className="pptx-host" aria-label="PPTX 背景预览"/>{busy&&<p className="backdrop-message" role="status">正在加载演示文稿…</p>}{error&&<p className="backdrop-error" role="alert">{error}</p>}
 <footer><button className="button secondary small" disabled={!count||index===0||busy} onClick={()=>go(index-1)}>上一页</button><select aria-label="背景页码" disabled={!count||busy} value={index} onChange={e=>go(Number(e.target.value))}>{count?Array.from({length:count},(_,i)=><option key={i} value={i}>第 {i+1} / {count} 页</option>):<option>等待上传</option>}</select><button className="button secondary small" disabled={!count||index>=count-1||busy} onClick={()=>go(index+1)}>下一页</button><span>← → 翻页 · 本机保存，按竞赛区分；其他设备需单独上传。PPTX 动画与特殊字体可能与 PowerPoint 不同。</span></footer></div>;
}
