import {ConflictException} from '@nestjs/common';
import {Prisma} from '@ucell/database';
import {AuditService} from '../../common/audit/audit.service';
import {ErpBusinessProjectionService} from '../commerce/erp-business-projection.service';
import {ErpReconciliationBridgeService} from '../commerce/erp-reconciliation-bridge.service';
import {FINANCIAL_WORK_SOURCES,financialWorkReference,OperationsFinancialHealthService} from './operations-financial-health.service';
import {WORKFLOW_SOURCES,workflowReference,OperationsWorkflowHealthService} from './operations-workflow-health.service';

/** Shared by legacy and business-reference commands; no API may bypass the source gate. */
export async function requireOperationalExceptionResolution(tx:Prisma.TransactionClient,row:{sourceType:string;sourceId:string}){
 if(Object.hasOwn(WORKFLOW_SOURCES,row.sourceType)){
  const source=workflowReference(row.sourceType,row.sourceId);if(!source)throw new ConflictException({code:'OPERATIONS_WORKFLOW_COMPLETION_REQUIRED'});
  const item=(await new OperationsWorkflowHealthService({$transaction:(work:any)=>work(tx)} as any).list({...source,take:1})).items[0];
  if(!item||item.scope==='PERIOD_JOB'&&item.state!=='COMPLETED'||item.scope==='RECOGNITION'&&!['RECOGNIZED','CANCELLED','REVERSED'].includes(item.state))throw new ConflictException({code:'OPERATIONS_WORKFLOW_COMPLETION_REQUIRED'});return;
 }
 const financial=financialWorkReference(row.sourceType,row.sourceId);
 if(Object.hasOwn(FINANCIAL_WORK_SOURCES,row.sourceType)){
  if(!financial)throw new ConflictException({code:'OPERATIONS_FINANCIAL_RECONCILIATION_REQUIRED'});
  const page=await new OperationsFinancialHealthService({$transaction:(work:any)=>work(tx)} as any).list({scope:financial.scope,reference:financial.reference,take:1});
  if(page.items.length!==1||page.items[0].candidates.length)throw new ConflictException({code:'OPERATIONS_FINANCIAL_RECONCILIATION_REQUIRED'});
  return;
 }
 if(!['ERP_BUSINESS_PROJECTION','ERP_HANDOFF','ERP_RECONCILIATION'].includes(row.sourceType))return;
 const db={$transaction:(work:any)=>work(tx)} as any;let matched=false;
 if(row.sourceType==='ERP_BUSINESS_PROJECTION'&&/^ERP-PROJECTION-[a-f0-9]{40}$/.test(row.sourceId))matched=(await new ErpBusinessProjectionService(db,new AuditService()).detail(row.sourceId)).status==='RECONCILED';
 else if(row.sourceType!=='ERP_BUSINESS_PROJECTION'){
  const base=row.sourceType==='ERP_RECONCILIATION'?row.sourceId.replace(/:[a-f0-9]{64}$/,''):row.sourceId,index=base.indexOf(':'),orderNo=base.slice(0,index),fulfillmentKey=base.slice(index+1);
  if(index>0&&/^[0-9]{1,19}$/.test(orderNo)&&BigInt(orderNo)<=9223372036854775807n&&fulfillmentKey.length<=200)matched=(await new ErpReconciliationBridgeService(db).list({orderNo,fulfillmentKey,take:1})).items[0]?.bridgeStatus==='RECONCILED';
 }
 if(!matched)throw new ConflictException({code:'OPERATIONS_SOURCE_RECONCILIATION_REQUIRED'});
}
