import { config } from './config.js';
import { videoSettings } from './video-settings.js';
import { chat } from './providers/index.js';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const allowedImages = new Set(['image/png','image/jpeg','image/webp','image/gif']);
const mimeExt = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp', 'image/gif':'gif' };
function decodeImage(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length > 12_000_000) throw new Error('Image is missing or too large (max about 8 MB).');
  const m = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!m || !allowedImages.has(m[1])) throw new Error('Use a PNG, JPG, WEBP or GIF image.');
  const bytes = Buffer.from(m[2], 'base64');
  if (!bytes.length || bytes.length > 8*1024*1024) throw new Error('Image must be smaller than 8 MB.');
  return { mime:m[1], bytes };
}
export async function describeImage({dataUrl,prompt='Describe this image clearly.'}, userId) {
  const {mime,bytes}=decodeImage(dataUrl);
  const content = [ {type:'text', text:String(prompt).slice(0,4000)}, {type:'image', mimeType:mime, data:bytes.toString('base64')} ];
  const result = await chat({messages:[{role:'user',content}], system:'You are an image understanding assistant. Describe only what is visible. State uncertainty when needed.', userId});
  return { description: result.content || '' };
}
export async function generateImage({prompt,size='1024x1024',quality='standard'}) {
  if (!config.imageApiKey || !config.imageModel) throw new Error('Image generation is not configured. Set IMAGE_API_KEY and IMAGE_MODEL in .env.');
  const response=await fetch(`${config.imageBaseUrl}/images/generations`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${config.imageApiKey}`},body:JSON.stringify({model:config.imageModel,prompt:String(prompt||'').slice(0,4000),size,quality,n:1,response_format:'b64_json'})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error?.message||`Image provider error (${response.status})`);
  const item=data.data?.[0]; if(!item?.b64_json) throw new Error('Image provider did not return an image.');
  return { image:`data:image/png;base64,${item.b64_json}`, revisedPrompt:item.revised_prompt||null };
}
function runFfmpeg(args, timeoutMs = 30_000) {
  return new Promise((resolve,reject)=>{const p=spawn(config.ffmpegPath,args,{stdio:['ignore','ignore','pipe']});let err='';let settled=false;const timer=setTimeout(()=>{p.kill('SIGKILL');if(!settled){settled=true;reject(new Error(`Video processing took too long (${Math.round(timeoutMs/1000)}-second limit).`));}},timeoutMs);p.stderr.on('data',d=>err+=d);p.on('error',e=>{if(!settled){settled=true;clearTimeout(timer);reject(e);}});p.on('close',code=>{clearTimeout(timer);if(settled)return;settled=true;code===0?resolve():reject(new Error(`Video frame extraction failed. Check FFmpeg is installed. ${err.slice(-500)}`));});});
}
export async function describeVideo({dataUrl,prompt='Summarize this video and its main events.'}, userId) {
  if(typeof dataUrl!=='string'||dataUrl.length>28_000_000) throw new Error('Video is missing or too large (maximum 20 MB).');
  const m=dataUrl.match(/^data:video\/(mp4|webm|quicktime);base64,([A-Za-z0-9+/=]+)$/); if(!m) throw new Error('Use an MP4, WEBM or MOV video.');
  const bytes=Buffer.from(m[2],'base64'); if(!bytes.length||bytes.length>20*1024*1024) throw new Error('Video must be smaller than 20 MB.');
  const dir=await mkdtemp(path.join(os.tmpdir(),'pas-video-'));
  try {
    const input=path.join(dir,`input.${m[1]==='quicktime'?'mov':m[1]}`); await writeFile(input,bytes,{mode:0o600});
    const { frames, seconds, intervalSeconds } = videoSettings();
    await runFfmpeg(['-nostdin','-v','error','-threads','1','-t',String(seconds),'-i',input,'-vf',`fps=${frames}/${seconds},scale=768:-1:force_original_aspect_ratio=decrease`,'-frames:v',String(frames),'-q:v','4',path.join(dir,'frame-%02d.jpg')], Math.max(30_000, seconds * 1000));
    const files=(await (await import('node:fs/promises')).readdir(dir)).filter(x=>/^frame-\d+\.jpg$/.test(x)).sort();
    if(!files.length) throw new Error('No video frames could be read.');
    const content=[{type:'text',text:`${String(prompt).slice(0,3000)}\nAnalyze these ${files.length} sampled frames in time order. They are sampled about every ${intervalSeconds} seconds; do not claim to have heard audio.`}];
    for(let i=0;i<files.length;i++){const b=await readFile(path.join(dir,files[i]));content.push({type:'text',text:`Frame ${i+1}`},{type:'image',mimeType:'image/jpeg',data:b.toString('base64')});}
    const result=await chat({messages:[{role:'user',content}],system:'You are a video understanding assistant. Analyze the provided sampled video frames, explain the visible sequence, and be clear that audio was not analyzed.',userId});
    return {summary:result.content||'',framesAnalyzed:files.length,sampledSeconds:seconds,note:'This version samples video frames. It does not analyze sound.'};
  } finally { await rm(dir,{recursive:true,force:true}); }
}
