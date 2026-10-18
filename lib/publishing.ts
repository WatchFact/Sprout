import {env} from 'cloudflare:workers';
/** Direct publishing keeps deliberate drafts and moderator removals intact. */
export function publicationStatus(previous?:string):'draft'|'rejected'|'published'{return previous==='draft'?'draft':previous==='rejected'?'rejected':'published'}
export function publicationReason(previous?:string,reason?:string){return previous==='draft'?'Draft — not published.':previous==='rejected'?reason||'Removed by a moderator.':''}

/** Apply creator edits against the current row, preserving concurrent moderator decisions. */
export function publicationUpdate(id:string,owner:string,data:unknown,publishDraft=false){return env.DB!.prepare("UPDATE records SET data=json_set(json_patch(data,?),'$.status',CASE WHEN json_extract(data,'$.status')='rejected' THEN 'rejected' WHEN json_extract(data,'$.status')='draft' AND ?=0 THEN 'draft' ELSE 'published' END,'$.moderationReason',CASE WHEN json_extract(data,'$.status')='rejected' THEN COALESCE(json_extract(data,'$.moderationReason'),'Removed by a moderator.') WHEN json_extract(data,'$.status')='draft' AND ?=0 THEN 'Draft — not published.' ELSE '' END,'$.moderationCommentsLocked',json(CASE WHEN json_extract(data,'$.moderationCommentsLocked')=1 THEN 'true' ELSE 'false' END)) WHERE id=? AND owner=?").bind(JSON.stringify(data),publishDraft?1:0,publishDraft?1:0,id,owner)}
