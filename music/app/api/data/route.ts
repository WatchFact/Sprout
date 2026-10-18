import {sameOrigin,readJsonObject,inputError} from '../../../lib/request-security';
import {publicIdentities,awardChannelUnlock} from '../../../lib/channel-identity';
import {writeRestriction,creatorNotices} from '../../../lib/mod-enforcement';
import {publicationStatus,publicationReason,publicationUpdate} from '../../../lib/publishing';
import { env } from 'cloudflare:workers';
import { isModerator } from '../../../lib/moderation';
import { getSproutUser,getSproutPrincipal,authRate } from '../../../lib/sprout-auth';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 const user=await getSproutUser();
 const totals=await env.DB!.prepare("SELECT r.kind,json_extract(r.data,'$.track') as track,COUNT(DISTINCT COALESCE(json_extract(r.data,'$.accountId'),r.owner)) as total FROM records r WHERE r.kind IN ('like','history') AND EXISTS (SELECT 1 FROM records t WHERE t.kind='track' AND json_extract(t.data,'$.id')=json_extract(r.data,'$.track') AND json_extract(t.data,'$.status')='published' AND (r.kind!='history' OR COALESCE(json_extract(r.data,'$.accountId'),r.owner)!=COALESCE((SELECT owner FROM records WHERE id=t.owner AND kind='brand'),t.owner))) GROUP BY r.kind,json_extract(r.data,'$.track')").all();
 const result=await env.DB!.prepare("SELECT * FROM records r WHERE (r.kind IN ('track','profile') AND json_extract(r.data,'$.status')='published') OR (r.kind='comment' AND json_extract(r.data,'$.status')='published' AND EXISTS (SELECT 1 FROM records t WHERE t.kind='track' AND json_extract(t.data,'$.id')=json_extract(r.data,'$.track') AND json_extract(t.data,'$.status')='published')) OR r.owner=? OR (r.owner=? AND r.kind IN ('like','dislike','later','subscription','follow','history','playlist','preferences'))"+(isModerator(user)?" OR kind='track'":"")+" ORDER BY created DESC").bind(user?.userId||'anonymous',user?.viewerId||user?.userId||'anonymous').all();
 return json({requiresTwoFactor:!user&&!!await getSproutPrincipal(),identity:await publicIdentities(),warnings:user?await creatorNotices(user.userId):[],counts:totals.results,user:user?{id:user.userId,name:user.displayName,isBrand:user.isBrand,viewingOnly:user.viewingOnly,canPublish:user.canPublish,viewerId:user.viewerId}:null,isModerator:isModerator(user),records:result.results.filter((r:any)=>!r.kind.startsWith('two-factor')&&!r.kind.startsWith('sprout-')&&!r.kind.startsWith('auth-')&&!['email-challenge','email-verification','brand'].includes(r.kind)).map((r:any)=>({...r,data:JSON.parse(r.data)}))});
}
export async function POST(req:Request){
 let user=await getSproutUser();if(!user)return json({error:'Sign in to save your activity.'},401);
 if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 let body:any;try{body=await readJsonObject(req)}catch(e){return inputError(e)}
 const {kind,key,data,remove}=body;
 if(!user.canPublish&&['video','track','comment','profile'].includes(kind))return json({error:'Your parent account is viewing-only. Switch to a brand channel to publish.'},403);
 if(['like','dislike','later','subscription','follow','history','playlist','preferences'].includes(kind)&&user.viewerId)user={...user,userId:user.viewerId};
 if(!['like','later','follow','history','playlist','profile','comment','track','preferences','report'].includes(kind)||typeof key!=='string'||key.length>180)return json({error:'Invalid record'},400);
 if(!remove&&['comment','profile'].includes(kind)){const blocked=await writeRestriction(user,kind==='comment'?'comments':'profiles');if(blocked)return json({error:blocked},403)}
 if(kind==='profile'&&key!=='main')return json({error:'Use your main profile.'},400);
 const id=kind+':'+user.userId+':'+key;
 if(remove&&kind==='report')return json({error:'Reports are managed by moderators. Account deletion removes your report records.'},403);
 if(remove&&kind==='follow'){await env.DB!.prepare("DELETE FROM records WHERE owner=? AND kind=? AND json_extract(data,?)=?").bind(user.userId,kind,'$.artist',key).run();return json({ok:true})}
 if(remove){
  if(kind==='track'){
 const editingBlocked=await writeRestriction(user,'uploads');if(editingBlocked)return json({error:editingBlocked},403);const row:any=await env.DB!.prepare('SELECT data FROM records WHERE id=? AND owner=?').bind(id,user.userId).first();if(row){const v=JSON.parse(row.data);if(v.media)await env.BUCKET!.delete(v.media);if(v.coverKey)await env.BUCKET!.delete(v.coverKey)}}
  await env.DB!.prepare('DELETE FROM records WHERE id=? AND owner=?').bind(id,user.userId).run();return json({ok:true});
 }
 if(kind==='follow'){
 const targetOwner:any=await env.DB!.prepare("SELECT owner FROM records WHERE id=? AND kind='brand'").bind(key).first();if(key===(user.accountUserId||user.userId)||targetOwner?.owner===(user.accountUserId||user.userId))return json({error:'You cannot subscribe to your own channels.'},400);
 if(typeof data?.artist!=='string'||data.artist!==key||typeof data?.name!=='string'||data.name.length>80||key===user.userId)return json({error:'Choose another valid creator to subscribe to.'},400);
 const creator=await env.DB!.prepare("SELECT id FROM records WHERE owner=? AND kind IN ('profile','track') AND json_extract(data,'$.status')='published' LIMIT 1").bind(key).first();if(!creator)return json({error:'Channel unavailable.'},404);
 await env.DB!.prepare('INSERT INTO records(id,owner,kind,data,created) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(id,user.userId,kind,JSON.stringify({artist:key,name:data.name,accountId:user.accountUserId||user.userId}),Date.now()).run();await awardChannelUnlock(key);return json({ok:true});
 }
 if(kind==='like'){
 if(typeof data?.track!=='string'||data.track!==key)return json({error:'Invalid track'},400);
 const track=await env.DB!.prepare("SELECT id FROM records WHERE kind='track' AND json_extract(data,'$.id')=? AND json_extract(data,'$.status')='published'").bind(key).first();if(!track)return json({error:'Track unavailable'},404);
 }
 if(kind==='preferences'){
 if(key!=='privacy'||typeof data?.watchHistory!=='boolean')return json({error:'Invalid privacy preference'},400);
 const safe=JSON.stringify({watchHistory:data.watchHistory});
 const statements=[env.DB!.prepare('INSERT INTO records(id,owner,kind,data,created) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,created=excluded.created').bind(id,user.userId,kind,safe,Date.now())];
 if(!data.watchHistory)statements.push(env.DB!.prepare("DELETE FROM records WHERE owner=? AND kind='history'").bind(user.userId));
 await env.DB!.batch(statements);return json({ok:true});
 }
 if(kind==='history'){
 if(typeof data?.track!=='string'||data.track!==key)return json({error:'Invalid history entry'},400);
 const media=await env.DB!.prepare("SELECT id FROM records WHERE kind='track' AND json_extract(data,'$.id')=? AND json_extract(data,'$.status')='published'").bind(key).first();if(!media)return json({error:'Media unavailable'},404);
 const pref:any=await env.DB!.prepare("SELECT data FROM records WHERE owner=? AND kind='preferences' LIMIT 1").bind(user.userId).first();
 if(!pref||JSON.parse(pref.data).watchHistory!==true)return json({error:'Watch history is off. You can enable it in Privacy & data.'},403);
 }
 if(kind==='playlist'&&(typeof data?.name!=='string'||!data.name.trim()||data.name.length>80||!Array.isArray(data.tracks)||data.tracks.length>500||data.tracks.some((v:any)=>typeof v!=='string'||v.length>180)))return json({error:'Invalid playlist'},400);
 if(['like','later','history'].includes(kind)&&typeof data?.track!=='string')return json({error:'Invalid video'},400);
 if(kind==='follow'&&(typeof data?.artist!=='string'||typeof data?.name!=='string'))return json({error:'Invalid channel'},400);
 if(kind==='track'){
 const editingBlocked=await writeRestriction(user,'uploads');if(editingBlocked)return json({error:editingBlocked},403);
 const row:any=await env.DB!.prepare("SELECT data FROM records WHERE id=? AND owner=? AND kind='track'").bind(id,user.userId).first();
 if(!row)return json({error:'Video not found'},404);
 if(typeof data?.title!=='string'||!data.title.trim()||data.title.length>150||typeof data.description!=='string'||data.description.length>5000)return json({error:'Add a title and a description under 5,000 characters.'},400);
 if((data.album!==undefined&&(typeof data.album!=='string'||data.album.length>150))||(data.lyrics!==undefined&&(typeof data.lyrics!=='string'||data.lyrics.length>10000)))return json({error:'Album must be under 150 characters and lyrics under 10,000.'},400);
 const old=JSON.parse(row.data);await publicationUpdate(id,user.userId,{...old,title:data.title.trim(),album:data.album===undefined?old.album:data.album.trim(),lyrics:data.lyrics===undefined?old.lyrics:data.lyrics.trim(),description:data.description,genre:String(data.genre||old.genre).slice(0,50),status:publicationStatus(old.status),moderationReason:publicationReason(old.status,old.moderationReason)}).run();return json({ok:true});
 }
 if(!data||JSON.stringify(data).length>30000)return json({error:'Record too large'},400);
 if(kind==='comment'&&(typeof data.text!=='string'||!data.text.trim()||data.text.length>2000))return json({error:'Write a comment of up to 2,000 characters.'},400);
 if(kind==='profile'&&(typeof data.name!=='string'||!data.name.trim()||data.name.length>80||typeof data.bio!=='string'||data.bio.length>1000))return json({error:'Channel name is required (80 characters maximum).'},400);
 if(kind==='history'){
 await env.DB!.prepare("INSERT INTO records(id,owner,kind,data,created) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM records WHERE owner=? AND kind='preferences' AND json_extract(data,'$.watchHistory')=1) ON CONFLICT(id) DO UPDATE SET data=excluded.data,created=excluded.created").bind(id,user.userId,kind,JSON.stringify({track:data.track,accountId:user.accountUserId||user.userId}),Date.now(),user.userId).run();return json({ok:true});
 }
 if(kind==='comment'){
 const authorProfile:any=await env.DB!.prepare("SELECT data FROM records WHERE owner=? AND kind='profile' AND json_extract(data,'$.status')='published' LIMIT 1").bind(user.userId).first();data.name=authorProfile?JSON.parse(authorProfile.data).name:user.displayName;
 const track:any=await env.DB!.prepare("SELECT owner,data FROM records WHERE kind='track' AND json_extract(data,'$.id')=? LIMIT 1").bind(String(data.track||'')).first();if(!track)return json({error:'Track not found'},404);if(JSON.parse(track.data).moderationCommentsLocked===true)return json({error:'Comments are locked by a moderator.'},403);if(JSON.parse(track.data).status!=='published'&&track.owner!==user.userId&&!isModerator(user))return json({error:'Track not found'},404);
 const recent:any=await env.DB!.prepare("SELECT count(*) as n FROM records WHERE owner=? AND kind='comment' AND created>?").bind(user.userId,Date.now()-60000).first();if(recent.n>=5)return json({error:'Please wait a minute before commenting again.'},429);
 }
 if(kind==='report'){
 const oldReport=await env.DB!.prepare("SELECT id FROM records WHERE id=? AND owner=? AND kind='report'").bind(id,user.userId).first();if(oldReport)return json({error:'You already reported this item. Moderators will handle the existing report.'},409);

 if(typeof data.track!=='string'||!['Hate or harassment','Sexual content','Violence or dangerous content','Privacy violation','Scam or spam','Copyright','Other'].includes(data.reason)||typeof data.details!=='string'||data.details.length>2000)return json({error:'Choose a report reason and keep details under 2,000 characters.'},400);
 const reported:any=await env.DB!.prepare("SELECT owner,data FROM records WHERE kind='track' AND json_extract(data,'$.id')=? LIMIT 1").bind(data.track).first();if(!reported)return json({error:'Media unavailable.'},404);const reportedData=JSON.parse(reported.data);if((reportedData.status!=='published'||reportedData.visibility==='private')&&reported.owner!==user.userId&&!isModerator(user))return json({error:'Media unavailable.'},404);
 if(!await authRate('reports:'+(user.accountUserId||user.userId),5,3600000))return json({error:'Report limit reached. Wait before reporting another item.'},429);
 }
 if(['profile','comment'].includes(kind)){const existing:any=await env.DB!.prepare('SELECT data FROM records WHERE id=? AND owner=?').bind(id,user.userId).first();if(existing&&JSON.parse(existing.data).status==='rejected')return json({error:'A removed record can only be restored by a moderator.'},403)}
 const safe=kind==='like'?{track:key,accountId:user.accountUserId||user.userId}:kind==='report' ?{track:data.track,reason:data.reason,details:data.details,status:'pending',accountId:user.accountUserId||user.userId}:kind==='comment'?{track:String(data.track).slice(0,180),text:data.text.trim(),name:String(data.name||'Viewer').slice(0,80),status:'published'}:kind==='profile'?{name:data.name,bio:data.bio,status:'published'}:data;
 await env.DB!.prepare('INSERT INTO records(id,owner,kind,data,created) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,created=excluded.created WHERE records.kind!=\'report\' AND COALESCE(json_extract(records.data,\'$.status\'),\'\')!=\'rejected\'').bind(id,user.userId,kind,JSON.stringify(safe),Date.now()).run();return json({ok:true});
}
