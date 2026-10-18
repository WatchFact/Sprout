import {sameOrigin,inputError,boundedUpload} from '../../../lib/request-security';
import {writeRestriction} from '../../../lib/mod-enforcement';
import {publicationStatus,publicationReason,publicationUpdate} from '../../../lib/publishing';
import {env} from 'cloudflare:workers';
import {getSproutUser} from '../../../lib/sprout-auth';
export async function POST(req:Request){
 const user=await getSproutUser();if(!user)return new Response('Unauthorized',{status:401});
 if(!user.canPublish)return Response.json({error:'Your parent account is viewing-only. Switch to a brand channel to upload.'},{status:403});const blocked=await writeRestriction(user,'uploads');if(blocked)return Response.json({error:blocked},{status:403});
 if(!sameOrigin(req))return new Response('Forbidden',{status:403});
 const key=new URL(req.url).searchParams.get('track');const id='track:'+user.userId+':'+key;
 const row:any=await env.DB!.prepare("SELECT data FROM records WHERE id=? AND owner=? AND kind='track'").bind(id,user.userId).first();if(!row)return new Response('Track not found',{status:404});
 const size=Number(req.headers.get('content-length')),type=req.headers.get('content-type')||'';if(!Number.isSafeInteger(size)||size<1||size>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(type))return new Response('Use a JPG, PNG or WebP cover under 2 MB.',{status:400});
 const data=JSON.parse(row.data);const coverKey=crypto.randomUUID();try{await env.BUCKET!.put(coverKey,boundedUpload(req,size,2*1024*1024),{httpMetadata:{contentType:type}});}catch(e){await env.BUCKET!.delete(coverKey);return inputError(e)}
 try{await publicationUpdate(id,user.userId,{...data,coverKey,cover:'/media/'+coverKey,status:publicationStatus(data.status),moderationReason:publicationReason(data.status,data.moderationReason)}).run()}catch(e){await env.BUCKET!.delete(coverKey);throw e}if(data.coverKey)await env.BUCKET!.delete(data.coverKey);
 return Response.json({ok:true});
}
