import {sameOrigin,inputError,boundedUpload} from '../../../lib/request-security';
import {writeRestriction} from '../../../lib/mod-enforcement';
import { env } from 'cloudflare:workers';
import { initialDefaults,licenses } from '../../../lib/studio';
import { categories,normaliseCategory } from '../../../lib/catalog';
import { getSproutUser } from '../../../lib/sprout-auth';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const u=await getSproutUser();if(!u)return Response.json({error:'Sign in to upload.'},{status:401});
 if(!sameOrigin(req))return new Response('Forbidden',{status:403});
 if(!u.canPublish)return Response.json({error:'Your parent account is viewing-only. Switch to a brand channel to upload.'},{status:403});const blocked=await writeRestriction(u,'uploads');if(blocked)return Response.json({error:blocked},{status:403});
 const type=req.headers.get('content-type')||'';const size=Number(req.headers.get('content-length'));
 if(!['video/mp4','video/webm','video/ogg'].includes(type))return Response.json({error:'Use an MP4, WebM or Ogg video.'},{status:400});
 if(!Number.isSafeInteger(size)||size<1||size>95*1024*1024)return Response.json({error:'Videos must be between 1 byte and 95 MB.'},{status:413});
 const url=new URL(req.url);const title=(url.searchParams.get('title')||'').trim().slice(0,150);if(url.searchParams.get('rules')!=='accepted')return Response.json({error:'Accept the community guidelines before uploading.'},{status:400});if(!title)return Response.json({error:'Add a title.'},{status:400});
 const recent:any=await env.DB!.prepare("SELECT count(*) as n FROM records WHERE owner=? AND kind='video' AND created>?").bind(u.userId,Date.now()-3600000).first();if(recent.n>=5)return Response.json({error:'Upload limit reached. Try again in an hour.'},{status:429});
 const id=crypto.randomUUID();const media=id;try{await env.BUCKET!.put(media,boundedUpload(req,size,95*1024*1024),{httpMetadata:{contentType:type}});}catch(e){await env.BUCKET!.delete(media);return inputError(e)}
 const profile:any=await env.DB!.prepare("SELECT data FROM records WHERE owner=? AND kind='profile' LIMIT 1").bind(u.userId).first();
 const pref:any=await env.DB!.prepare("SELECT data FROM records WHERE owner=? AND kind='upload-defaults' LIMIT 1").bind(u.userId).first();const defaults=pref?JSON.parse(pref.data):initialDefaults;
 const parsed=profile?JSON.parse(profile.data):null;const name=parsed?.status==='published'?parsed.name:'Independent creator';
 const data={id,title,description:(url.searchParams.get('description')??defaults.description).slice(0,5000),category:categories.slice(1).includes(normaliseCategory(url.searchParams.get('category')||''))?normaliseCategory(url.searchParams.get('category')||''):normaliseCategory(defaults.category),channel:name,channelId:u.userId,media,src:'/media/'+id,poster:'',duration:(url.searchParams.get('duration')||'New').slice(0,15),views:0,created:Date.now(),uploaded:true,status:url.searchParams.get('mode')==='draft'?'draft':'published',moderationReason:url.searchParams.get('mode')==='draft'?'Draft — not published.':'',visibility:url.searchParams.get('visibility')==='private'?'private':'public',commentsEnabled:url.searchParams.get('commentsEnabled')===null?defaults.commentsEnabled:url.searchParams.get('commentsEnabled')!=='false',license:licenses.includes(url.searchParams.get('license')||'')?url.searchParams.get('license'):defaults.license,tags:[],chapters:[],credits:'',size,mimeType:type,originalName:(url.searchParams.get('filename')||'video').slice(0,160)};
 try{await env.DB!.prepare('INSERT INTO records(id,owner,kind,data,created) VALUES(?,?,?,?,?)').bind('video:'+u.userId+':'+id,u.userId,'video',JSON.stringify(data),Date.now()).run()}catch(e){await env.BUCKET!.delete(media);throw e}
 return Response.json({ok:true,video:data});
}
