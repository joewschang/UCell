import {ConflictException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {PrismaService,PiiCryptoService} from '@ucell/database';
import {createHash} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
export type FulfillmentDeliveryInput={expectedVersion:number;recipientName:string;phone:string;countryCode:string;postalCode?:string;address:string};
export type ProtectedFulfillmentDelivery=Omit<FulfillmentDeliveryInput,'expectedVersion'>&{schemaVersion:1;shippingMethod:'HOME_DELIVERY'};
type Context={actorId:string;requestId:string;correlationId:string};

@Injectable()
export class FulfillmentDeliveryService{
 constructor(private readonly db:PrismaService,private readonly audit:AuditService,private readonly pii:PiiCryptoService){}
 async capture(fulfillmentId:string,input:FulfillmentDeliveryInput,context:Context){
  if(!input||!Number.isInteger(input.expectedVersion)||input.expectedVersion<0||input.expectedVersion>2147483646)throw new UnprocessableEntityException({code:'DELIVERY_SNAPSHOT_VERSION_REQUIRED'});
  if(!input||typeof input.recipientName!=='string'||!input.recipientName.trim()||input.recipientName.length>80||typeof input.phone!=='string'||!/^(?=.*[0-9])\+?[0-9 ()-]{6,32}$/.test(input.phone)||typeof input.countryCode!=='string'||!/^[A-Z]{2}$/.test(input.countryCode)||typeof input.address!=='string'||input.address.trim().length<5||input.address.length>500||input.postalCode!==undefined&&(typeof input.postalCode!=='string'||input.postalCode.length>16))throw new UnprocessableEntityException({code:'DELIVERY_SNAPSHOT_INVALID'});
  const payload:ProtectedFulfillmentDelivery={schemaVersion:1,shippingMethod:'HOME_DELIVERY',recipientName:input.recipientName.trim(),phone:input.phone.trim(),countryCode:input.countryCode,postalCode:input.postalCode?.trim()??'',address:input.address.trim()};
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT fulfillment_id FROM commerce.fulfillment WHERE fulfillment_id=${fulfillmentId}::uuid FOR UPDATE`;
   const f=await tx.fulfillment.findUnique({where:{fulfillmentId},include:{deliverySnapshots:{orderBy:{version:'desc'},take:1},shipments:{select:{shipmentId:true}},erpHandoffs:{include:{dispatch:true}}}});
   if(!f)throw new ConflictException({code:'FULFILLMENT_NOT_FOUND'});
   const previous=f.deliverySnapshots[0];
   const priorCommand=await tx.fulfillmentDeliverySnapshot.findUnique({where:{fulfillmentId_version:{fulfillmentId,version:input.expectedVersion+1}}});
   if(priorCommand&&JSON.stringify(this.pii.decrypt(priorCommand.encryptedPayload,priorCommand.keyVersion))===JSON.stringify(payload))return {version:priorCommand.version,currentVersion:previous?.version??priorCommand.version,shippingMethod:priorCommand.shippingMethod,snapshotHash:priorCommand.snapshotHash,replayed:true};
   if(input.expectedVersion!==(previous?.version??0))throw new ConflictException({code:'DELIVERY_SNAPSHOT_VERSION_CONFLICT'});
   if(previous&&JSON.stringify(this.pii.decrypt(previous.encryptedPayload,previous.keyVersion))===JSON.stringify(payload))return {version:previous.version,currentVersion:previous.version,shippingMethod:previous.shippingMethod,snapshotHash:previous.snapshotHash,replayed:true};
   if(['SHIPPING_REQUESTED','SHIPPED','DELIVERED','CANCELLED','EXCEPTION'].includes(f.status)||f.shipments.length||f.erpHandoffs.some(h=>h.dispatch))throw new ConflictException({code:'DELIVERY_SNAPSHOT_ALREADY_COMMITTED'});
   const encrypted=this.pii.encrypt(payload),snapshotHash=createHash('sha256').update(encrypted.ciphertext).digest('hex');
   const snapshot=await tx.fulfillmentDeliverySnapshot.create({data:{fulfillmentId,version:(previous?.version??0)+1,shippingMethod:'HOME_DELIVERY',encryptedPayload:encrypted.ciphertext,keyVersion:encrypted.keyVersion,snapshotHash,capturedByActor:context.actorId}});
   await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'FULFILLMENT_DELIVERY_CAPTURED',entityType:'FULFILLMENT',entityId:fulfillmentId,afterData:{version:snapshot.version,snapshotHash,source:'EXPLICIT_WAREHOUSE_CAPTURE'},requestId:context.requestId,correlationId:context.correlationId});
   return {version:snapshot.version,currentVersion:snapshot.version,shippingMethod:snapshot.shippingMethod,snapshotHash,replayed:false};
  });
 }
}
