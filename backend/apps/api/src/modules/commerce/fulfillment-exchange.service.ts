import {ConflictException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {createHash} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {FulfillmentSourceAllocationService} from './fulfillment-source-allocation.service';

type Context={actorId:string;requestId:string;correlationId:string};
export type CreateShipmentExchangeInput={shipmentReference:string;serialNos:string[];reason:string;requestKey:string};
export const shipmentExchangeReference=(id:string)=>createHash('sha256').update(`EXCHANGE:${id}`).digest('hex');
const shipmentReference=(id:string)=>createHash('sha256').update(`SHIPMENT:${id}`).digest('hex');
const include={items:{include:{shipmentBinding:{include:{allocation:{include:{serializedUnit:true,sourceAllocation:true}}}}}},replacementFulfillment:true} satisfies Prisma.ShipmentExchangeCaseInclude;
type Exchange=Prisma.ShipmentExchangeCaseGetPayload<{include:typeof include}>;

export function shipmentExchangeView(row:Exchange){
 return {exchangeReference:shipmentExchangeReference(row.shipmentExchangeCaseId),exchangeNo:row.exchangeNo,status:row.status,reason:row.reason,createdAt:row.createdAt.toISOString(),receivedAt:row.receivedAt?.toISOString()??null,replacementFulfillmentKey:row.replacementFulfillment?.fulfillmentKey??null,replacementStatus:row.replacementFulfillment?.status??null,items:row.items.map(item=>({serialNo:item.shipmentBinding.allocation.serializedUnit.serialNo,sku:item.shipmentBinding.allocation.sourceAllocation.skuSnapshot,receivedAt:item.receivedAt?.toISOString()??null}))};
}

/** A physical exchange grants replacement units, never new order value or commission. */
@Injectable()
export class FulfillmentExchangeService{
 constructor(private readonly db:PrismaService,private readonly audit:AuditService,private readonly allocator:FulfillmentSourceAllocationService){}

 private async transaction<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T>{
  for(let attempt=0;;attempt++){
   try{return await this.db.$transaction(work,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}
   catch(error){
    // A concurrent identical request can lose a unique insert before SSI reports
    // its older snapshot. Retry in a fresh transaction to return the committed case.
    if(['P2034','P2002'].includes((error as {code?:string}).code??'')&&attempt<2)continue;
    if(['P2034','P2002'].includes((error as {code?:string}).code??''))throw new ConflictException({code:'EXCHANGE_CONCURRENT_CONFLICT'});
    throw error;
   }
  }
 }
 private serials(input:string[]){
  if(!Array.isArray(input)||!input.length||input.length>100||input.some(serial=>typeof serial!=='string'||!/^[A-E][0-9]{7}$/.test(serial))||new Set(input).size!==input.length)throw new UnprocessableEntityException({code:'EXCHANGE_SERIAL_INPUT_INVALID'});
  return [...input].sort();
 }
 private async scope(tx:Prisma.TransactionClient,orderNo:string,key:string){
  if(!/^\d{1,19}$/.test(orderNo)||BigInt(orderNo)>9223372036854775807n)throw new UnprocessableEntityException({code:'INVALID_ORDER_NO'});
  await tx.$queryRaw`SELECT order_id FROM commerce."order" WHERE order_no=${BigInt(orderNo)} FOR UPDATE`;
  const order=await tx.order.findUnique({where:{orderNo:BigInt(orderNo)}});
  if(!order)throw new ConflictException({code:'ORDER_NOT_FOUND'});
  const fulfillment=await tx.fulfillment.findFirst({where:{orderId:order.orderId,fulfillmentKey:key}});
  if(!fulfillment)throw new ConflictException({code:'FULFILLMENT_NOT_FOUND'});
  await tx.$queryRaw`SELECT fulfillment_id FROM commerce.fulfillment WHERE fulfillment_id=${fulfillment.fulfillmentId}::uuid FOR UPDATE`;
  return {order,fulfillment};
 }
 private async record(tx:Prisma.TransactionClient,fulfillmentId:string,reference:string){
  const rows=await tx.shipmentExchangeCase.findMany({where:{originalFulfillmentId:fulfillmentId},include});
  const row=rows.find(value=>shipmentExchangeReference(value.shipmentExchangeCaseId)===reference);
  if(!row)throw new ConflictException({code:'EXCHANGE_NOT_FOUND'});
  return row;
 }
 private async economicEligibility(tx:Prisma.TransactionClient,orderId:string,requested:Map<string,number>,excludeCaseId?:string){
  const lineIds=[...requested.keys()];
  const lines=await tx.orderLine.findMany({where:{orderId,orderLineId:{in:lineIds}}});
  const returns=await tx.returnLine.findMany({where:{orderLineId:{in:lineIds},returnCase:{orderId,status:'POSTED'}},include:{serialReceipts:{select:{returnSerialReceiptId:true}}}});
  if(returns.some(line=>line.quantity.gt(line.serialReceipts.length)))throw new ConflictException({code:'EXCHANGE_PENDING_RETURN'});
  const claims=await tx.shipmentExchangeItem.findMany({where:{releasedAt:null,shipmentExchangeCaseId:excludeCaseId?{not:excludeCaseId}:undefined,shipmentBinding:{allocation:{sourceAllocation:{orderLineId:{in:lineIds}}}},exchangeCase:{originalFulfillment:{orderId},OR:[{status:{in:['REQUESTED','RECEIVED']}},{status:'REPLACEMENT_CREATED',replacementFulfillment:{status:{notIn:['SHIPPED','DELIVERED']}}}]}},include:{shipmentBinding:{include:{allocation:{include:{sourceAllocation:true}}}}}});
  for(const line of lines){
   const returned=returns.filter(ret=>ret.orderLineId===line.orderLineId).reduce((sum,ret)=>sum.plus(ret.quantity),new Prisma.Decimal(0));
   if(returned.gte(line.quantity))throw new ConflictException({code:'EXCHANGE_ORDER_LINE_RETURNED'});
   const claimed=claims.filter(item=>item.shipmentBinding.allocation.sourceAllocation.orderLineId===line.orderLineId).length;
   if(returned.plus(claimed).plus(requested.get(line.orderLineId)??0).gt(line.quantity))throw new ConflictException({code:'EXCHANGE_QUANTITY_EXCEEDED'});
  }
 }
 private async log(tx:Prisma.TransactionClient,row:Exchange,action:string,context:Context,extra:Record<string,unknown>={}){
  await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action,entityType:'SHIPMENT_EXCHANGE',entityId:row.shipmentExchangeCaseId,afterData:{exchangeNo:row.exchangeNo,originalFulfillmentId:row.originalFulfillmentId,...extra} as Prisma.InputJsonValue,requestId:context.requestId,correlationId:context.correlationId});
 }

 async create(orderNo:string,key:string,input:CreateShipmentExchangeInput,context:Context){
  const serialNos=this.serials(input.serialNos),reason=input.reason?.trim();
  if(!reason||reason.length>500||!/^[a-f0-9]{64}$/.test(input.shipmentReference)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestKey))throw new UnprocessableEntityException({code:'EXCHANGE_INPUT_INVALID'});
  const requestHash=createHash('sha256').update(JSON.stringify({orderNo,key,shipmentReference:input.shipmentReference,serialNos,reason})).digest('hex');
  return this.transaction(async tx=>{
   const {order,fulfillment}=await this.scope(tx,orderNo,key);
   const prior=await tx.shipmentExchangeCase.findUnique({where:{requestKey:input.requestKey},include});
   if(prior){if(prior.requestHash!==requestHash)throw new ConflictException({code:'EXCHANGE_IDEMPOTENCY_CONFLICT'});return {...shipmentExchangeView(prior),replayed:true};}
   if(!['PAID','FULFILLED','PARTIAL_RETURN'].includes(order.status))throw new ConflictException({code:'EXCHANGE_ORDER_NOT_ELIGIBLE'});
   const shipments=await tx.shipment.findMany({where:{fulfillmentId:fulfillment.fulfillmentId},include:{stateTransitions:{include:{trackingEvidence:true}}}});
   const shipment=shipments.find(row=>shipmentReference(row.shipmentId)===input.shipmentReference);
   if(!shipment)throw new ConflictException({code:'SHIPMENT_NOT_FOUND'});
   await tx.$queryRaw`SELECT shipment_id FROM commerce.shipment WHERE shipment_id=${shipment.shipmentId}::uuid FOR UPDATE`;
   const dispatched=shipment.stateTransitions.some(t=>['PICKED_UP','IN_TRANSIT','DELIVERED'].includes(t.toStatus)&&t.trackingEvidence?.shipmentId===shipment.shipmentId&&t.trackingEvidence.providerConnectionVersionId===shipment.providerConnectionVersionId&&t.trackingEvidence.providerShipmentRef===shipment.providerShipmentRef&&t.trackingEvidence.normalizedStatus===t.toStatus);
   if(!dispatched||!['PICKED_UP','IN_TRANSIT','DELIVERED','DELIVERY_FAILED'].includes(shipment.status))throw new ConflictException({code:'EXCHANGE_SHIPMENT_NOT_SHIPPED'});
   const bindings=await tx.shipmentSerialBinding.findMany({where:{shipmentId:shipment.shipmentId,allocation:{serializedUnit:{serialNo:{in:serialNos}}}},include:{returnReceipt:true,exchangeItems:{where:{releasedAt:null}},allocation:{include:{serializedUnit:true,sourceAllocation:true}}}});
   if(bindings.length!==serialNos.length)throw new ConflictException({code:'EXCHANGE_SERIAL_SOURCE_MISMATCH'});
   const unitIds=bindings.map(row=>row.allocation.serializedUnitId);
   await tx.$queryRaw`SELECT serialized_unit_id FROM commerce.serialized_unit WHERE serialized_unit_id IN (${Prisma.join(unitIds.map(id=>Prisma.sql`${id}::uuid`))}) ORDER BY serialized_unit_id FOR UPDATE`;
   if(bindings.some(row=>row.returnReceipt||row.allocation.serializedUnit.status!=='SHIPPED'))throw new ConflictException({code:'EXCHANGE_SERIAL_NOT_SHIPPED'});
   if(bindings.some(row=>row.exchangeItems.length))throw new ConflictException({code:'EXCHANGE_SERIAL_ALREADY_CLAIMED'});
   const quantities=new Map<string,number>();
   for(const binding of bindings){const lineId=binding.allocation.sourceAllocation.orderLineId;quantities.set(lineId,(quantities.get(lineId)??0)+1);}
   await this.economicEligibility(tx,order.orderId,quantities);
   const sequence=await tx.shipmentExchangeCase.count({where:{originalFulfillment:{orderId:order.orderId}}});
   const row=await tx.shipmentExchangeCase.create({data:{exchangeNo:`EX${orderNo}-${String(sequence+1).padStart(4,'0')}`,originalFulfillmentId:fulfillment.fulfillmentId,originalShipmentId:shipment.shipmentId,reason,requestKey:input.requestKey,requestHash,createdByActor:context.actorId,items:{create:bindings.map(binding=>({shipmentSerialBindingId:binding.shipmentSerialBindingId}))}},include});
   await this.log(tx,row,'SHIPMENT_EXCHANGE_REQUESTED',context,{serialCount:serialNos.length});
   return {...shipmentExchangeView(row),replayed:false};
  });
 }

 async receive(orderNo:string,key:string,reference:string,inputSerials:string[],context:Context){
  const serialNos=this.serials(inputSerials);
  return this.transaction(async tx=>{
   const {fulfillment}=await this.scope(tx,orderNo,key),row=await this.record(tx,fulfillment.fulfillmentId,reference);
   if(row.status==='CANCELLED')throw new ConflictException({code:'EXCHANGE_CANCELLED'});
   const items=row.items.filter(item=>serialNos.includes(item.shipmentBinding.allocation.serializedUnit.serialNo));
   if(items.length!==serialNos.length)throw new ConflictException({code:'EXCHANGE_SERIAL_SOURCE_MISMATCH'});
   const pending=items.filter(item=>!item.receivedAt);
   if(!pending.length)return {...shipmentExchangeView(row),replayed:true};
   if(row.status!=='REQUESTED')throw new ConflictException({code:'EXCHANGE_STATE_CONFLICT'});
   const unitIds=pending.map(item=>item.shipmentBinding.allocation.serializedUnitId);
   await tx.$queryRaw`SELECT serialized_unit_id FROM commerce.serialized_unit WHERE serialized_unit_id IN (${Prisma.join(unitIds.map(id=>Prisma.sql`${id}::uuid`))}) ORDER BY serialized_unit_id FOR UPDATE`;
   const units=await tx.serializedUnit.findMany({where:{serializedUnitId:{in:unitIds}}});
   if(units.some(unit=>unit.status!=='SHIPPED')||await tx.returnSerialReceipt.count({where:{shipmentSerialBindingId:{in:pending.map(item=>item.shipmentSerialBindingId)}}}))throw new ConflictException({code:'EXCHANGE_SERIAL_NOT_SHIPPED'});
   const now=new Date();
   await tx.shipmentExchangeItem.updateMany({where:{shipmentExchangeItemId:{in:pending.map(item=>item.shipmentExchangeItemId)}},data:{receivedAt:now,receivedByActor:context.actorId}});
   await tx.serializedUnit.updateMany({where:{serializedUnitId:{in:unitIds}},data:{status:'RETURNED'}});
   const remaining=await tx.shipmentExchangeItem.count({where:{shipmentExchangeCaseId:row.shipmentExchangeCaseId,receivedAt:null}});
   if(!remaining)await tx.shipmentExchangeCase.update({where:{shipmentExchangeCaseId:row.shipmentExchangeCaseId},data:{status:'RECEIVED',receivedAt:now}});
   const updated=await tx.shipmentExchangeCase.findUniqueOrThrow({where:{shipmentExchangeCaseId:row.shipmentExchangeCaseId},include});
   await this.log(tx,updated,'SHIPMENT_EXCHANGE_RECEIVED',context,{receivedCount:pending.length,remainingCount:remaining});
   return {...shipmentExchangeView(updated),replayed:false};
  });
 }

 async replacement(orderNo:string,key:string,reference:string,context:Context){
  return this.transaction(async tx=>{
   const {order,fulfillment}=await this.scope(tx,orderNo,key),row=await this.record(tx,fulfillment.fulfillmentId,reference);
   if(row.status==='REPLACEMENT_CREATED'&&row.replacementFulfillment)return {...shipmentExchangeView(row),replayed:true};
   if(row.status!=='RECEIVED'||!row.items.length||row.items.some(item=>!item.receivedAt||item.releasedAt||item.shipmentBinding.allocation.serializedUnit.status!=='RETURNED'))throw new ConflictException({code:'EXCHANGE_RECEIPT_REQUIRED'});
   if(!['PAID','FULFILLED','PARTIAL_RETURN'].includes(order.status))throw new ConflictException({code:'EXCHANGE_ORDER_NOT_ELIGIBLE'});
   const quantities=new Map<string,number>();
   for(const item of row.items){const lineId=item.shipmentBinding.allocation.sourceAllocation.orderLineId;quantities.set(lineId,(quantities.get(lineId)??0)+1);}
   await this.economicEligibility(tx,order.orderId,quantities,row.shipmentExchangeCaseId);
   const replacement=await tx.fulfillment.create({data:{orderId:order.orderId,fulfillmentKey:`F${row.exchangeNo}`,allocationSnapshotRef:createHash('sha256').update(JSON.stringify({exchange:row.shipmentExchangeCaseId,items:row.items.map(item=>item.shipmentSerialBindingId).sort()})).digest('hex'),fulfillmentPolicySnapshotRef:'UCELL_SAME_PRODUCT_EXCHANGE_V1'}});
   await tx.shipmentExchangeCase.update({where:{shipmentExchangeCaseId:row.shipmentExchangeCaseId},data:{replacementFulfillmentId:replacement.fulfillmentId,status:'REPLACEMENT_CREATED'}});
   for(const [orderLineId,quantity] of [...quantities.entries()].sort(([a],[b])=>a.localeCompare(b)))await this.allocator.allocate(tx,{fulfillmentId:replacement.fulfillmentId,orderLineId,quantity:String(quantity)});
   const updated=await tx.shipmentExchangeCase.findUniqueOrThrow({where:{shipmentExchangeCaseId:row.shipmentExchangeCaseId},include});
   await this.log(tx,updated,'SHIPMENT_EXCHANGE_REPLACEMENT_CREATED',context,{replacementFulfillmentId:replacement.fulfillmentId,serialCount:row.items.length});
   return {...shipmentExchangeView(updated),replayed:false};
  });
 }

 async cancel(orderNo:string,key:string,reference:string,context:Context){
  return this.transaction(async tx=>{
   const {fulfillment}=await this.scope(tx,orderNo,key),row=await this.record(tx,fulfillment.fulfillmentId,reference);
   if(row.status==='CANCELLED')return {...shipmentExchangeView(row),replayed:true};
   if(row.status!=='REQUESTED'||row.items.some(item=>item.receivedAt))throw new ConflictException({code:'EXCHANGE_CANCELLATION_NOT_ALLOWED'});
   const now=new Date();
   await tx.shipmentExchangeItem.updateMany({where:{shipmentExchangeCaseId:row.shipmentExchangeCaseId},data:{releasedAt:now}});
   const updated=await tx.shipmentExchangeCase.update({where:{shipmentExchangeCaseId:row.shipmentExchangeCaseId},data:{status:'CANCELLED',cancelledAt:now,cancelledByActor:context.actorId},include});
   await this.log(tx,updated,'SHIPMENT_EXCHANGE_CANCELLED',context);
   return {...shipmentExchangeView(updated),replayed:false};
  });
 }
}
