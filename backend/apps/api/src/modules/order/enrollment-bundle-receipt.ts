import {ConflictException, UnprocessableEntityException} from '@nestjs/common';
import {Prisma} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {PaymentConfirmationDto} from './dto/payment-confirmation.dto';
import {validateManualPaymentReview} from './manual-payment-review';

type Tx = Prisma.TransactionClient;
type Receipt = {receiptId:string; amount:string; paymentMethod:string; referenceNo:string; receivedAt:Date};
type Line = {orderId:string; orderNo:string; publicOrderNo:string|null; position:number; kind:'ENTRY'|'REPURCHASE'; amount:string; status:string; createdAt:Date; paymentDeadline:Date|null};
type Writer = (tx:Tx, orderId:string, payment:PaymentConfirmationDto, key:string, requestId:string, actor:string, mode:'MANUAL_ADMIN') => Promise<unknown>;

async function receiptFor(tx:Tx, bundleId:string) {
  const [receipt]=await tx.$queryRaw<Receipt[]>`SELECT receipt_id AS "receiptId",amount::text, payment_method AS "paymentMethod",
    reference_no AS "referenceNo", received_at AS "receivedAt" FROM commerce.enrollment_bundle_payment WHERE bundle_id=${bundleId}::uuid`;
  return receipt??null;
}

export async function bundleForQualificationOrder(tx:Tx, orderId:string) {
  const rows=await tx.$queryRaw<{bundleId:string}[]>`SELECT b.bundle_id AS "bundleId"
    FROM membership.enrollment_bundle_ball p JOIN membership.enrollment_bundle b USING(bundle_id)
    WHERE p.qualification_order_id=${orderId}::uuid OR (b.payment_policy='COMBINED' AND p.repurchase_order_id=${orderId}::uuid)`;
  return rows[0]?.bundleId??null;
}

async function linesFor(tx:Tx, bundleId:string) {
  return tx.$queryRaw<Line[]>`SELECT o.order_id AS "orderId", o.order_no::text AS "orderNo",to_jsonb(o)->>'public_order_no' AS "publicOrderNo",ball.position::int,o.purpose::text AS kind,
    o.net_amount::text AS amount,o.status::text AS status,o.created_at AS "createdAt",s.payment_deadline AS "paymentDeadline"
    FROM membership.enrollment_bundle_ball ball
    JOIN membership.enrollment_bundle b USING(bundle_id)
    JOIN commerce."order" o ON o.order_id=ball.qualification_order_id OR (b.payment_policy='COMBINED' AND o.order_id=ball.repurchase_order_id)
    JOIN commerce.package_purchase_snapshot s ON s.order_id=o.order_id
    WHERE ball.bundle_id=${bundleId}::uuid ORDER BY ball.position,o.purpose`;
}

export async function adminBundlePayment(tx:Tx, orderId:string) {
  const bundleId=await bundleForQualificationOrder(tx,orderId);
  if(!bundleId)return null;
  const lines=await linesFor(tx,bundleId);
  const total=lines.reduce((sum,line)=>sum.plus(line.amount),new Prisma.Decimal(0)).toFixed(2);
  const [report]=await tx.$queryRaw<{accountLastFive:string;paidAt:Date;amount:string}[]>`SELECT account_last_five AS "accountLastFive",paid_at AS "paidAt",amount::text FROM commerce.enrollment_bundle_payment_report WHERE bundle_id=${bundleId}::uuid`;
  const [policy]=await tx.$queryRaw<{paymentPolicy:string}[]>`SELECT payment_policy AS "paymentPolicy" FROM membership.enrollment_bundle WHERE bundle_id=${bundleId}::uuid`;
  return {bundleId,total,...policy,currency:'TWD',lines,report:report??null,receipt:await receiptFor(tx,bundleId)};
}

