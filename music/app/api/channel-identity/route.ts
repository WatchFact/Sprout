import {sameOrigin,readJsonObject,inputError} from '../../../lib/request-security';
import {env} from 'cloudflare:workers';
import {getSproutUser} from '../../../lib/sprout-auth';
import {writeRestriction} from '../../../lib/mod-enforcement';
import {normaliseHandle,subscriberCount} from '../../../lib/channel-identity';
const json=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){const u=await getSproutUser();if(!u)return json({error:'Sign in to customise your channel.'},401);if(!u.canPublish)return json({error:'Switch to a brand channel to customise a public profile.'},403);const [count,claim,unlock]=await Promise.all([subscriberCount(u.userId),env.DB!.prepare("SELECT data FROM records WHERE owner=? AND kind='channel-handle' LIMIT 1").bind(u.userId).first(),env.DB!.prepare("SELECT id FROM records WHERE id=? AND kind='channel-unlock'").bind('channel-unlock:'+u.userId).first()]);return json({count,threshold:1000,eligible:count>=1000||!!unlock||!!claim,handle:claim?JSON.parse((claim as any).data).handle:''})}
export async function POST(req:Request){
 const u=await getSproutUser();if(!u)return json({error:'Sign in to customise your channel.'},401);if(!sameOrigin(req))return json({error:'Invalid origin'},403);if(!u.canPublish)return json({error:'Switch to a brand channel to customise a public profile.'},403);const blocked=await writeRestriction(u,'profiles');if(blocked)return json({error:blocked},403);
 let b:any;try{b=await readJsonObject(req,2048)}catch(e){return inputError(e)}let handle:string;try{handle=normaliseHandle(b.handle)}catch(e:any){return json({error:e.message||'Invalid channel ID.'},400)}
 const profile:any=await env.DB!.prepare("SELECT data FROM records WHERE id=? AND kind='profile'").bind('profile:'+u.userId+':main').first();if(profile&&JSON.parse(profile.data).status==='rejected')return json({error:'A removed channel must be restored by a moderator.'},403);
 const existing=await env.DB!.prepare("SELECT id FROM records WHERE owner=? AND kind IN ('channel-handle','channel-unlock') LIMIT 1").bind(u.userId).first();if(!existing&&await subscriberCount(u.userId)<1000)return json({error:'A personalised channel ID unlocks at 1,000 subscribers.'},403);
 try{await env.DB!.batch([
 env.DB!.prepare("DELETE FROM records WHERE owner=? AND kind='channel-handle'").bind(u.userId),
 env.DB!.prepare('INSERT INTO records(id,owner,kind,data,created) VALUES(?,?,?,?,?)').bind('channel-handle:'+handle,u.userId,'channel-handle',JSON.stringify({handle}),Date.now()),
 env.DB!.prepare('INSERT OR IGNORE INTO records(id,owner,kind,data,created) VALUES(?,?,?,?,?)').bind('channel-unlock:'+u.userId,u.userId,'channel-unlock',JSON.stringify({unlocked:true}),Date.now()),
 env.DB!.prepare('INSERT OR IGNORE INTO records(id,owner,kind,data,created) VALUES(?,?,?,?,?)').bind('profile:'+u.userId+':main',u.userId,'profile',JSON.stringify({name:'Independent creator',bio:'',status:'published'}),Date.now())]);
 }catch{return json({error:'That channel ID is already taken. Your current ID was kept.'},409)}
 return json({ok:true,handle,path:'/c/'+handle});
}
