import {env} from 'cloudflare:workers';
import {notFound,redirect} from 'next/navigation';
import App from '../../page';
import {getSproutUser,getSproutPrincipal} from '../../../lib/sprout-auth';
export const dynamic='force-dynamic';
export default async function Channel({params}:{params:Promise<{id:string}>}){const p=await params;const value=p.id;if(!value||value.length>200)notFound();const row:any=await env.DB!.prepare("SELECT owner FROM records WHERE owner=? AND kind IN ('profile','track') AND json_extract(data,'$.status')='published' AND COALESCE(json_extract(data,'$.visibility'),'public')!='private' LIMIT 1").bind(value).first();const user=await getSproutUser();if(!row&&user?.userId!==value){if((await getSproutPrincipal())?.userId===value)redirect('/accounts');notFound();}return <App initialArtist={row?.owner||value}/>}
