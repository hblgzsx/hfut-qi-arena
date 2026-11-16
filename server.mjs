// Offline production server. Only the built dist folder is exposed, on loopback.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
if(!fs.existsSync(path.join(root,'index.html'))){console.error('请先运行 npm install 和 npm run build。');process.exit(1);}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  let urlPath;try{urlPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  if(urlPath.includes('\0')||urlPath.includes('\\')){res.writeHead(400);res.end();return;}
  const requested=path.resolve(root,'.'+urlPath);
  if(requested!==root&&!requested.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  let file=requested;
  try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');}catch{}
  if(!fs.existsSync(file)){res.writeHead(404);res.end('Not found');return;}
  const stat=fs.statSync(file);if(!stat.isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});
  if(req.method==='HEAD')res.end();else fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
});
const port=Number(process.env.PORT||4173);
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`端口 ${port} 已使用。若已启动赛事，请直接打开 http://127.0.0.1:${port}/ 。否则关闭占用程序，或设置 PORT 后重启。`:error.message);process.exit(1);});
server.listen(port,'127.0.0.1',()=>console.log(`\n  弈境 QI ARENA · 五院棋类友谊赛\n\n  控制台  http://127.0.0.1:${port}/\n  现场屏  http://127.0.0.1:${port}/?screen=1\n\n  请在浏览器打开以上地址。保留此窗口，按 Ctrl+C 停止。\n`));
