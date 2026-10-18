import {sameOrigin,readJsonObject,inputError} from '../../../lib/request-security';
import {writeRestriction} from '../../../lib/mod-enforcement';
import {subscriberCount} from '../../../lib/channel-identity';
import {publicationStatus,publicationReason,publicationUpdate} from '../../../lib/publishing';
import {env} from 'cloudflare:workers';import {getSproutUser} from '../../../lib/sprout-auth';import {isModerator} from '../../../lib/moderation';import {validateDefaults,validateVideoDetails,initialDefaults} from '../../../lib/studio';import {categories} from '../../../lib/catalog';
export const dynamic='force-dynamic';
const json=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){const user=await getSproutUser();if(!user)return json({error:'Sign in to open Creator studio.'},401);
 if(!user.canPublish)return json({error:'Your parent account is viewing-only. Switch to a brand channel to open the studio.'},403);
 const videos=await env.DB!.prepare("SELECT id,data,created FROM records WHERE kind='video' AND owner=? ORDER BY created DESC").bind(user.userId).all();
 const comments=await env.DB!.prepare("SELECT c.id,c.owner,c.data,c.created FROM records c WHERE c.kind='comment' AND EXISTS (SELECT 1 FROM records v WHERE v.kind='video' AND v.owner=? AND json_extract(v.data,'$.id')=json_extract(c.data,'$.video')) AND (json_extract(c.data,'$.status')='published' OR c.owner=? OR ?=1) ORDER BY c.created DESC").bind(user.userId,user.userId,isModerator(user)?1:0).all();
 const pref:any=await env.DB!.prepare("SELECT data FROM records WHERE owner=? AND kind='upload-defaults' LIMIT 1").bind(user.userId).first();
 const engagement=await env.DB!.prepare("SELECT json_extract(r.data,'$.video') AS video,r.kind,COUNT(DISTINCT COALESCE(json_extract(r.data,'$.accountId'),r.owner)) AS total FROM records r WHERE r.kind IN ('history','like','dislike') AND EXISTS (SELECT 1 FROM records v WHERE v.kind='video' AND v.owner=? AND json_extract(v.data,'$.id')=json_extract(r.data,'$.video')) AND (r.kind!='history' OR COALESCE(json_extract(r.data,'$.accountId'),r.owner)!=?) GROUP BY json_extract(r.data,'$.video'),r.kind").bind(user.userId,user.accountUserId||user.userId).all();
 const playlists=await env.DB!.prepare("SELECT id,data,created FROM records WHERE owner=? AND kind='playlist' ORDER BY created DESC").bind(user.viewerId||user.userId).all();
 return json({stats:{subscribers:await subscriberCount(user.userId),engagement:engagement.results},playlists:playlists.results.map((r:any)=>({...r,data:JSON.parse(r.data)})),videos:await Promise.all(videos.results.map(async(r:any)=>{const d=JSON.parse(r.data);if(d.size===undefined&&d.media){const o=await env.BUCKET!.head(d.media);d.size=o?.size||0}return d})),comments:comments.results.map((r:any)=>({...r,data:JSON.parse(r.data)})),defaults:pref?JSON.parse(pref.data):initialDefaults});
}
export async function POST(req:Request){const user=await getSproutUser();if(!user)return json({error:'Sign in to manage videos.'},401);if(!user.canPublish)return json({error:'Switch to a publishing channel.'},403);if(!sameOrigin(req))return json({error:'Invalid origin'},403);let b:any;try{b=await readJsonObject(req)}catch(e){return inputError(e)}
 try{
 if(!['delete','delete-comment'].includes(b.action)){const blocked=await writeRestriction(user,'uploads');if(blocked)return json({error:blocked},403)}
 if(b.action==='defaults'){const data=validateDefaults(b.data);await env.DB!.prepare('INSERT INTO records(id,owner,kind,data,created) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,created=excluded.created').bind('upload-defaults:'+user.userId+':main',user.userId,'upload-defaults',JSON.stringify(data),Date.now()).run();return json({ok:true})}
 if(b.action==='delete-comment'){if(typeof b.id!=='string')return json({error:'Invalid comment'},400);const r:any=await env.DB!.prepare("SELECT data FROM records WHERE kind='comment' AND id=?").bind(b.id).first();if(!r)return json({error:'Comment not found'},404);const video=JSON.parse(r.data).video;const v=await env.DB!.prepare("SELECT id FROM records WHERE kind='video' AND owner=? AND json_extract(data,'$.id')=?").bind(user.userId,video).first();if(!v)return json({error:'You can manage comments only on your own videos.'},403);await env.DB!.prepare("DELETE FROM records WHERE id=? AND kind='comment'").bind(b.id).run();return json({ok:true})}
 if(!['details','category','visibility','submit','delete'].includes(b.action)||!Array.isArray(b.ids)||b.ids.length<1||b.ids.length>50||b.ids.some((id:any)=>typeof id!=='string'||id.length>100))return json({error:'Select between 1 and 50 videos.'},400);
 if(!user.canPublish)return json({error:'Your parent account is viewing-only. Switch to a brand channel to open the studio.'},403);
 const videos=await Promise.all([...new Set<string>(b.ids)].map(async id=>{const r:any=await env.DB!.prepare("SELECT id,data FROM records WHERE kind='video' AND owner=? AND json_extract(data,'$.id')=?").bind(user.userId,id).first();return r?{id:r.id,data:JSON.parse(r.data)}:null}));if(videos.some(v=>!v))return json({error:'A selected video does not belong to your channel.'},403);
 let details:any;if(b.action==='details'){if(videos.length!==1)return json({error:'Edit one video at a time.'},400);details=validateVideoDetails(b.data);const duration=String(videos[0]!.data.duration||'');if(/^\d+(?::\d{1,2}){1,2}$/.test(duration)){const seconds=duration.split(':').reduce((n:number,s:string)=>n*60+Number(s),0);if(details.chapters.some((c:any)=>c.seconds>=seconds))return json({error:'Chapter times must be within the video’s duration.'},400)}}
 if(b.action==='category'&&!categories.slice(1).includes(b.category))return json({error:'Choose a valid category.'},400);
 if(b.action==='visibility'&&!['public','private'].includes(b.visibility))return json({error:'Invalid visibility'},400);
 if(b.action==='submit'&&videos.some(v=>!['draft','pending'].includes(v!.data.status)))return json({error:'Only unpublished drafts can be published. Removed videos require a moderator to restore them.'},400);
 if(b.action==='delete'){
 if(b.confirm!=='DELETE')return json({error:'Confirm deletion first.'},400);
 const keys=videos.flatMap(v=>[v!.data.media,v!.data.posterKey,v!.data.captionsKey].filter(Boolean));if(keys.length)await env.BUCKET!.delete(keys);
 await env.DB!.batch(videos.flatMap(v=>[env.DB!.prepare('DELETE FROM records WHERE id=? AND owner=?').bind(v!.id,user.userId),env.DB!.prepare("DELETE FROM records WHERE kind='comment' AND json_extract(data,'$.video')=?").bind(v!.data.id)]));return json({ok:true});
 }
 const updates=videos.map(v=>{const old=v!.data;let data={...old};if(b.action==='details')data={...old,...details};if(b.action==='category')data.category=b.category;if(b.action==='visibility')data.visibility=b.visibility;
 data.status=b.action==='submit'?'published':publicationStatus(old.status);data.moderationReason=b.action==='submit'?'':publicationReason(old.status,old.moderationReason);data.updated=Date.now();return publicationUpdate(v!.id,user.userId,data,b.action==='submit')});await env.DB!.batch(updates);return json({ok:true});
 }catch(e:any){return json({error:e.message||'Could not update your videos.'},400)}
}
