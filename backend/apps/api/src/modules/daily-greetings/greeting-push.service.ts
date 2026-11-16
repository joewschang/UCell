import {BadRequestException,ConflictException,Injectable,ServiceUnavailableException} from '@nestjs/common';
import {PrismaService} from '@ucell/database';
import {AuditService} from '../../common/audit/audit.service';
import {createHash} from 'node:crypto';
import {cloudDate} from './cloud-greeting-policy';
import {renderPushedGreeting} from './cloud-greeting-render';
import {publishAutomaticGreeting} from './greeting-automatic-publication';
export interface GreetingPush {date:string;title:string;message:string;contentBase64:string;}
export function validateGreetingPush(body:unknown,key:string):GreetingPush{
 const fail=()=>{throw new BadRequestException({code:'GREETING_PUSH_INVALID'});};
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key??''))fail();
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='contentBase64,date,message,title')fail();
 const b=body as GreetingPush;
 if(typeof b.date!=='string'||typeof b.title!=='string'||typeof b.message!=='string'||typeof b.contentBase64!=='string')fail();
 cloudDate(b.date);
 // Plain short copy only; no controls, links, markup or hidden direction changes.
 for(const [text,max] of [[b.title,8],[b.message,60]] as const)if(!text.trim()||text!==text.trim()||Array.from(text).length>max||/[<>\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2060-\u206f]|https?:|www\./i.test(text))fail();
 if(b.contentBase64.length%4!==0||b.contentBase64.length<60||b.contentBase64.length>10_666_668||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.contentBase64))fail();
 return b;
}
@Injectable()
export class GreetingPushService {
 constructor(private db:PrismaService,private audit:AuditService){}
 async publish(body:unknown,key:string,actor:string){
  if(process.env.GREETING_PUSH_ENABLED!=='true'||process.env.DAILY_GREETING_PUBLISHING_ENABLED!=='true')throw new ServiceUnavailableException({code:'GREETING_PUSH_NOT_CONFIGURED'});
  if(!/^SYSTEM:greeting-machine:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actor??''))throw new BadRequestException({code:'GREETING_PUSH_ACTOR_REQUIRED'});
  const b=validateGreetingPush(body,key),background=Buffer.from(b.contentBase64,'base64');
  const requestHash=createHash('sha256').update(JSON.stringify([b.date,b.title,b.message,createHash('sha256').update(background).digest('hex')])).digest('hex');
  const previous=await this.db.$queryRaw<any[]>`SELECT g.*,p.status AS publication_status FROM learning.daily_greeting_generation g LEFT JOIN learning.daily_greeting_publication p ON p.id=g.publication_id WHERE g.request_id=${key}::uuid`;
  if(previous.length){const p=previous[0];if(p.request_hash!==requestHash||p.actor_subject!==actor||p.publication_status!=='PUBLISHED')throw new ConflictException({code:'GREETING_IDEMPOTENCY_CONFLICT'});return {date:b.date,id:p.publication_id,status:'ALREADY_PUBLISHED'};}
  const rendered=await renderPushedGreeting(background,b.date,b.title);cloudDate(b.date);
  try{return await publishAutomaticGreeting(this.db,this.audit,{date:b.date,title:b.title,message:b.message,png:rendered.image,backgroundHash:rendered.backgroundHash,actor,policy:'dot-photo-push-v1',owner:key,requestHash,provenance:{source:'DOT_EXTERNAL_PNG',requestHash}});}
  catch(error){if(error instanceof ConflictException)throw error;throw new ServiceUnavailableException({code:'GREETING_PUSH_UNAVAILABLE'});}
 }
}
