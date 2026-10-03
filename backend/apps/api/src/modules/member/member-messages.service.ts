import {BadRequestException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {Prisma,PrismaService,MEMBER_MESSAGE_CATEGORIES,memberMessageReference,memberMessageText,safeMemberMessageLink} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {QualificationAccessService} from '../auth/qualification-access.service';
import {AuditService} from '../../common/audit/audit.service';
import {IdempotencyService} from '../../common/idempotency/idempotency.service';
type Query={qualificationId?:string;view?:string;category?:string;take?:number;cursor?:string;asOf?:string};
@Injectable()
export class MemberMessagesService{
 constructor(private readonly db:PrismaService,private readonly audit:AuditService,private readonly idempotency:IdempotencyService){}
 private async audience(tx:Prisma.TransactionClient,personId:string,qualificationId?:string){
  if(!qualificationId)return null;
  if(!/^[a-f0-9-]{36}$/i.test(qualificationId))throw new BadRequestException({code:'MESSAGE_CONTEXT_INVALID'});
  await new QualificationAccessService(tx as any).assertHolder(personId,qualificationId);
  const q=await tx.qualification.findUnique({where:{qualificationId},select:{qualificationNo:true,currentHolderPersonId:true}});if(q?.currentHolderPersonId!==personId)throw new ForbiddenException({code:'MESSAGE_CONTEXT_DENIED'});return q;
 }
 private async resolve(tx:Prisma.TransactionClient,personId:string,reference:string){
  if(!/^MESSAGE-[a-f0-9]{40}$/.test(reference))throw new NotFoundException({code:'MESSAGE_NOT_FOUND'});
  const rows=await tx.$queryRaw<{id:string;createdAt:Date}[]>`SELECT notification_id AS id,created_at AS "createdAt" FROM integration.member_notification WHERE person_id=${personId}::uuid AND 'MESSAGE-' || substr(encode(sha256(convert_to('{"id":"' || notification_id::text || '","kind":"MESSAGE"}','UTF8')),'hex'),1,40)=${reference} LIMIT 2`;
  if(rows.length!==1)throw new NotFoundException({code:'MESSAGE_NOT_FOUND'});return rows[0];
 }
 async list(personId:string,input:Query){
  const take=input.take??25,asOf=input.asOf?new Date(input.asOf):new Date(),view=input.view??'ACTIVE';
  if(!Number.isInteger(take)||take<1||take>100||!Number.isFinite(asOf.getTime())||!['ACTIVE','ARCHIVED'].includes(view)||input.category&&!MEMBER_MESSAGE_CATEGORIES.includes(input.category))throw new BadRequestException({code:'MESSAGE_QUERY_INVALID'});
  return this.db.$transaction(async tx=>{
   const q=await this.audience(tx,personId,input.qualificationId),now=new Date(),cursor=input.cursor?await this.resolve(tx,personId,input.cursor):null;
   const archived:Prisma.MemberNotificationWhereInput={OR:[{archives:{some:{personId}}},{retiredAt:{lte:now}},{expiresAt:{lte:now}}]};
   const active:Prisma.MemberNotificationWhereInput={archives:{none:{personId}},AND:[{OR:[{retiredAt:null},{retiredAt:{gt:now}}]},{OR:[{expiresAt:null},{expiresAt:{gt:now}}]}]};
   const rows=await tx.memberNotification.findMany({where:{personId,publishedAt:{lte:now},createdAt:{lte:asOf},...(input.category?{category:input.category}:{}),AND:[{OR:[{qualificationId:null},{qualificationId:input.qualificationId??null}]},view==='ARCHIVED'?archived:active,...(cursor?[{OR:[{createdAt:{lt:cursor.createdAt}},{createdAt:cursor.createdAt,notificationId:{lt:cursor.id}}]}]:[])]},include:{reads:{where:{personId}},archives:{where:{personId}}},orderBy:[{createdAt:'desc'},{notificationId:'desc'}],take:take+1});
   const items=rows.slice(0,take).map(row=>({reference:memberMessageReference(row.notificationId),qualificationNo:row.qualificationId?q!.qualificationNo.toString():null,category:MEMBER_MESSAGE_CATEGORIES.includes(row.category)?row.category:'SERVICE',title:memberMessageText(row.title),content:memberMessageText(row.body),createdAt:row.createdAt.toISOString(),publishedAt:row.publishedAt.toISOString(),expiresAt:row.expiresAt?.toISOString()??null,readAt:row.reads[0]?.readAt.toISOString()??null,archivedAt:row.archives[0]?.archivedAt.toISOString()??null,status:row.expiresAt&&row.expiresAt<=now?'EXPIRED':row.retiredAt&&row.retiredAt<=now?'RETIRED':row.archives.length?'ARCHIVED':'PUBLISHED',sourceReference:row.sourceReference&&memberMessageText(row.sourceReference)===row.sourceReference?row.sourceReference:memberMessageReference(row.notificationId),deepLink:view==='ACTIVE'?safeMemberMessageLink(row.deepLink):null}));
   return {items,nextCursor:rows.length>take?items.at(-1)!.reference:null,asOf:asOf.toISOString(),dataThrough:now.toISOString(),view,channel:'UCELL_PERSONAL'};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
 }
 async command(personId:string,reference:string,qualificationId:string|undefined,action:'READ'|'ARCHIVE',key:string,requestId:string){
  // Recheck authorization before even replaying a committed command result.
  await this.db.$transaction(tx=>this.audience(tx,personId,qualificationId));
  for(let attempt=0;;attempt++)try{return (await this.idempotency.execute('member:message:'+personId,key,{reference,qualificationId:qualificationId??null,action},async tx=>{
   await this.audience(tx,personId,qualificationId);const found=await this.resolve(tx,personId,reference);
   await tx.$queryRaw`SELECT notification_id FROM integration.member_notification WHERE notification_id=${found.id}::uuid FOR UPDATE`;
   const row=await tx.memberNotification.findFirst({where:{notificationId:found.id,personId,publishedAt:{lte:new Date()},OR:[{qualificationId:null},{qualificationId:qualificationId??null}]}});if(!row)throw new NotFoundException({code:'MESSAGE_NOT_FOUND'});
   const where={notificationId_personId:{notificationId:found.id,personId}},existing=action==='READ'?await tx.memberNotificationRead.findUnique({where}):await tx.memberNotificationArchive.findUnique({where});
   const receipt=existing??(action==='READ'?await tx.memberNotificationRead.create({data:{notificationId:found.id,personId}}):await tx.memberNotificationArchive.create({data:{notificationId:found.id,personId}}));
   if(!existing)await this.audit.write(tx,{actorType:'MEMBER',actorId:personId,action:action==='READ'?'MEMBER_MESSAGE_READ':'MEMBER_MESSAGE_ARCHIVED',entityType:'MemberNotification',entityId:found.id,afterData:{reference},requestId,correlationId:randomUUID()});
   return {reference,action,recordedAt:('readAt' in receipt?receipt.readAt:receipt.archivedAt).toISOString()};
  })).value;}catch(error){if(attempt<3&&error instanceof Prisma.PrismaClientKnownRequestError&&['P2034','P2002'].includes(error.code))continue;throw error;}
 }
}
