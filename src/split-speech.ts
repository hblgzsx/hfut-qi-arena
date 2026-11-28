// Short phrases avoid Chromium stopping a long utterance halfway through.
// Preserve every character, and wait for each phrase's onend before the next.
export function splitSpeechText(text:string,max=32):string[]{
 const chunks:string[]=[];let part='';
 for(const char of Array.from(text)){part+=char;if(Array.from(part).length>=max||(/[。！？!?；;]/.test(char)&&part.length>=8)){chunks.push(part);part='';}}
 if(part)chunks.push(part);return chunks.filter(c=>c.trim());
}
