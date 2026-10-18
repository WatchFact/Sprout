import {env} from 'cloudflare:workers';
import {notFound} from 'next/navigation';
import App from '../../page';
export const dynamic='force-dynamic';
export default async function Channel({params}:{params:Promise<{handle:string}>}){const p=await params;const value=p.handle;if(!value||value.length>200)notFound();const row:any=await env.DB!.prepare("SELECT h.owner FROM records h JOIN records p ON p.id='profile:'||h.owner||':main' WHERE h.kind='channel-handle' AND h.id=? AND json_extract(p.data,'$.status')='published'").bind('channel-handle:'+value.toLowerCase()).first();if(!row)notFound();return <App initialChannel={row.owner}/>}
