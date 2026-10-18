import {sameOrigin,readJsonObject,inputError} from '../../../lib/request-security';
import {env} from 'cloudflare:workers';
import {getSproutUser} from '../../../lib/sprout-auth';
import {isModerator} from '../../../lib/moderation';
import {defaultModSettings} from '../../../lib/mod-controls';
export const dynamic='force-dynamic';
const MEDIA='track';
const json=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
const rowData=(r:any)=>({...r,data:JSON.parse(r.data)});
const put=(id:string,kind:string,data:unknown)=>env.DB!.prepare('INSERT INTO records(id,owner,kind,data,created) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,created=excluded.created').bind(id,'__moderation__',kind,JSON.stringify(data),Date.now());
export async function GET(){
 const user=await getSproutUser();if(!isModerator(user))return json({error:'Moderator access required.'},403);
 const [content,audit,restrictions,settings]=await Promise.all([
 env.DB!.prepare("SELECT * FROM records WHERE kind IN (?,'comment','profile','report') AND (kind!=? OR COALESCE(json_extract(data,'$.status'),'published')!='draft') ORDER BY created DESC LIMIT 1000").bind(MEDIA,MEDIA).all(),
 env.DB!.prepare("SELECT * FROM records WHERE kind='mod-audit' ORDER BY created DESC LIMIT 200").all(),
 env.DB!.prepare("SELECT * FROM records WHERE kind IN ('mod-restriction','mod-warning','mod-note') ORDER BY created DESC LIMIT 1000").all(),
 env.DB!.prepare("SELECT data FROM records WHERE id='mod-settings:site'").first()]);
 return json({records:content.results.map(rowData),audit:audit.results.map(rowData),privateRecords:restrictions.results.map(rowData),settings:settings?{...defaultModSettings,...JSON.parse((settings as any).data)}:defaultModSettings,moderatorId:user!.userId,recordLimit:1000});
}
export async function POST(req:Request){
 const user=await getSproutUser();if(!isModerator(user))return json({error:'Moderator access required.'},403);
 if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 let b:any;try{b=await readJsonObject(req)}catch(e){return inputError(e)}
 if(!b||JSON.stringify(b).length>20000)return json({error:'Request too large'},400);
 // Keep the original remove/restore API compatible with existing clients.
 const action=b.action||(b.status==='published'?'restore':b.status==='rejected'?'remove':b.status==='resolved'?'resolve':'');
 const reason=typeof b.reason==='string'?b.reason.trim():'';
 if(reason.length>1000)return json({error:'Reason is limited to 1,000 characters.'},400);
 const updates:any[]=[];let ids:string[]=[];let target:string|undefined;
 const contentActions=['remove','restore','lock-comments','unlock-comments','resolve','reopen','dismiss','priority','claim','note'];
 if(contentActions.includes(action)){
 const submitted=b.ids??(b.id?[b.id]:[]);
 if(!Array.isArray(submitted)||submitted.length<1||submitted.length>50||submitted.some((x:any)=>typeof x!=='string'||x.length>400))return json({error:'Select between 1 and 50 records.'},400);
 ids=[...new Set<string>(submitted)];
 const found=await Promise.all(ids.map(id=>env.DB!.prepare("SELECT * FROM records WHERE id=? AND kind IN (?,'comment','profile','report')").bind(id,MEDIA).first()));
 if(found.some(r=>!r))return json({error:'A selected record no longer exists. Nothing was changed.'},404);
 if(['remove','restore'].includes(action)&&found.some((r:any)=>r.kind==='report'))return json({error:'Use report actions for reports.'},400);
 if(action==='remove'&&!reason)return json({error:'A removal reason is required.'},400);
 if(found.some((r:any)=>r.kind===MEDIA&&JSON.parse(r.data).status==='draft'))return json({error:'Creators control their private drafts.'},409);
 if(['lock-comments','unlock-comments'].includes(action)&&found.some((r:any)=>r.kind!==MEDIA))return json({error:'Comment controls apply only to uploaded media.'},400);
 if(['resolve','reopen','dismiss','priority','claim'].includes(action)&&found.some((r:any)=>r.kind!=='report'))return json({error:'Select reports for this action.'},400);
 if(action==='priority'&&!['low','normal','high','urgent'].includes(b.priority))return json({error:'Choose a valid priority.'},400);
 if(action==='claim'&&typeof b.claim!=='boolean')return json({error:'Invalid claim action'},400);
 if(action==='note'&&(!reason||ids.length!==1))return json({error:'Write a note for one case.'},400);
 for(const raw of found){const row=raw as any;const data=JSON.parse(row.data);
 if(action==='remove'){data.status='rejected';data.moderationReason=reason;data.reviewed=Date.now()}
 if(action==='restore'){data.status='published';data.moderationReason='';data.reviewed=Date.now()}
 if(action==='lock-comments')data.moderationCommentsLocked=true;
 if(action==='unlock-comments')data.moderationCommentsLocked=false;
 if(['resolve','reopen','dismiss'].includes(action)){data.status=action==='reopen'?'pending':action==='dismiss'?'dismissed':'resolved';data.resolution=reason}
 if(action==='priority')data.priority=b.priority;
 if(action==='claim'){if(data.assignedTo&&data.assignedTo!==user!.userId)return json({error:'Another moderator has claimed this report.'},409);data.assignedTo=b.claim?user!.userId:''}
 if(action==='note')updates.push(put('mod-note:'+crypto.randomUUID(),'mod-note',{case:row.id,text:reason,actor:user!.userId}));
 else{const fields=action==='remove'||action==='restore'?['status','moderationReason','reviewed']:action==='lock-comments'||action==='unlock-comments'?['moderationCommentsLocked']:action==='priority'?['priority']:action==='claim'?['assignedTo']:['status','resolution'];const patch=Object.fromEntries(fields.map(f=>[f,data[f]]));updates.push(env.DB!.prepare('UPDATE records SET data=json_patch(data,?) WHERE id=?').bind(JSON.stringify(patch),row.id))}
 }
 }else if(['warn','restrict','lift','remove-creator'].includes(action)){
 if(typeof b.target!=='string'||!b.target.trim()||b.target.length>200)return json({error:'Select a creator.'},400);target=b.target;
 const creator=await env.DB!.prepare("SELECT id FROM records WHERE owner=? AND kind IN (?,'comment','profile') LIMIT 1").bind(target,MEDIA).first();if(!creator)return json({error:'Creator not found.'},404);
 if(action!=='lift'&&!reason)return json({error:'Add a reason before acting on a creator.'},400);
 if(['restrict','remove-creator'].includes(action)&&target===user!.userId)return json({error:'You cannot apply this restriction to your own moderator account.'},400);
 if(action==='warn')updates.push(put('mod-warning:'+crypto.randomUUID(),'mod-warning',{target,text:reason,actor:user!.userId}));
 if(action==='restrict'){
 if(!['uploads','comments','profiles'].includes(b.feature)||![1,24,168,720].includes(b.hours))return json({error:'Choose a restriction and duration.'},400);
 const old:any=await env.DB!.prepare("SELECT data FROM records WHERE id=? AND kind='mod-restriction'").bind('mod-restriction:'+target).first();const data=old?JSON.parse(old.data):{target};data[b.feature+'Until']=Date.now()+b.hours*3600000;data.reason=reason;updates.push(put('mod-restriction:'+target,'mod-restriction',data));
 }
 if(action==='lift')updates.push(env.DB!.prepare("DELETE FROM records WHERE id=? AND kind='mod-restriction'").bind('mod-restriction:'+target));
 if(action==='remove-creator'){
 if(b.confirm!=='REMOVE')return json({error:'Type REMOVE to remove this creator’s published content.'},400);
 updates.push(env.DB!.prepare("UPDATE records SET data=json_set(data,'$.status','rejected','$.moderationReason',?,'$.reviewed',?) WHERE owner=? AND kind IN (?,'comment','profile') AND json_extract(data,'$.status')='published' AND COALESCE(json_extract(data,'$.visibility'),'public')!='private'").bind(reason,Date.now(),target,MEDIA));
 }
 }else if(action==='settings'){
 if(typeof b.uploadsPaused!=='boolean'||typeof b.commentsPaused!=='boolean')return json({error:'Invalid publishing controls'},400);
 updates.push(put('mod-settings:site','mod-settings',{uploadsPaused:b.uploadsPaused,commentsPaused:b.commentsPaused}));
 }else return json({error:'Unknown moderation action'},400);
 updates.push(put('mod-audit:'+crypto.randomUUID(),'mod-audit',{action,actor:user!.userId,ids,target:target||'',reason,priority:action==='priority'?b.priority:undefined,feature:action==='restrict'?b.feature:undefined,hours:action==='restrict'?b.hours:undefined,uploadsPaused:action==='settings'?b.uploadsPaused:undefined,commentsPaused:action==='settings'?b.commentsPaused:undefined}));
 await env.DB!.batch(updates);return json({ok:true});
}
