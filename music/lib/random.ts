/** Unbiased Fisher–Yates shuffle. No account data or viewing signals are used. */
export function randomBelow(n:number){if(!Number.isSafeInteger(n)||n<1||n>0x100000000)throw Error('Invalid range');const a=new Uint32Array(1);const limit=Math.floor(0x100000000/n)*n;do{crypto.getRandomValues(a)}while(a[0]>=limit);return a[0]%n}
export function shuffled<T>(items:readonly T[]):T[]{const out=[...items];for(let i=out.length-1;i>0;i--){const j=randomBelow(i+1);[out[i],out[j]]=[out[j],out[i]]}return out}
