export interface VoiceInfo {voiceURI:string;name:string;lang:string}
export type VoiceGender='auto'|'female'|'male';
export function voiceGender(voice:Pick<VoiceInfo,'name'|'voiceURI'>):VoiceGender {
  const name=voice.name+' '+voice.voiceURI;
  if(/yunxi|yunjian|yunyang|yunfeng|yunhao|yunye|yunxia|yunze|yunzhe|kangkang|云希|云健|康康/i.test(name))return 'male';
  if(/xiaoxiao|xiaoyi|xiaochen|xiaohan|xiaomeng|xiaomo|xiaoqiu|xiaorui|xiaoshuang|xiaoxuan|xiaoyan|xiaoyou|huihui|yaoyao|hanhan|hsiaochen|hsiaoyu|晓晓|晓伊|慧慧|瑶瑶/i.test(name))return 'female';
  return 'auto';
}
export function isNaturalVoice(voice:VoiceInfo){return /natural|neural|自然/i.test(voice.name);}
export function chooseVoice<T extends VoiceInfo>(voices:T[],gender:VoiceGender,uri=''):T|undefined{
  const available=voices.filter(v=>/^zh/i.test(v.lang)&&(gender==='auto'||voiceGender(v)===gender));
  return available.find(v=>v.voiceURI===uri)||available.find(isNaturalVoice)||available[0];
}
export function voiceLabel(v:VoiceInfo){
  const gender=voiceGender(v),names:[RegExp,string][]=[[/xiaoxiao/i,'晓晓'],[/yunxi/i,'云希'],[/huihui/i,'慧慧'],[/kangkang/i,'康康'],[/yaoyao/i,'瑶瑶'],[/xiaoyi/i,'晓伊'],[/yunjian/i,'云健']];
  const name=names.find(([pattern])=>pattern.test(v.name))?.[1]||v.name;
  return name+' · '+(gender==='female'?'女声':gender==='male'?'男声':'系统音色')+' · '+(isNaturalVoice(v)?'自然音色':'系统合成')+' · '+v.lang;
}
