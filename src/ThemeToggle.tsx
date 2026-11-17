import {useState} from 'react';
import {Sun,Moon} from 'lucide-react';
type Theme='dark'|'light';
function savedTheme():Theme{try{return localStorage.getItem('qi-arena-theme')==='light'?'light':'dark';}catch{return 'dark';}}
document.documentElement.dataset.theme=savedTheme();
export function ThemeToggle(){const [theme,setTheme]=useState<Theme>(savedTheme);return <button className="theme-toggle" aria-label={theme==='dark'?'切换为白色主题':'切换为黑色主题'} title="黑白主题切换 · 本机记忆" onClick={()=>{const next=theme==='dark'?'light':'dark';setTheme(next);document.documentElement.dataset.theme=next;try{localStorage.setItem('qi-arena-theme',next);}catch{}}}>{theme==='dark'?<Sun size={16}/>:<Moon size={16}/>}<span>{theme==='dark'?'白色模式':'黑色模式'}</span></button>;}
