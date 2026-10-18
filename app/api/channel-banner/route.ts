import {sameOrigin,inputError,readBytes} from '../../../lib/request-security';
import {env} from 'cloudflare:workers';
import {getSproutUser} from '../../../lib/sprout-auth';
import {writeRestriction} from '../../../lib/mod-enforcement';
const json=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
async function author(req:Request){const u=await getSproutUser();if(!u)return json({error:'Sign in to change your channel banner.'},401);if(!sameOrigin(req))return json({error:'Invalid origin'},403);if(!u.canPublish)return json({error:'Switch to a brand channel to customise a public profile.'},403);const blocked=await writeRestriction(u,'profiles');if(blocked)return json({error:blocked},403);return u}
export async function POST(req:Request){
 const u=await author(req);if(u instanceof Response)return u;
 const type=(req.headers.get('content-type')||'').split(';')[0],size=Number(req.headers.get('content-length'));
 if(!['image/jpeg','image/png','image/webp'].includes(type)||!Number.isSafeInteger(size)||size<1||size>6*1024*1024)return json({error:'Use a JPG, PNG or WebP image under 6 MB.'},400);
 let bytes:Uint8Array;try{bytes=await readBytes(req,6*1024*1024)}catch(e){return inputError(e)}if(bytes.length!==size)return json({error:'Invalid image size.'},400);
 const good=type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!good)return json({error:'The file does not match its image format.'},400);
 const profile:any=await env.DB!.prepare("SELECT data FROM records WHERE id=? AND kind='profile'").bind('profile:'+u.userId+':main').first();if(profile&&JSON.parse(profile.data).status==='rejected')return json({error:'A removed profile must be restored by a moderator.'},403);
 const old:any=await env.DB!.prepare("SELECT data FROM records WHERE id=? AND kind='banner'").bind('banner:'+u.userId+':main').first();const key=crypto.randomUUID(),src='/media/'+key;
 await env.BUCKET!.put(key,bytes,{httpMetadata:{contentType:type}});
 try{await env.DB!.batch([
 env.DB!.prepare('INSERT INTO records(id,owner,kind,data,created) VALUES(?,?,?,?,?)').bind('banner-file:'+key,u.userId,'banner-file',JSON.stringify({key}),Date.now()),
 env.DB!.prepare('INSERT INTO records(id,owner,kind,data,created) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,created=excluded.created').bind('banner:'+u.userId+':main',u.userId,'banner',JSON.stringify({key,src}),Date.now()),
 env.DB!.prepare('INSERT OR IGNORE INTO records(id,owner,kind,data,created) VALUES(?,?,?,?,?)').bind('profile:'+u.userId+':main',u.userId,'profile',JSON.stringify({name:'Independent creator',bio:'',status:'published'}),Date.now())]);}catch(e){await env.BUCKET!.delete(key);throw e}
 if(old){const prev=JSON.parse(old.data).key;if(prev){await env.BUCKET!.delete(prev);await env.DB!.prepare("DELETE FROM records WHERE id=? AND owner=? AND kind='banner-file'").bind('banner-file:'+prev,u.userId).run()}}
 return json({ok:true,src});
}
export async function DELETE(req:Request){const u=await author(req);if(u instanceof Response)return u;const row:any=await env.DB!.prepare("SELECT data FROM records WHERE id=? AND owner=? AND kind='banner'").bind('banner:'+u.userId+':main',u.userId).first();if(row){const key=JSON.parse(row.data).key;await env.DB!.batch([env.DB!.prepare("DELETE FROM records WHERE id=? AND owner=?").bind('banner:'+u.userId+':main',u.userId),env.DB!.prepare("DELETE FROM records WHERE id=? AND owner=?").bind('banner-file:'+key,u.userId)]);await env.BUCKET!.delete(key)}return json({ok:true})}

export async function GET(){const u=await getSproutUser();if(!u)return json({error:'Sign in to manage your banner.'},401);const row:any=await env.DB!.prepare("SELECT data FROM records WHERE owner=? AND kind='banner' LIMIT 1").bind(u.userId).first();return json({src:row?JSON.parse(row.data).src:null})}
