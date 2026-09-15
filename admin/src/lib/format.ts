export const money=(v:unknown)=>new Intl.NumberFormat('zh-TW',{style:'currency',currency:'TWD',maximumFractionDigits:0}).format(Number(v??0));
export const dateTime=(v?:string|null)=>v?new Intl.DateTimeFormat('zh-TW',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
export const qNo=(v:unknown)=>v===undefined||v===null?'—':String(v);
export const holderName=(q:any)=>q?.currentHolder?.legalName ?? q?.currentHolder?.preferredName ?? '—';
