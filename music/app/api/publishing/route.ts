import {sameOrigin} from '../../../lib/request-security';
import {env} from 'cloudflare:workers';
import {getSproutUser} from '../../../lib/sprout-auth';
import {isModerator} from '../../../lib/moderation';
export async function POST(req:Request){
 const user=await getSproutUser();if(!isModerator(user))return new Response('Forbidden',{status:403});
 if(!sameOrigin(req))return new Response('Forbidden',{status:403});
 await env.DB!.prepare("UPDATE records SET data=json_set(data,'$.status','published','$.moderationReason','') WHERE kind IN ('track','comment','profile') AND json_extract(data,'$.status')='pending'").run();
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
