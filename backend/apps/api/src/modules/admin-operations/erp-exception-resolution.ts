import {ConflictException} from '@nestjs/common';
import {Prisma} from '@ucell/database';
import {AuditService} from '../../common/audit/audit.service';
import {ErpBusinessProjectionService} from '../commerce/erp-business-projection.service';
import {ErpReconciliationBridgeService} from '../commerce/erp-reconciliation-bridge.service';

/** Shared by legacy and business-reference commands; no API may bypass the source gate. */
export async function requireErpExceptionReconciliation(tx:Prisma.TransactionClient,row:{sourceType:string;sourceId:string}){
 if(!['ERP_BUSINESS_PROJECTION','ERP_HANDOFF','ERP_RECONCILIATION'].includes(row.sourceType))return;
 const db={$transaction:(work:any)=>work(tx)} as any;let matched=false;
 if(row.sourceType==='ERP_BUSINESS_PROJECTION'&&/^ERP-PROJECTION-[a-f0-9]{40}$/.test(row.sourceId))matched=(await new ErpBusinessProjectionService(db,new AuditService()).detail(row.sourceId)).status==='RECONCILED';
 else if(row.sourceType!=='ERP_BUSINESS_PROJECTION'){
  const base=row.sourceType==='ERP_RECONCILIATION'?row.sourceId.replace(/:[a-f0-9]{64}$/,''):row.sourceId,index=base.indexOf(':'),orderNo=base.slice(0,index),fulfillmentKey=base.slice(index+1);
  if(index>0&&/^[0-9]{1,19}$/.test(orderNo)&&BigInt(orderNo)<=9223372036854775807n&&fulfillmentKey.length<=200)matched=(await new ErpReconciliationBridgeService(db).list({orderNo,fulfillmentKey,take:1})).items[0]?.bridgeStatus==='RECONCILED';
 }
 if(!matched)throw new ConflictException({code:'OPERATIONS_SOURCE_RECONCILIATION_REQUIRED'});
}
