import {sameOrigin,readJsonObject,inputError} from '../../../lib/request-security';
import {secondFactorSatisfied} from '../../../lib/two-factor';
import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {getSproutPrincipal,getSproutUser} from '../../../lib/sprout-auth';
import {writeRestriction} from '../../../lib/mod-enforcement';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){const principal=await getSproutPrincipal();if(!principal)return json({error:'Sign in to manage accounts.'},401);if(!await secondFactorSatisfied(principal.userId))return json({error:'Unlock your account with two-factor authentication.'},403);const active=await getSproutUser();const rows=await env.DB!.prepare("SELECT b.id,COALESCE((SELECT p.data FROM records p WHERE p.owner=b.id AND p.kind='profile' LIMIT 1),b.data) AS data FROM records b WHERE b.owner=? AND b.kind='brand' ORDER BY b.created").bind(principal.userId).all();const profile:any=await env.DB!.prepare("SELECT data FROM records WHERE owner=? AND kind='profile' LIMIT 1").bind(principal.userId).first();return json({active:active?.userId,email:principal.email,username:principal.displayName,viewingOnly:principal.viewingOnly,isModerator:principal.isModerator,accounts:[{id:principal.userId,name:profile?JSON.parse(profile.data).name:'Personal channel',type:'personal'},...rows.results.map((r:any)=>({id:r.id,name:JSON.parse(r.data).name,type:'brand'}))]})}
export async function POST(req:Request){const principal=await getSproutPrincipal();if(!principal)return json({error:'Sign in to manage accounts.'},401);if(!sameOrigin(req))return json({error:'Invalid origin.'},403);if(!await secondFactorSatisfied(principal.userId))return json({error:'Unlock your account with two-factor authentication.'},403);let b:any;try{b=await readJsonObject(req)}catch(e){return inputError(e)}
 let id=b.id;
 if(b.action==='create'){
 const blocked=await writeRestriction(principal,'profiles');if(blocked)return json({error:blocked},403);
 if(typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>80)return json({error:'Enter a brand name of up to 80 characters.'},400);
 const count:any=await env.DB!.prepare("SELECT COUNT(*) AS n FROM records WHERE owner=? AND kind='brand'").bind(principal.userId).first();if(count.n>=10)return json({error:'You can have up to 10 brand channels.'},409);
 id='brand:'+crypto.randomUUID();const now=Date.now();await env.DB!.batch([
 env.DB!.prepare("INSERT INTO records(id,owner,kind,data,created) SELECT ?,?,'brand',?,? WHERE (SELECT COUNT(*) FROM records WHERE owner=? AND kind='brand')<10").bind(id,principal.userId,JSON.stringify({name:b.name.trim()}),now,principal.userId),
 env.DB!.prepare("INSERT INTO records(id,owner,kind,data,created) SELECT ?,?,'profile',?,? WHERE EXISTS (SELECT 1 FROM records WHERE id=? AND kind='brand' AND owner=?)").bind('profile:'+id+':main',id,JSON.stringify({name:b.name.trim(),bio:'',status:'published'}),now,id,principal.userId)]);
 }else if(b.action!=='switch')return json({error:'Unknown account action.'},400);
 if(id!==principal.userId){if(typeof id!=='string')return json({error:'Choose a channel.'},400);const owned=await env.DB!.prepare("SELECT id FROM records WHERE id=? AND kind='brand' AND owner=?").bind(id,principal.userId).first();if(!owned)return json({error:'This channel does not belong to your account.'},403)}
 (await cookies()).set('sprout-active-channel',id===principal.userId?'':id,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:id===principal.userId?0:2592000});return json({ok:true,id});
}