async function lockEvidence(tx:Tx,method:string,reference:string) {
  const identity=method.trim().toUpperCase()+'|'+reference.trim().toUpperCase();
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${identity},62112))`;
}

export async function guardSinglePayment(tx:Tx,orderId:string,dto:PaymentConfirmationDto) {
  if(await bundleForQualificationOrder(tx,orderId))throw new ConflictException({
    code:'BUNDLE_SINGLE_PAYMENT_NOT_ALLOWED',message:'這張資格訂單屬於多球申請，請改用「確認整組資格收款」。'
  });
  await lockEvidence(tx,dto.paymentMethod,dto.referenceNo);
  const [used]=await tx.$queryRaw<{used:boolean}[]>`SELECT EXISTS(
    SELECT 1 FROM commerce.enrollment_bundle_payment
    WHERE upper(btrim(payment_method))=upper(btrim(${dto.paymentMethod})) AND upper(btrim(reference_no))=upper(btrim(${dto.referenceNo}))
  ) AS used`;
  if(used?.used)throw new ConflictException({code:'BUNDLE_RECEIPT_ALREADY_USED',message:'這筆收款憑證已用於另一筆多球申請。'});
}

export async function confirmBundlePayment(tx:Tx,bundleId:string,dto:PaymentConfirmationDto,actor:string,requestId:string,write:Writer) {
  const [group]=await tx.$queryRaw<{id:string;policy:string}[]>`SELECT bundle_id AS id,payment_policy AS policy FROM membership.enrollment_bundle
    WHERE bundle_id=${bundleId}::uuid AND superseded_at IS NULL FOR UPDATE`;
  if(!group)throw new ConflictException({code:'ENROLLMENT_BUNDLE_NOT_ACTIVE'});
  const reference=dto.referenceNo.trim(),method=dto.paymentMethod.trim().toUpperCase(),at=new Date(dto.occurredAt);
  if(!actor||!reference||reference.length>180||!['BANK_TRANSFER','CASH','COUPON_WAIVER'].includes(method))throw new UnprocessableEntityException({code:'BUNDLE_RECEIPT_INVALID'});
  const prior=await receiptFor(tx,bundleId);
  if(prior) {
    if(prior.paymentMethod===method && prior.referenceNo===reference && new Prisma.Decimal(prior.amount).eq(dto.amount) && prior.receivedAt.getTime()===at.getTime())return prior;
    throw new ConflictException({code:'BUNDLE_ALREADY_PAID',message:'整組資格已完成收款，請核對原始收款紀錄。'});
  }
  const lines=await linesFor(tx,bundleId);
  const entries=lines.filter(line=>line.kind==='ENTRY');
  if(entries.length<2||entries.some((line,index)=>line.position!==index+1)||lines.some(line=>line.status!=='CONFIRMED'))throw new ConflictException({code:'BUNDLE_NOT_PAYABLE',message:'整組訂單狀態已變動，請重新載入並核對。'});
  const sum=lines.reduce((value,line)=>value.plus(line.amount),new Prisma.Decimal(0));
  if(!sum.eq(dto.amount))throw new UnprocessableEntityException({code:'BUNDLE_RECEIPT_AMOUNT_MISMATCH',message:'實收金額須等於本組訂單的應付金額。',details:{expected:sum.toFixed(2)}});
  if(lines.some(line=>at<line.createdAt || (line.paymentDeadline && at>=line.paymentDeadline)))throw new ConflictException({code:'PACKAGE_PAYMENT_DEADLINE_EXCEEDED'});
  validateManualPaymentReview({...dto,paymentMethod:method},sum.isZero(),lines[0].createdAt,at);
  await lockEvidence(tx,method,reference);
  const [used]=await tx.$queryRaw<{used:boolean}[]>`SELECT EXISTS(
    SELECT 1 FROM commerce.payment_event WHERE upper(btrim(payment_method))=${method} AND upper(btrim(reference_no))=upper(${reference})
    UNION ALL SELECT 1 FROM commerce.paper_receipt_evidence WHERE upper(btrim(payment_channel))=${method} AND upper(btrim(receipt_reference))=upper(${reference})
    UNION ALL SELECT 1 FROM commerce.enrollment_bundle_payment WHERE upper(btrim(payment_method))=${method} AND upper(btrim(reference_no))=upper(${reference})
  ) AS used`;
  if(used.used)throw new ConflictException({code:'BUNDLE_RECEIPT_ALREADY_USED',message:'此收款憑證已登錄，請核對原紀錄。'});
  const receiptId=randomUUID();
  await tx.$executeRaw`INSERT INTO commerce.enrollment_bundle_payment(bundle_id,receipt_id,amount,payment_method,reference_no,received_at,actor_id,request_id)
    VALUES (${bundleId}::uuid,${receiptId}::uuid,${sum},${method},${reference},${at},${actor}::uuid,${requestId})`;
  // Use the normal order writer. The master receipt and every allocation commit in the same transaction.
  for(const line of lines) {
    if(group.policy==='COMBINED'){
      await tx.$executeRaw`INSERT INTO commerce.enrollment_bundle_allocation(bundle_id,order_id,amount)
        VALUES(${bundleId}::uuid,${line.orderId}::uuid,${new Prisma.Decimal(line.amount)})`;
      continue;
    }
    const allocationMethod=new Prisma.Decimal(line.amount).isZero()?'COUPON_WAIVER':method;
    await write(tx,line.orderId,{...dto,amount:line.amount,paymentMethod:allocationMethod,referenceNo:reference},
      'enrollment-bundle:'+receiptId+':'+line.position,requestId,actor,'MANUAL_ADMIN');
  }
  return {receiptId,amount:sum.toFixed(2),paymentMethod:method,referenceNo:reference,receivedAt:at};
}
