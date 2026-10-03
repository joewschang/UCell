import {createHash} from 'node:crypto';

export class LineRichMenuError extends Error {
 constructor(public readonly status:number){super(`LINE_RICH_MENU_HTTP_${status}`);}
}
export interface RichMenuTransport {
 ready():Promise<void>;
 getUserMenu(userId:string):Promise<string|null>;
 link(userId:string,menuId:string):Promise<void>;
 unlink(userId:string):Promise<void>;
}
const userPattern=/^U[0-9a-f]{32}$/;
const menuPattern=/^richmenu-[0-9a-f]{32}$/;
export class LineRichMenuClient implements RichMenuTransport {
 private readyUntil=0;
 constructor(private readonly config:{token:string;basicId:string;defaultMenuId:string;memberMenuId:string},private readonly request:typeof fetch=fetch){}
 private async call(path:string,method='GET',image=false){
  let response:Response;
  try{response=await this.request(`https://${image?'api-data':'api'}.line.me/v2/bot${path}`,{method,headers:{Authorization:`Bearer ${this.config.token}`},signal:AbortSignal.timeout(5000)});}
  catch{throw new LineRichMenuError(0);}
  if(!response.ok){await response.body?.cancel();throw new LineRichMenuError(response.status);}
  if(image){await response.body?.cancel();return {};}
  try{return await response.json();}catch{throw new LineRichMenuError(502);}
 }
 /** Establish and read back the global fallback before any per-user mutation. */
 async ready(){
  if(Date.now()<this.readyUntil)return;
  const c=this.config;
  if(!c.token||!c.basicId||!menuPattern.test(c.defaultMenuId)||!menuPattern.test(c.memberMenuId))throw new LineRichMenuError(503);
  const bot=await this.call('/info');if(bot.basicId!==c.basicId)throw new LineRichMenuError(409);
  await this.call(`/richmenu/${c.defaultMenuId}`);await this.call(`/richmenu/${c.defaultMenuId}/content`,'GET',true);
  let current:string|null=null;
  try{current=(await this.call('/user/all/richmenu')).richMenuId;}catch(e){if(!(e instanceof LineRichMenuError)||e.status!==404)throw e;}
  if(current!==c.defaultMenuId){await this.call(`/user/all/richmenu/${c.defaultMenuId}`,'POST');if((await this.call('/user/all/richmenu')).richMenuId!==c.defaultMenuId)throw new LineRichMenuError(502);}
  this.readyUntil=Date.now()+60000;
 }
 async getUserMenu(userId:string){
  if(!userPattern.test(userId))throw new LineRichMenuError(400);
  try{const id=(await this.call(`/user/${userId}/richmenu`)).richMenuId;if(!menuPattern.test(id??''))throw new LineRichMenuError(502);return id as string;}catch(e){if(e instanceof LineRichMenuError&&e.status===404)return null;throw e;}
 }
 async link(userId:string,menuId:string){
  if(!userPattern.test(userId)||!menuPattern.test(menuId))throw new LineRichMenuError(400);
  // Do not replace a working menu with a menu lacking uploaded artwork.
  await this.call(`/richmenu/${menuId}`);await this.call(`/richmenu/${menuId}/content`,'GET',true);
  await this.call(`/user/${userId}/richmenu/${menuId}`,'POST');
 }
 async unlink(userId:string){if(!userPattern.test(userId))throw new LineRichMenuError(400);await this.call(`/user/${userId}/richmenu`,'DELETE');}
}

type Binding={identityLinkId:string;providerSubject:string;status:string;person:{status:string;securityStatus:string}};
type KnownDb={identityLink:{findMany(args:any):Promise<Binding[]>};lineMessagingEvent:{findFirst(args:any):Promise<{eventType:string}|null>}};
export type RichMenuOutcome='UNCHANGED'|'LINKED'|'REPLACED'|'DEFAULT'|'FALLBACK'|'BLOCKED'|'SKIPPED';
/** This is presentation maintenance only: no identity, membership or monetary changes. */
export class LineRichMenuReconciler {
 private cursor:string|undefined;
 constructor(private readonly db:KnownDb,private readonly client:RichMenuTransport,private readonly memberMenuId:string){}
 async reconcile(binding:Binding):Promise<RichMenuOutcome>{
  if(!userPattern.test(binding.providerSubject))return 'SKIPPED';
  await this.client.ready();
  const hash=createHash('sha256').update(binding.providerSubject).digest('hex');
  const friend=await this.db.lineMessagingEvent.findFirst({where:{sourceSubjectHash:hash,eventType:{in:['follow','unfollow']}},orderBy:[{occurredAt:'desc'},{createdAt:'desc'}],select:{eventType:true}});
  // LINE sends follow on unblock. Do not attempt to link blocked friends.
  if(friend?.eventType==='unfollow')return 'BLOCKED';
  const eligible=binding.status==='ACTIVE'&&binding.person.status==='EFFECTIVE'&&binding.person.securityStatus==='NORMAL';
  const current=await this.client.getUserMenu(binding.providerSubject);
  if(!eligible){if(current)await this.client.unlink(binding.providerSubject);return 'DEFAULT';}
  if(current===this.memberMenuId)return 'UNCHANGED';
  try{await this.client.link(binding.providerSubject,this.memberMenuId);}
  catch(error){
   // A missing replacement must never leave an obsolete per-user menu masking
   // the verified default. Transient failures keep any working current menu.
   if(error instanceof LineRichMenuError&&error.status===404){if(current)await this.client.unlink(binding.providerSubject);return 'FALLBACK';}
   throw error;
  }
  if(await this.client.getUserMenu(binding.providerSubject)!==this.memberMenuId)throw new LineRichMenuError(502);
  return current?'REPLACED':'LINKED';
 }
 /** Bounded cursor scans include old friends/bindings with no follow event. */
 async batch(){
  await this.client.ready();
  const bindings=await this.db.identityLink.findMany({where:{provider:'LINE'},orderBy:{identityLinkId:'asc'},take:20,...(this.cursor?{cursor:{identityLinkId:this.cursor},skip:1}:{}),select:{identityLinkId:true,providerSubject:true,status:true,person:{select:{status:true,securityStatus:true}}}});
  const counts:Record<string,number>={checked:0,failures:0};
  const started=Date.now();let visited=0;
  for(const binding of bindings){
   if(visited&&Date.now()-started>=25000)break;
   try{const result=await this.reconcile(binding);counts[result]=(counts[result]??0)+1;counts.checked++;}catch{counts.failures++;}
   visited++;this.cursor=binding.identityLinkId;
  }
  if(visited===bindings.length&&bindings.length<20)this.cursor=undefined;
  return {...counts,scanComplete:!this.cursor};
 }
}
