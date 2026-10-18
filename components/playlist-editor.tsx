 'use client';
import {useEffect,useState} from 'react';
import {Play,ArrowUp,ArrowDown} from './md2-icons';
type Record={id:string;data:any};
export default function PlaylistEditor({record,items,field,onSave,onPlay}:{record?:Record;items:{id:string;title:string}[];field:'videos'|'tracks';onSave:(r:Record,data:any)=>Promise<boolean>;onPlay:(ids:string[])=>void}){
 const [name,setName]=useState(''),[busy,setBusy]=useState(false),[expanded,setExpanded]=useState(false);
 useEffect(()=>setName(record?.data.name||''),[record?.id,record?.data.name]);
 if(!record)return null;const ids:string[]=record.data[field]||[];
 async function change(next:string[]){if(!record)return;setBusy(true);try{await onSave(record,{...record.data,[field]:next})}finally{setBusy(false)}}
 return <section className="legacy-playlist"><div><button disabled={!ids.length} onClick={()=>onPlay(ids)}><Play size={18}/> Play all</button><button onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>Edit playlist</button><span>Private · {ids.length} {field}</span></div>{expanded&&<><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await onSave(record,{...record.data,name:name.trim()})}finally{setBusy(false)}}}><input aria-label="Playlist name" maxLength={80} required value={name} onChange={e=>setName(e.target.value)}/><button disabled={busy||!name.trim()}>Rename</button></form><ol>{ids.map((id,i)=><li key={id}><span>{items.find(t=>t.id===id)?.title||'Unavailable item'}</span><button aria-label={'Move item '+(i+1)+' up'} disabled={busy||i===0} onClick={()=>{const n=[...ids];[n[i-1],n[i]]=[n[i],n[i-1]];change(n)}}><ArrowUp size={18}/></button><button aria-label={'Move item '+(i+1)+' down'} disabled={busy||i===ids.length-1} onClick={()=>{const n=[...ids];[n[i+1],n[i]]=[n[i],n[i+1]];change(n)}}><ArrowDown size={18}/></button><button disabled={busy} onClick={()=>change(ids.filter(x=>x!==id))}>Remove</button></li>)}</ol></>}</section>
}
