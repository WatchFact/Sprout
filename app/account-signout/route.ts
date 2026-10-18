import {signOutSprout,safeReturn} from '../../lib/sprout-auth';
import {sameOrigin} from '../../lib/request-security';
export function GET(){return new Response('Use the sign-out button.',{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}})}
export async function POST(req:Request){if(!sameOrigin(req))return new Response('Forbidden',{status:403});await signOutSprout();return new Response(null,{status:303,headers:{Location:'/login?return_to='+encodeURIComponent(safeReturn(new URL(req.url).searchParams.get('return_to'))),'Cache-Control':'no-store'}})}
