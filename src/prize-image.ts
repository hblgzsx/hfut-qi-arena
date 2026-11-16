export async function preparePrizeImage(file:File):Promise<string>{
 if(file.size>20*1024*1024)throw new Error('图片超过 20 MB，请选择较小图片。');
 if(!/^image\//.test(file.type)&&! /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name))throw new Error('请选择 JPG、PNG、WebP、GIF、BMP 或 AVIF 图片。');
 const url=URL.createObjectURL(file);
 try{
 const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('图片无法解码，请先转为 JPG 或 PNG 后重试。'));image.src=url;});
 const canvas=document.createElement('canvas');const ratio=Math.min(1,1000/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('浏览器不支持图片处理，请换用 Edge 或 Chrome。');ctx.drawImage(img,0,0,canvas.width,canvas.height);
 for(const quality of [.86,.72,.56,.4]){const data=canvas.toDataURL('image/webp',quality);if(data.length<=480000)return data;}
 const scale=.6;const smaller=document.createElement('canvas');smaller.width=Math.max(1,Math.round(canvas.width*scale));smaller.height=Math.max(1,Math.round(canvas.height*scale));smaller.getContext('2d')!.drawImage(canvas,0,0,smaller.width,smaller.height);const data=smaller.toDataURL('image/jpeg',.65);if(data.length>480000)throw new Error('图片过于复杂，请裁剪后重试。');return data;
 }finally{URL.revokeObjectURL(url);}
}
