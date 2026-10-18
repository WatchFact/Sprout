'use client';
import {siteFetch as fetch} from '../lib/client-fetch';
import {useEffect,useRef,useState} from 'react';
import {ShieldCheck,ArrowLeft,Eye,Copy,Download,Check} from './md2-icons';
type Mode='login'|'register'|'recover';
export default function SproutLogin({mode='login'}:{mode?:Mode}){
 const [choices,setChoices]=useState<{id:string;name:string}[]>([]),[displayName,setDisplayName]=useState(''),[password,setPassword]=useState(''),[email,setEmail]=useState(''),[recovery,setRecovery]=useState(''),[key,setKey]=useState(''),[target,setTarget]=useState('/'),[error,setError]=useState(''),[fieldErrors,setFieldErrors]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[show,setShow]=useState(false),[viewingOnly,setViewingOnly]=useState(false),[existing,setExisting]=useState(''),[available,setAvailable]=useState(true),[settingsReady,setSettingsReady]=useState(false),[settingsError,setSettingsError]=useState(false),[copied,setCopied]=useState(false),[saved,setSaved]=useState(false);
 const form=useRef<HTMLFormElement>(null),notice=useRef<HTMLDivElement>(null);
 async function loadSettings(){setSettingsError(false);try{const r=await fetch('/api/auth');if(!r.ok)throw Error();const d:any=await r.json();setExisting(d.username||'');setAvailable(d.available===true);setSettingsReady(true)}catch{setSettingsError(true)}}
 useEffect(()=>{setTarget(new URLSearchParams(location.search).get('return_to')||'/');loadSettings()},[]);
 useEffect(()=>{if(error)notice.current?.focus()},[error]);
 function update(field:string,fn:()=>void){fn();setChoices([]);setFieldErrors(old=>({...old,[field]:''}));setError('')}
 function focusField(field:string){requestAnimationFrame(()=>form.current?.querySelector<HTMLInputElement>('[name="'+field+'"]')?.focus())}
 async function submit(e?:React.FormEvent,accountId?:string){
  e?.preventDefault();if(busy||!settingsReady||!available)return;const errors:Record<string,string>={};
  if(mode==='register'&&(!displayName.trim()||displayName.trim().length>80))errors.displayName='Enter a name of 1–80 characters.';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))errors.email='Enter a valid email address.';
  if(!password)errors.password='Enter your password.';else if(mode!=='login'&&(password.length<15||password.length>128))errors.password='Use at least 15 characters. A few words work well.';
  if(mode==='recover'&&!/^[a-f0-9]{64}$/i.test(recovery.trim()))errors.recovery='Enter your 64-character password recovery key.';
  setFieldErrors(errors);setError('');if(Object.keys(errors).length){focusField(Object.keys(errors)[0]);return}
  setBusy(true);try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:mode,displayName:mode==='register'?displayName.trim():undefined,accountId,password:mode==='recover'?undefined:password,newPassword:mode==='recover'?password:undefined,email:email.trim(),recoveryKey:recovery,viewingOnly,returnTo:target})});const d:any=await r.json();if(!r.ok){if(d.field){setFieldErrors({[d.field]:d.error});focusField(d.field);return}throw Error(d.error||'Something went wrong. Please try again.')}if(d.chooseAccount){setChoices(d.accounts);return}if(d.recoveryKey){setKey(d.recoveryKey);setTarget(d.returnTo||'/');setPassword('');setRecovery('');window.scrollTo({top:0,behavior:'smooth'})}else location.assign(d.returnTo||'/')}catch(e:any){setError(e instanceof TypeError?'You’re offline or Sprout couldn’t be reached. Your entries are still here—try again.':e.message)}finally{setBusy(false)}
 }
 function continueToSite(){try{const url=new URL(target,location.origin);location.assign(url.origin===location.origin&&target.startsWith('/')&&!target.startsWith('//')?target:'/')}catch{location.assign('/')}}
 const title=mode==='register'?'Create your account':mode==='recover'?'Reset your password':'Welcome back';
 const hint=(field:string,text?:string)=><span id={'auth-'+field+'-hint'} className={fieldErrors[field]?'auth-field-error':'auth-field-hint'} aria-live="polite">{fieldErrors[field]||text}</span>;
 return <main className="account-settings auth-page">
  <a className="auth-back" href="/"><ArrowLeft size={20}/>Back to Sprout</a>
  <section className="auth-card" aria-labelledby="auth-title">
   <a className="auth-logo" href="/"><img src="/brand/sprout-logo.png" alt=""/>Sprout</a>
   <h1 id="auth-title">{key?'Keep a way back in':title}</h1>
   <p className="auth-intro">{key?'Save this private recovery key before you continue.':mode==='register'?'Watch, share and find your people.':mode==='recover'?'Use the recovery key you saved when you joined.':'Sign in with your Sprout email and password.'}</p>
   {error&&<div className="auth-error" role="alert" tabIndex={-1} ref={notice}>{error}</div>}
   {key?<div className="auth-recovery"><span className="auth-security-icon"><ShieldCheck size={26}/></span><p>You’ll need this if you forget your password. It’s only shown now.</p><code className="account-secret">{key}</code><div className="auth-actions"><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(key);setCopied(true)}catch{setError('Copy the key above manually.')}}}><Copy size={18}/>{copied?'Copied':'Copy key'}</button><button type="button" onClick={()=>{const url=URL.createObjectURL(new Blob(['Sprout email: '+email.trim().toLowerCase()+'\nPassword recovery key: '+key+'\nKeep this private. 2FA recovery codes are separate.\n'],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='sprout-password-recovery.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}><Download size={18}/>Download</button></div><label className="auth-checkbox"><input type="checkbox" checked={saved} onChange={e=>setSaved(e.target.checked)}/><span>I’ve saved my recovery key somewhere safe.</span></label><button className="auth-primary" disabled={!saved} onClick={continueToSite}>Continue to Sprout<Check size={18}/></button><p className="auth-footnote">Keep it outside this browser. If you use two-step verification, keep those recovery codes too.</p></div>:<>
   {existing&&<p className="auth-context">Signed in as <strong>{existing}</strong>. Continuing will switch accounts.</p>}
   <form ref={form} className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
    <fieldset disabled={busy}>
     {mode==='register'&&<label htmlFor="auth-name">Display name<input id="auth-name" name="displayName" autoComplete="nickname" maxLength={80} value={displayName} onChange={e=>update('displayName',()=>setDisplayName(e.target.value))} placeholder="Your name or channel name" aria-invalid={!!fieldErrors.displayName} aria-describedby="auth-displayName-hint"/>{hint('displayName','Spaces and capital letters are welcome. You can change this later.')}</label>}
     <label htmlFor="auth-email">Email address<input id="auth-email" name="email" type="email" autoComplete={mode==='login'?'username':'email'} autoCapitalize="none" spellCheck={false} maxLength={254} value={email} onChange={e=>update('email',()=>setEmail(e.target.value))} placeholder="you@example.com" aria-invalid={!!fieldErrors.email} aria-describedby="auth-email-hint"/>{hint('email')}</label>
     {mode==='recover'&&<label htmlFor="auth-key">Password recovery key<input id="auth-key" name="recovery" autoComplete="off" spellCheck={false} maxLength={64} value={recovery} onChange={e=>update('recovery',()=>setRecovery(e.target.value.trim()))} aria-invalid={!!fieldErrors.recovery} aria-describedby="auth-recovery-hint"/>{hint('recovery')}</label>}
     <label htmlFor="auth-password">{mode==='recover'?'New password':'Password'}<span className="auth-password-wrap"><input id="auth-password" name="password" type={show?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} maxLength={128} value={password} onChange={e=>update('password',()=>setPassword(e.target.value))} aria-invalid={!!fieldErrors.password} aria-describedby="auth-password-hint"/><button className="auth-reveal" type="button" onClick={()=>setShow(!show)} aria-pressed={show} aria-label={show?'Hide password':'Show password'}><Eye size={20}/></button></span>{hint('password',mode==='login'?undefined:'At least 15 characters. Try a memorable phrase.')}</label>
     {mode==='login'&&<a className="auth-forgot" href="/recover">Forgot password?</a>}
     {mode==='register'&&<details className="auth-options"><summary>Channel options <span>Optional</span></summary><label className="auth-checkbox"><input type="checkbox" checked={viewingOnly} onChange={e=>setViewingOnly(e.target.checked)}/><span>Keep my personal profile private.<small>You can create a separate channel for uploading later.</small></span></label></details>}
     {!available&&<p className="auth-error" role="alert">Sign-in is temporarily unavailable. Please come back shortly.</p>}
     {settingsError&&<div className="auth-error" role="alert">Couldn’t connect to Sprout. <button type="button" onClick={loadSettings}>Try again</button></div>}
     <button type="submit" className="auth-primary" disabled={busy||!available||!settingsReady}>{busy?'Please wait…':mode==='register'?'Create account':mode==='recover'?'Reset password':'Sign in'}</button>
     {choices.length>0&&<div className="auth-account-choices" role="group" aria-label="Choose account"><p>Choose the account you want to open:</p>{choices.map(choice=><button type="button" key={choice.id} onClick={()=>submit(undefined,choice.id)}>{choice.name}</button>)}</div>}
    </fieldset>
   </form>
   <nav className="auth-links" aria-label="Account help">{mode==='login'?<p>New here? <a href={'/register?return_to='+encodeURIComponent(target)}>Create an account</a></p>:<p>Already have an account? <a href={'/login?return_to='+encodeURIComponent(target)}>Sign in</a></p>}</nav>
   {mode==='recover'&&<details className="auth-explainer"><summary>Lost your recovery key?</summary><p>If you’re still signed in elsewhere, open Account &amp; security there to create a replacement. Without your password or recovery key, this site cannot reset your password.</p></details>}
   <details className="auth-explainer"><summary>About your Sprout account</summary><p>Your Sprout password is separate from the OpenAI access check for this hosted site. Video and Music currently use separate accounts.</p></details>
  </>}
  </section>
  <footer className="auth-footer"><a href="/privacy">Privacy</a><a href="/community-guidelines">Community guidelines</a><span>No tracking profile. History off by default.</span></footer>
 </main>
}
