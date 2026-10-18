export async function compressVideo(file:File,onProgress:(value:number)=>void,signal:AbortSignal):Promise<File>{
 const cap=95*1024*1024;if(file.size<40*1024*1024)return file;
 if(typeof MediaRecorder==='undefined'||!HTMLCanvasElement.prototype.captureStream){if(file.size<=cap)return file;throw Error('This browser cannot compress video locally. Try a current Chromium or Firefox browser, or choose a smaller video. No file has been uploaded.')}
 const mime=['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw Error('No supported local video encoder is available.');
 const video=document.createElement('video');video.preload='auto';video.playsInline=true;video.muted=true;const url=URL.createObjectURL(file);video.src=url;
 let ctx:AudioContext|undefined,stream:MediaStream|undefined,rec:MediaRecorder|undefined,timer:ReturnType<typeof setInterval>|undefined;
 try{
  ctx=new AudioContext();const audioReady=ctx.resume();
  await new Promise<void>((resolve,reject)=>{video.onloadeddata=()=>resolve();video.onerror=()=>reject(Error('Your browser could not decode this video. Try an MP4 encoded with H.264.'));const timeout=setTimeout(()=>reject(Error('The video could not be opened.')),20000);video.addEventListener('loadeddata',()=>clearTimeout(timeout),{once:true});signal.addEventListener('abort',()=>{clearTimeout(timeout);reject(new DOMException('Cancelled','AbortError'))},{once:true})});
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');if(!Number.isFinite(video.duration)||video.duration<=0)throw Error('The video has an invalid duration.');
  const canvas=document.createElement('canvas');const scale=Math.min(1,1280/video.videoWidth,720/video.videoHeight);canvas.width=Math.max(2,Math.floor(video.videoWidth*scale/2)*2);canvas.height=Math.max(2,Math.floor(video.videoHeight*scale/2)*2);const draw=canvas.getContext('2d',{alpha:false});if(!draw)throw Error('Local compression is unavailable.');
  stream=canvas.captureStream(24);await audioReady;const source=ctx.createMediaElementSource(video);const dest=ctx.createMediaStreamDestination();source.connect(dest);for(const t of dest.stream.getAudioTracks())stream.addTrack(t);
  const totalBitrate=Math.floor(80*1024*1024*8/video.duration);const audioBitrate=Math.min(96000,Math.floor(totalBitrate*.15));const videoBitrate=Math.min(2400000,Math.max(90000,totalBitrate-audioBitrate));rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:videoBitrate,audioBitsPerSecond:audioBitrate});const chunks:Blob[]=[];let bytes=0;
  const result=await new Promise<Blob>((resolve,reject)=>{
   const finishError=(e:Error)=>{if(rec?.state!=='inactive')rec?.stop();reject(e)};
   signal.addEventListener('abort',()=>finishError(new DOMException('Compression cancelled','AbortError')),{once:true});
   rec!.ondataavailable=e=>{if(e.data.size){bytes+=e.data.size;chunks.push(e.data);if(bytes>cap)finishError(Error('The compressed video still exceeds 95 MB. Choose a shorter clip or reduce its resolution first.'))}};
   rec!.onerror=()=>finishError(Error('Your browser’s video encoder failed. No video has been uploaded.'));
   rec!.onstop=()=>resolve(new Blob(chunks,{type:rec?.mimeType||mime}));
   video.onended=()=>{if(rec?.state!=='inactive')rec?.stop()};video.onerror=()=>finishError(Error('Video decoding stopped during compression.'));
   draw.drawImage(video,0,0,canvas.width,canvas.height);rec!.start(1000);timer=setInterval(()=>{if(signal.aborted)return;draw.drawImage(video,0,0,canvas.width,canvas.height);onProgress(Math.min(99,Math.round(video.currentTime/video.duration*100)))},1000/24);
   video.play().catch(()=>finishError(Error('Local video playback was blocked. Keep this page open and try again.')));
  });
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');if(result.size>cap)throw Error('The compressed file is over 95 MB.');if(result.size===0)throw Error('The encoder produced an empty file.');onProgress(100);
  if(result.size>=file.size&&file.size<=cap)return file;
  const ext=result.type.includes('mp4')?'mp4':'webm';return new File([result],file.name.replace(/\.[^.]+$/,'')+'.'+ext,{type:result.type.includes('mp4')?'video/mp4':'video/webm'});
 }finally{if(timer)clearInterval(timer);video.pause();video.removeAttribute('src');video.load();if(rec&&rec.state!=='inactive')rec.stop();stream?.getTracks().forEach(t=>t.stop());await ctx?.close().catch(()=>{});URL.revokeObjectURL(url)}
}
