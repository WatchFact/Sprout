import {env} from 'cloudflare:workers';
import {isModerator} from './moderation';
import {defaultModSettings} from './mod-controls';
export async function writeRestriction(user:{userId:string;email:string;accountUserId?:string},feature:'uploads'|'comments'|'profiles'):Promise<string|null>{
 if(isModerator(user))return null;
 const settings:any=await env.DB!.prepare("SELECT data FROM records WHERE id='mod-settings:site'").first();
 const policy=settings?{...defaultModSettings,...JSON.parse(settings.data)}:defaultModSettings;
 if(feature==='uploads'&&policy.uploadsPaused)return 'Uploads are temporarily paused by the site owner.';
 if(feature==='comments'&&policy.commentsPaused)return 'Comments are temporarily paused by the site owner.';
 if(user.accountUserId&&user.accountUserId!==user.userId){const principalBlock=await writeRestriction({...user,userId:user.accountUserId,accountUserId:undefined},feature);if(principalBlock)return principalBlock}
 const row:any=await env.DB!.prepare("SELECT data FROM records WHERE id=? AND kind='mod-restriction'").bind('mod-restriction:'+user.userId).first();
 const data=row?JSON.parse(row.data):{};const until=data[feature+'Until'];
 return typeof until==='number'&&until>Date.now()?'Your permission to '+(feature==='uploads'?'upload':feature==='comments'?'comment':'edit your profile')+' is paused until '+new Date(until).toISOString()+'. '+String(data.reason||''):null;
}
export async function creatorNotices(id:string){const rows=await env.DB!.prepare("SELECT id,data,created FROM records WHERE kind='mod-warning' AND json_extract(data,'$.target')=? ORDER BY created DESC LIMIT 10").bind(id).all();return rows.results.map((r:any)=>({id:r.id,text:JSON.parse(r.data).text,created:r.created}));}
