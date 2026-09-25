import {ConflictException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {PrismaService} from '@ucell/database';
import {AuditService} from '../../common/audit/audit.service';
import {IdempotencyService} from '../../common/idempotency/idempotency.service';
import {OrderService} from './order.service';

@Injectable()
export class PaperIntakeService {
 constructor(private readonly db:PrismaService,private readonly idempotency:IdempotencyService,private readonly audit:AuditService,private readonly orders:OrderService){}
 async create(input:{paperApplicationNo:string;personId:string;receivedAt:string;evidenceDocumentRef?:string;key:string;actorId:string;requestId:string}){
  const paperApplicationNo=input.paperApplicationNo.trim();
  if(!paperApplicationNo)throw new UnprocessableEntityException({code:'PAPER_APPLICATION_NO_REQUIRED'});
  return this.idempotency.execute(`admin:paper-application:create:${input.personId}`,input.key,{paperApplicationNo,receivedAt:input.receivedAt,evidenceDocumentRef:input.evidenceDocumentRef},async tx=>{
   const person=await tx.person.findUnique({where:{personId:input.personId},select:{personId:true,memberNo:true,status:true}});
   if(!person)throw new ConflictException({code:'PAPER_PERSON_NOT_FOUND'});
   const existing=await tx.paperApplication.findUnique({where:{paperApplicationNo}});
   if(existing){if(existing.personId!==input.personId||existing.receivedAt.getTime()!==new Date(input.receivedAt).getTime()||(existing.evidenceDocumentRef??null)!==(input.evidenceDocumentRef??null))throw new ConflictException({code:'PAPER_APPLICATION_IDENTITY_CONFLICT'});return {paperApplicationId:existing.paperApplicationId,paperApplicationNo:existing.paperApplicationNo,memberNo:person.memberNo,status:existing.status,receivedAt:existing.receivedAt.toISOString()};}
   const application=await tx.paperApplication.create({data:{paperApplicationNo,personId:input.personId,receivedAt:new Date(input.receivedAt),evidenceDocumentRef:input.evidenceDocumentRef,createdBy:input.actorId}});
   await this.audit.write(tx,{actorType:'USER',actorId:input.actorId,action:'PAPER_APPLICATION_CREATED',entityType:'PaperApplication',entityId:application.paperApplicationId,afterData:{paperApplicationNo,memberNo:person.memberNo,receivedAt:application.receivedAt.toISOString(),evidenceDocumentRef:application.evidenceDocumentRef},requestId:input.requestId,correlationId:application.paperApplicationId});
   return {paperApplicationId:application.paperApplicationId,paperApplicationNo:application.paperApplicationNo,memberNo:person.memberNo,status:application.status,receivedAt:application.receivedAt.toISOString()};
  });
 }
 async list(input:{status?:string;take?:number}={}){
  const take=Math.min(Math.max(input.take??50,1),100);
  const rows=await this.db.paperApplication.findMany({where:input.status?{status:input.status}:undefined,include:{person:{select:{memberNo:true}},order:{select:{orderNo:true,status:true,purpose:true,netAmount:true,paidAt:true}}},orderBy:{receivedAt:'desc'},take});
  return rows.map(row=>({paperApplicationNo:row.paperApplicationNo,memberNo:row.person.memberNo,status:row.status,receivedAt:row.receivedAt.toISOString(),evidenceDocumentRef:row.evidenceDocumentRef,order:row.order?{orderNo:row.order.orderNo.toString(),status:row.order.status,purpose:row.order.purpose,total:row.order.netAmount.toString(),paidAt:row.order.paidAt?.toISOString()??null}:null,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()}));
 }
 async createQualificationOrder(input:any){return this.orders.createPaperQualification(input,input.key,input.requestId,input.actorId,input.paperApplicationId);}
}
