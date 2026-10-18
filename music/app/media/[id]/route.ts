import {env} from 'cloudflare:workers';
import {getSproutUser} from '../../../lib/sprout-auth';
import {isModerator} from '../../../lib/moderation';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[a-f0-9-]{36}$/.test(id))return new Response('Not found',{status:404});
 let record:any=await env.DB!.prepare("SELECT owner,data FROM records WHERE kind='track' AND (json_extract(data,'$.media')=? OR json_extract(data,'$.coverKey')=?) LIMIT 1").bind(id,id).first();
 if(!record){const avatar:any=await env.DB!.prepare("SELECT a.owner,a.data,COALESCE(json_extract(p.data,'$.status'),'rejected') AS profileStatus FROM records a LEFT JOIN records p ON p.id='profile:'||a.owner||':main' WHERE a.kind IN ('avatar','banner') AND json_extract(a.data,'$.key')=? LIMIT 1").bind(id).first();if(avatar)record={owner:avatar.owner,data:JSON.stringify({status:avatar.profileStatus})}}
 if(!record)return new Response('Not found',{status:404});
 const data=JSON.parse(record.data);if(data.status!=='published'){const u=await getSproutUser();if(!u||(u.userId!==record.owner&&!isModerator(u)))return new Response('Not found',{status:404})}
 const range=req.headers.get('range');let options: {range:{offset:number;length:number}}|undefined;let size=0;
 if(range){const info=await env.BUCKET!.head(id);if(!info)return new Response('Not found',{status:404});size=info.size;const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2]))return new Response('Invalid range',{status:416,headers:{'Content-Range':`bytes */${size}`}});const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));const end=match[1]&&match[2]?Math.min(Number(match[2]),size-1):size-1;if(start>=size||end<start)return new Response('Invalid range',{status:416,headers:{'Content-Range':`bytes */${size}`}});options={range:{offset:start,length:end-start+1}}}
 const obj=await env.BUCKET!.get(id,options);if(!obj)return new Response('Not found',{status:404});const headers=new Headers();obj.writeHttpMetadata(headers);headers.set('ETag',obj.httpEtag);headers.set('X-Content-Type-Options','nosniff');headers.set('Accept-Ranges','bytes');headers.set('Cache-Control','private, no-store');
 if(options){const {offset,length}=options.range;headers.set('Content-Range',`bytes ${offset}-${offset+length-1}/${size}`);headers.set('Content-Length',String(length));return new Response(obj.body,{status:206,headers})}
 headers.set('Content-Length',String(obj.size));return new Response(obj.body,{headers});
}
