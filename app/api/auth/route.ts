import {sameOrigin,readJsonObject,inputError} from '../../../lib/request-security';
import {env} from 'cloudflare:workers';
import {getHostingUser} from '../../chatgpt-auth';
import {authJson as json,getSproutPrincipal,getSproutUser,newSession,signOutSprout,passwordHash,validUsername,validPassword,normaliseEmail,validEmail,constantEqual,limitAuth,safeReturn} from '../../../lib/sprout-auth';
import {digest,randomHex,secondFactorSatisfied,securityRecord,checkSecondFactorCode,createSecondFactorSession} from '../../../lib/two-factor';
export const dynamic='force-dynamic';
async function importState(hosting:Awaited<ReturnType<typeof getHostingUser>>){
 if(!hosting)return {available:false,requiresTwoFactor:false,channelName:'',brands:0};
 const existing=await env.DB!.prepare("SELECT id FROM records WHERE (id=? AND kind='auth-claim') OR (owner=? AND kind='sprout-account') LIMIT 1").bind('auth-claim:'+hosting.userId,hosting.userId).first();
 if(existing)return {available:false,requiresTwoFactor:false,channelName:'',brands:0};
 const profile:any=await env.DB!.prepare("SELECT data FROM records WHERE owner=? AND kind='profile' LIMIT 1").bind(hosting.userId).first();
 const brands:any=await env.DB!.prepare("SELECT count(*) AS n FROM records WHERE owner=? AND kind='brand'").bind(hosting.userId).first();
 return {available:true,requiresTwoFactor:!!(await securityRecord(hosting.userId))?.enabled,channelName:profile?String(JSON.parse(profile.data).name||hosting.displayName):hosting.displayName,brands:Number(brands?.n||0)};
}
export async function GET(){const principal=await getSproutPrincipal();const legacy=await importState(await getHostingUser());return json({signedIn:!!principal,username:principal?.displayName||null,unlocked:principal?await secondFactorSatisfied(principal.userId):false,canImport:legacy.available,importRequiresTwoFactor:legacy.requiresTwoFactor,importChannelName:legacy.channelName,importBrandCount:legacy.brands,available:!!env.AUTH_PASSWORD_PEPPER})}
export async function POST(req:Request){if(!sameOrigin(req))return json({error:'Invalid origin.'},403);let b:any;try{b=await readJsonObject(req,4096)}catch(e){return inputError(e)}
 if(!b||typeof b!=='object'||Array.isArray(b))return json({error:'Invalid request.'},400);
 if(b.action==='logout'){await signOutSprout();return json({ok:true,returnTo:'/login'})}
 const principal=await getSproutPrincipal();
 if(b.action==='change-password'||b.action==='new-recovery-key'||b.action==='change-email'||b.action==='set-viewing-only'){
 if(!principal||!await getSproutUser())return json({error:'Sign in and unlock your parent account first.'},401);
 if(typeof b.password!=='string'||b.password.length>128)return json({error:'Enter your current password.'},400);
 const hosting=await getHostingUser();if(!await limitAuth(req,normaliseEmail(principal.email),hosting?.userId||''))return json({error:'Too many attempts. Try again in 15 minutes.'},429);
 const row:any=await env.DB!.prepare("SELECT id,data FROM records WHERE owner=? AND kind='sprout-account'").bind(principal.userId).first();const account=JSON.parse(row.data);if(!constantEqual(await passwordHash(b.password,account.salt),account.hash))return json({error:'Incorrect current password.'},400);
 if(b.action==='set-viewing-only'){
 if(typeof b.enabled!=='boolean')return json({error:'Choose a valid viewing mode.'},400);
 if(b.enabled){const content=await env.DB!.prepare("SELECT id FROM records WHERE owner=? AND kind IN ('video','track','comment') LIMIT 1").bind(principal.userId).first();if(content)return json({error:'Your personal channel has uploads or comments. Remove them before making the parent viewing-only.'},409)}
 await env.DB!.batch([env.DB!.prepare("UPDATE records SET data=json_set(data,'$.viewingOnly',json(?)) WHERE id=?").bind(b.enabled?'true':'false',row.id),env.DB!.prepare("UPDATE records SET data=json_set(data,'$.status',?) WHERE owner=? AND kind='profile' AND COALESCE(json_extract(data,'$.status'),'published')!='rejected'").bind(b.enabled?'private':'published',principal.userId)]);return json({ok:true});
 }
 if(b.action==='change-email'){
 const email=normaliseEmail(b.email);if(!validEmail(email))return json({error:'Enter a valid email address.',field:'email'},400);if(email===normaliseEmail(account.email))return json({ok:true});
 const taken=await env.DB!.prepare("SELECT id FROM records WHERE kind='sprout-account' AND lower(trim(json_extract(data,'$.email')))=? AND owner!=? LIMIT 1").bind(email,principal.userId).first();if(taken)return json({error:'That email address is already in use.'},409);
 const reservation='auth-email:'+await digest(email),previous='auth-email:'+await digest(normaliseEmail(account.email));account.email=email;account.version=randomHex(16);
 try{await env.DB!.batch([env.DB!.prepare("INSERT INTO records(id,owner,kind,data,created) VALUES(?,?,'auth-email','{}',?)").bind(reservation,principal.userId,Date.now()),env.DB!.prepare("UPDATE records SET data=CASE WHEN data=? THEN ? ELSE NULL END WHERE id=?").bind(row.data,JSON.stringify(account),row.id),env.DB!.prepare("DELETE FROM records WHERE id=? AND kind='auth-email' AND owner=?").bind(previous,principal.userId),env.DB!.prepare("DELETE FROM records WHERE owner=? AND kind IN ('email-verification','email-challenge','sprout-session','two-factor-session')").bind(principal.userId)])}catch{return json({error:'That email address is already in use. Try another address.'},409)}await newSession(principal.userId,account.version);return json({ok:true});
 }

 let recoveryKey:string|undefined;
 if(b.action==='change-password'){if(!validPassword(b.newPassword))return json({error:'Use 15–128 characters for your password.',field:'password'},400);account.salt=randomHex(16);account.hash=await passwordHash(b.newPassword,account.salt)}else{recoveryKey=randomHex();account.recoveryHash=await digest(principal.userId+recoveryKey)}
 account.version=randomHex(16);try{await env.DB!.batch([env.DB!.prepare("UPDATE records SET data=CASE WHEN data=? THEN ? ELSE NULL END WHERE id=?").bind(row.data,JSON.stringify(account),row.id),env.DB!.prepare("DELETE FROM records WHERE owner=? AND kind IN ('sprout-session','two-factor-session')").bind(principal.userId)])}catch{return json({error:'Your account changed while saving. Reload settings and try again.'},409)}await newSession(principal.userId,account.version);return json({ok:true,recoveryKey,returnTo:'/accounts'});
 }
 if(!['register','login','recover'].includes(b.action))return json({error:'Unknown account action.'},400);
 const email=normaliseEmail(b.email);if(!validEmail(email))return json({error:'Enter a valid email address.',field:'email'},400);
 const hasDisplayName=typeof b.displayName==='string';const displayName=hasDisplayName?b.displayName.trim().normalize('NFC'):'';
 if(b.action==='register'&&hasDisplayName&&(!displayName||displayName.length>80||/[\u0000-\u001f\u007f]/.test(displayName)))return json({error:'Enter a name of 1–80 characters.',field:'displayName'},400);
 const username=hasDisplayName?'channel-'+randomHex(8):typeof b.username==='string'?b.username.trim().toLowerCase():'';
 if(b.action==='register'&&!validUsername(username))return json({error:/^[a-z0-9][a-z0-9_.-]{2,29}$/.test(username)?'That account name is reserved. Choose another name.':'Use 3–30 letters, numbers, dots, underscores or hyphens.',field:'displayName'},400);
 const hosting=await getHostingUser();if(!await limitAuth(req,email,hosting?.userId||''))return json({error:'Too many attempts. Try again in 15 minutes.'},429);
 if(!env.AUTH_PASSWORD_PEPPER)return json({error:'Password sign-in is not configured.'},503);
 const id='sprout-account:'+username;const row:any=b.action==='register'?await env.DB!.prepare("SELECT owner,data FROM records WHERE id=? AND kind='sprout-account'").bind(id).first():null;
 if(b.action==='register'){
 if(!validPassword(b.password))return json({error:'Use 15–128 characters for your password.',field:'password'},400);if(row)return json({error:'That profile name is unavailable.'},409);const emailTaken=await env.DB!.prepare("SELECT id FROM records WHERE kind='sprout-account' AND lower(trim(json_extract(data,'$.email')))=? LIMIT 1").bind(email).first();if(emailTaken)return json({error:'An account already uses this email. Sign in or reset your password.',field:'email'},409);
 const legacy=b.importExisting===true?await importState(hosting):null;const importLegacy=b.importExisting===true;
 if(importLegacy&&!legacy?.available)return json({error:'This hosting session has no unclaimed channel to import. Sign in to its existing Sprout account, or turn off import to create a separate account.'},409);
 let importFactorVersion:string|undefined;
 if(importLegacy&&legacy?.requiresTwoFactor){
 if(typeof b.importCode!=='string'||b.importCode.length>64)return json({error:'Enter the existing channel’s authenticator or 2FA recovery code before importing.'},403);
 const importFactor=await securityRecord(hosting!.userId);
 try{if(!await checkSecondFactorCode(hosting!.userId,b.importCode))return json({error:'Incorrect, expired or already used channel security code.'},403)}catch{return json({error:'The existing channel’s two-factor protection is unavailable. Import cannot continue.'},503)}
 importFactorVersion=importFactor?.version;
 }

 const owner=importLegacy?hosting!.userId:'acct:'+crypto.randomUUID();const salt=randomHex(16),version=randomHex(16),recoveryKey=randomHex();const isModerator=importLegacy&&(env.MODERATOR_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).includes(hosting!.email.toLowerCase());
 if(b.viewingOnly===true&&importLegacy){const content=await env.DB!.prepare("SELECT id FROM records WHERE owner=? AND kind IN ('video','track','comment') LIMIT 1").bind(owner).first();if(content)return json({error:'Your existing personal channel has content. Import it with personal publishing enabled; you can still create brand channels.'},409)}
 const account={viewingOnly:b.viewingOnly===true,username,displayName:hasDisplayName?displayName:username,email,hash:await passwordHash(b.password,salt),salt,version,recoveryHash:await digest(owner+recoveryKey),isModerator,algorithm:'PBKDF2-SHA256-100000+HMAC-SHA256'};const now=Date.now();const statements=[env.DB!.prepare("INSERT INTO records(id,owner,kind,data,created) VALUES(?,?,'auth-email','{}',?)").bind('auth-email:'+await digest(email),owner,now),env.DB!.prepare("INSERT INTO records(id,owner,kind,data,created) VALUES(?,?,'sprout-account',?,?)").bind(id,owner,JSON.stringify(account),now)];if(importLegacy)statements.push(env.DB!.prepare("INSERT INTO records(id,owner,kind,data,created) VALUES(?,?,'auth-claim',?,?)").bind('auth-claim:'+hosting!.userId,owner,JSON.stringify({claimed:true}),now));statements.push(env.DB!.prepare("INSERT OR IGNORE INTO records(id,owner,kind,data,created) VALUES(?,?,'profile',?,?)").bind('profile:'+owner+':main',owner,JSON.stringify({name:hasDisplayName?displayName:username,bio:'',status:b.viewingOnly===true?'private':'published'}),now));
 if(b.viewingOnly===true)statements.push(env.DB!.prepare("UPDATE records SET data=json_set(data,'$.status','private') WHERE owner=? AND kind='profile' AND json_extract(data,'$.status')!='rejected'").bind(owner));
 try{await env.DB!.batch(statements)}catch{return json({error:'That email, profile name or existing channel was just claimed. Try signing in or choosing different details.'},409)}await newSession(owner,version);if(importFactorVersion)await createSecondFactorSession(owner,importFactorVersion);return json({ok:true,recoveryKey,returnTo:await secondFactorSatisfied(owner)?safeReturn(b.returnTo):'/accounts'});
 }
 const candidates=await env.DB!.prepare("SELECT id,owner,data FROM records WHERE kind='sprout-account' AND lower(trim(json_extract(data,'$.email')))=? ORDER BY created,id").bind(email).all();
 if(b.action==='recover'){
 if(!validPassword(b.newPassword)||typeof b.recoveryKey!=='string'||!/^[a-fA-F0-9]{64}$/.test(b.recoveryKey.trim()))return json({error:'Enter your email, recovery key and a new passphrase of 15–128 characters.'},400);
 let recovered:any=null;for(const candidate of candidates.results as any[]){const d=JSON.parse(candidate.data);if(constantEqual(await digest(candidate.owner+b.recoveryKey.trim().toLowerCase()),d.recoveryHash)){recovered=candidate;break}}
 if(!recovered)return json({error:'Incorrect email address or recovery key.'},400);const account=JSON.parse(recovered.data);if(account.suspended===true)return json({error:'This account is suspended. Contact the site owner.'},403);account.salt=randomHex(16);account.hash=await passwordHash(b.newPassword,account.salt);account.version=randomHex(16);const recoveryKey=randomHex();account.recoveryHash=await digest(recovered.owner+recoveryKey);
 const changed=await env.DB!.prepare("UPDATE records SET data=? WHERE id=? AND data=? RETURNING id").bind(JSON.stringify(account),recovered.id,recovered.data).first();if(!changed)return json({error:'This recovery key has already been used. Try the current key.'},400);await env.DB!.prepare("DELETE FROM records WHERE owner=? AND kind IN ('sprout-session','two-factor-session')").bind(recovered.owner).run();await newSession(recovered.owner,account.version);return json({ok:true,recoveryKey,returnTo:'/accounts'});
 }
 if(typeof b.password!=='string'||b.password.length>128)return json({error:'Incorrect email or password.'},400);
 // Existing duplicate-email accounts are kept intact. The password must authenticate
 // a specific account; never guess the first row or merge owners and their media.
 const matches:any[]=[];for(const candidate of candidates.results as any[]){const account=JSON.parse(candidate.data);if(constantEqual(await passwordHash(b.password,account.salt),account.hash))matches.push({row:candidate,account})}
 if(!candidates.results.length)await passwordHash(b.password,'00000000000000000000000000000000');
 if(!matches.length)return json({error:'Incorrect email or password.'},401);
 if(matches.length>1&&!b.accountId)return json({chooseAccount:true,accounts:matches.map(m=>({id:m.row.owner,name:m.account.displayName||m.account.username}))});
 const selected=b.accountId?matches.find(m=>m.row.owner===b.accountId):matches[0];if(!selected)return json({error:'Incorrect email or password.'},401);const {row:chosen,account}=selected;
 if(account.suspended===true)return json({error:'This account is suspended. Contact the site owner.'},403);await newSession(chosen.owner,account.version);return json({ok:true,returnTo:await secondFactorSatisfied(chosen.owner)?safeReturn(b.returnTo):'/accounts'});
}
