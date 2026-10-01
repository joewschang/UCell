/** Exact frontend origins; deployment supplies Stage/custom origins without credentials. */
export function memberEntryCors(env:Record<string,string|undefined>){
 const configured=env.CORS_ALLOWED_ORIGINS?.trim();
 const origins=configured?.split(',').map(value=>value.trim()).filter(Boolean);
 if(origins?.some(value=>{try{const url=new URL(value);return !['https:','http:'].includes(url.protocol)||url.origin!==value;}catch{return true;}}))throw new Error('CORS_ALLOWED_ORIGINS must contain exact HTTP(S) origins');
 return {origin:origins?.length?origins:env.NODE_ENV==='production'?['https://admin.ucell.life','https://app.ucell.life']:true,
  methods:['GET','HEAD','POST','PATCH','PUT','DELETE'],credentials:true};
}
