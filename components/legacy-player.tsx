'use client';
import {useCallback,useEffect,useRef,useState,type ReactNode,type RefObject} from 'react';
import {Play,Pause,Volume2,VolumeX,Settings,Theater,PictureInPicture,Fullscreen,Captions,Repeat} from './md2-icons';

export function playerTime(value:number){
 if(!Number.isFinite(value)||value<0)return '0:00';
 const seconds=Math.floor(value),minutes=Math.floor(seconds/60);
 return (minutes>=60?Math.floor(minutes/60)+':'+String(minutes%60).padStart(2,'0'):String(minutes))+':'+String(seconds%60).padStart(2,'0');
}
export function playerSeek(value:number,duration:number){return Number.isFinite(duration)&&duration>0?Math.min(duration,Math.max(0,Number.isFinite(value)?value:0)):0}

type Props={videoRef:RefObject<HTMLVideoElement|null>;theater:boolean;setTheater:(v:boolean)=>void;notify:(s:string)=>void;children:ReactNode};
export default function LegacyPlayer({videoRef,theater,setTheater,notify,children}:Props){
 const shell=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),lastVolume=useRef(1);
 const [paused,setPaused]=useState(true),[ended,setEnded]=useState(false),[time,setTime]=useState(0),[duration,setDuration]=useState(0),[buffered,setBuffered]=useState(0),[volume,setVolume]=useState(1),[muted,setMuted]=useState(false),[speed,setSpeed]=useState(1),[loop,setLoop]=useState(false),[caption,setCaption]=useState(-1),[tracks,setTracks]=useState<string[]>([]),[visible,setVisible]=useState(true),[settings,setSettings]=useState(false),[waiting,setWaiting]=useState(false),[failed,setFailed]=useState(false),[fullscreen,setFullscreen]=useState(false),[pipAvailable,setPipAvailable]=useState(false);
 const reveal=useCallback(()=>{
  setVisible(true);if(timer.current)clearTimeout(timer.current);
  timer.current=setTimeout(()=>{const v=videoRef.current;const active=document.activeElement;const keyboardFocus=!!active&&shell.current?.contains(active)&&active.matches(':focus-visible');if(v&&!v.paused&&!keyboardFocus)setVisible(false)},3000);
 },[videoRef]);
 const playPause=useCallback(()=>{const v=videoRef.current;if(!v)return;if(v.paused){if(v.ended)v.currentTime=0;v.play().catch(()=>notify('Tap play to start the video.'))}else v.pause();reveal()},[videoRef,notify,reveal]);
 const seek=useCallback((next:number)=>{const v=videoRef.current;if(v&&Number.isFinite(v.duration)&&v.duration>0){v.currentTime=playerSeek(next,v.duration);setTime(v.currentTime)}reveal()},[videoRef,reveal]);
 const toggleMute=useCallback(()=>{const v=videoRef.current;if(!v)return;if(v.muted||v.volume===0){v.muted=false;if(v.volume===0)v.volume=lastVolume.current||1}else{lastVolume.current=v.volume;v.muted=true}reveal()},[videoRef,reveal]);
 const full=useCallback(async()=>{
  const root=shell.current,v=videoRef.current as (HTMLVideoElement&{webkitEnterFullscreen?:()=>void})|null;if(!root||!v)return;
  try{if(document.fullscreenElement)await document.exitFullscreen();else if(root.requestFullscreen)await root.requestFullscreen();else if(v.webkitEnterFullscreen)v.webkitEnterFullscreen();else notify('Fullscreen is unavailable in this browser.')}catch{notify('Fullscreen is unavailable in this browser.')}reveal();
 },[videoRef,notify,reveal]);
 const pip=useCallback(async()=>{try{const v=videoRef.current;if(!v)return;if(document.pictureInPictureElement)await document.exitPictureInPicture();else if(document.pictureInPictureEnabled)await v.requestPictureInPicture();else notify('Picture-in-picture is unavailable in this browser.')}catch{notify('Picture-in-picture is unavailable for this video.')}reveal()},[videoRef,notify,reveal]);
 const chooseCaption=useCallback((index:number)=>{const v=videoRef.current;if(!v)return;Array.from(v.textTracks).forEach((track,i)=>{track.mode=i===index?'showing':'hidden'});setCaption(index);reveal()},[videoRef,reveal]);
 useEffect(()=>{
  const v=videoRef.current;if(!v)return;
  const sync=()=>{setPaused(v.paused);setEnded(v.ended);setTime(Number.isFinite(v.currentTime)?v.currentTime:0);setDuration(Number.isFinite(v.duration)?v.duration:0);setVolume(v.volume);setMuted(v.muted);setSpeed(v.playbackRate);setLoop(v.loop);let end=0;for(let i=0;i<v.buffered.length;i++)if(v.buffered.start(i)<=v.currentTime+.5)end=Math.max(end,v.buffered.end(i));setBuffered(end)};
  const syncTracks=()=>{const list=Array.from(v.textTracks);setTracks(list.map((t,i)=>t.label||t.language||'Captions '+(i+1)));setCaption(list.findIndex(t=>t.mode==='showing'))};
  const onPlay=()=>{sync();setFailed(false);reveal()},onPause=()=>{sync();setVisible(true)},onWaiting=()=>setWaiting(true),onPlaying=()=>{setWaiting(false);sync();reveal()},onError=()=>{setFailed(true);setWaiting(false);setVisible(true)},onReady=()=>{setWaiting(false);sync();syncTracks()},onFullscreen=()=>{setFullscreen(document.fullscreenElement===shell.current);reveal()};
  const listeners:Record<string,()=>void>={timeupdate:sync,durationchange:sync,loadedmetadata:onReady,progress:sync,volumechange:sync,ratechange:sync,play:onPlay,pause:onPause,ended:onPause,waiting:onWaiting,stalled:onWaiting,playing:onPlaying,canplay:onReady,error:onError};
  Object.entries(listeners).forEach(([name,fn])=>v.addEventListener(name,fn));v.textTracks.addEventListener('change',syncTracks);v.textTracks.addEventListener('addtrack',syncTracks);document.addEventListener('fullscreenchange',onFullscreen);
  setPipAvailable(!!document.pictureInPictureEnabled&&typeof v.requestPictureInPicture==='function');sync();syncTracks();reveal();
  return()=>{Object.entries(listeners).forEach(([name,fn])=>v.removeEventListener(name,fn));v.textTracks.removeEventListener('change',syncTracks);v.textTracks.removeEventListener('addtrack',syncTracks);document.removeEventListener('fullscreenchange',onFullscreen);if(timer.current)clearTimeout(timer.current)};
 },[videoRef,reveal]);
 useEffect(()=>{if(!settings)return;const dismiss=(e:PointerEvent)=>{if(!(e.target as Element).closest('.sprout-player-settings,.sprout-settings-button'))setSettings(false)};document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss)},[settings]);
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   const el=e.target as HTMLElement;if(e.key==='Escape'&&settings){setSettings(false);shell.current?.querySelector<HTMLButtonElement>('.sprout-settings-button')?.focus();return}
   if(document.querySelector('[role=dialog]')||el.isContentEditable||el.closest('input,textarea,select,button,a,[role=dialog]')||e.ctrlKey||e.metaKey||e.altKey)return;
   const v=videoRef.current;if(!v)return;const k=e.key.toLowerCase();if(![' ','k','j','l','arrowleft','arrowright','arrowup','arrowdown','m','f','t','i','c','home','end',',','.'].includes(k)&&!/^\d$/.test(k))return;
   e.preventDefault();reveal();if(k===' '||k==='k')playPause();else if(['j','l','arrowleft','arrowright'].includes(k))seek(v.currentTime+(['j','arrowleft'].includes(k)?-1:1)*(k==='j'||k==='l'?10:5));else if(k==='m')toggleMute();else if(k==='f')void full();else if(k==='t')setTheater(!theater);else if(k==='i')void pip();else if(k==='c'){if(v.textTracks.length)chooseCaption(caption<0?0:-1);else notify('No captions were uploaded for this video.')}else if(k==='arrowup'||k==='arrowdown'){v.volume=Math.max(0,Math.min(1,v.volume+(k==='arrowup'?.05:-.05)));v.muted=false}else if(k==='home')seek(0);else if(k==='end')seek(v.duration);else if(/^\d$/.test(k))seek(Number(k)*v.duration/10);else if((k===','||k==='.')&&v.paused)seek(v.currentTime+(k==='.'?1:-1)/30);
  };window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
 },[videoRef,theater,setTheater,notify,caption,settings,playPause,seek,toggleMute,full,pip,chooseCaption,reveal]);
 const shown=visible||paused||settings||waiting||failed,percent=duration>0?time/duration*100:0;
 return <div ref={shell} className={'player-shell sprout-player'+(shown?' controls-visible':'')} role="region" aria-label="Video player" tabIndex={0} onPointerMove={reveal} onPointerDown={reveal} onFocusCapture={reveal} onClick={e=>{if((e.target as HTMLElement).tagName==='VIDEO')playPause()}}>
  {children}
  {waiting&&!paused&&!failed&&<span className="sprout-player-loading" role="status" aria-label="Buffering video"/>}
  {failed?<div className="sprout-player-error" role="alert"><b>This video couldn’t be loaded.</b><span>Check your connection and try again.</span><button onClick={()=>{const v=videoRef.current;if(v){setFailed(false);v.load();v.play().catch(()=>{setVisible(true)})}}}>Try again</button></div>:paused&&<button className="sprout-player-center" onClick={playPause} aria-label={ended?'Replay video':'Play video'}>{ended?<Repeat size={40}/>:<Play size={44}/>}</button>}
  <div className="sprout-player-controls" aria-label="Playback controls" inert={!shown}>
   <div className="sprout-seek"><div className="sprout-seek-track"><span className="sprout-buffered" style={{width:Math.min(100,duration?buffered/duration*100:0)+'%'}}/><span className="sprout-played" style={{width:percent+'%'}}/></div><input aria-label="Seek video" type="range" min={0} max={duration||1} step="0.1" value={Math.min(time,duration||0)} disabled={!duration} aria-valuetext={playerTime(time)+' of '+playerTime(duration)} onChange={e=>seek(Number(e.target.value))}/></div>
   <div className="sprout-control-row">
    <button onClick={playPause} aria-label={ended?'Replay video':paused?'Play (K)':'Pause (K)'} title={paused?'Play (K)':'Pause (K)'}>{ended?<Repeat/>:paused?<Play/>:<Pause/>}</button>
    <div className="sprout-volume"><button onClick={toggleMute} aria-label={muted||volume===0?'Unmute (M)':'Mute (M)'} title={muted?'Unmute (M)':'Mute (M)'}>{muted||volume===0?<VolumeX/>:<Volume2/>}</button><input aria-label="Volume" type="range" min={0} max={100} value={muted?0:Math.round(volume*100)} onChange={e=>{const v=videoRef.current;if(v){v.volume=Number(e.target.value)/100;v.muted=false;if(v.volume>0)lastVolume.current=v.volume}}}/></div>
    <span className="sprout-time" aria-live="off">{playerTime(time)} <span>/</span> {playerTime(duration)}</span><div className="sprout-controls-spacer"/>
    {!!tracks.length&&<button className={'sprout-cc'+(caption>=0?' enabled':'')} aria-label={caption>=0?'Turn captions off (C)':'Turn captions on (C)'} aria-pressed={caption>=0} title="Captions (C)" onClick={()=>chooseCaption(caption<0?0:-1)}><Captions/></button>}
    <button className="sprout-settings-button" title="Settings" aria-label="Player settings" aria-expanded={settings} aria-controls="sprout-player-settings" onClick={()=>{setSettings(!settings);reveal()}}><Settings/></button>
    {pipAvailable&&<button className="sprout-pip" onClick={()=>void pip()} aria-label="Picture-in-picture (I)" title="Picture-in-picture (I)"><PictureInPicture/></button>}
    <button className="sprout-theater" onClick={()=>setTheater(!theater)} aria-label="Theater mode (T)" aria-pressed={theater} title="Theater mode (T)"><Theater/></button>
    <button onClick={()=>void full()} aria-label={fullscreen?'Exit fullscreen (F)':'Fullscreen (F)'} title={fullscreen?'Exit fullscreen (F)':'Fullscreen (F)'}><Fullscreen/></button>
   </div>
  </div>
  {settings&&<div id="sprout-player-settings" className="sprout-player-settings" role="group" aria-label="Player settings"><label>Playback speed<select value={speed} onChange={e=>{const v=videoRef.current;if(v){v.playbackRate=Number(e.target.value);setSpeed(v.playbackRate)}}}>{[.25,.5,.75,1,1.25,1.5,1.75,2].map(s=><option key={s} value={s}>{s===1?'Normal':s+'×'}</option>)}</select></label><label>Captions<select value={caption} disabled={!tracks.length} onChange={e=>chooseCaption(Number(e.target.value))}><option value={-1}>{tracks.length?'Off':'Not available'}</option>{tracks.map((t,i)=><option key={i} value={i}>{t}</option>)}</select></label><button aria-pressed={loop} onClick={()=>{const v=videoRef.current;if(v){v.loop=!v.loop;setLoop(v.loop)}}}><span>Loop video</span><span>{loop?'On':'Off'}</span></button><details><summary>Keyboard shortcuts</summary><p>K / Space: play or pause<br/>J / L: back or forward 10s<br/>Arrows: seek / volume<br/>M: mute · C: captions<br/>F: fullscreen · T: theater<br/>I: picture-in-picture<br/>0–9: seek by percentage<br/>, / .: frame step while paused</p></details></div>}
 </div>;
}
