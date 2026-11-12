import {ConflictException,NotFoundException,UnprocessableEntityException} from '@nestjs/common';
import {Prisma} from '@ucell/database';
import {ApiProperty} from '@nestjs/swagger';
import {IsISO8601,Matches} from 'class-validator';
import {enrollmentBundlePayment} from './enrollment-bundle-payment';

export class EnrollmentBundleTransferDto {
  @ApiProperty() @Matches(/^\d{1,14}(\.\d{1,2})?$/) amount!:string;
  @ApiProperty() @IsISO8601() paidAt!:string;
  @ApiProperty() @Matches(/^\d{5}$/) accountLastFive!:string;
}

type Transfer = {bundleId:string;amount:string;accountLastFive:string;paidAt:Date;actorReportedAt:Date};
export async function readBundleTransfer(tx:Prisma.TransactionClient,applicationId:string,personId:string) {
  const [record]=await tx.$queryRaw<Transfer[]>`SELECT r.bundle_id AS "bundleId",r.amount::text,r.account_last_five AS "accountLastFive",r.paid_at AS "paidAt",r.created_at AS "actorReportedAt"
    FROM commerce.enrollment_bundle_payment_report r JOIN membership.enrollment_bundle b ON b.bundle_id=r.bundle_id
    WHERE b.application_id=${applicationId}::uuid AND b.person_id=${personId}::uuid AND b.superseded_at IS NULL`;
  return record??null;
}

export async function reportBundleTransfer(tx:Prisma.TransactionClient,applicationId:string,personId:string,body:EnrollmentBundleTransferDto) {
  const [group]=await tx.$queryRaw<{id:string}[]>`SELECT bundle_id AS id FROM membership.enrollment_bundle
    WHERE application_id=${applicationId}::uuid AND person_id=${personId}::uuid AND superseded_at IS NULL FOR UPDATE`;
  if(!group)throw new NotFoundException({code:'ENROLLMENT_BUNDLE_NOT_FOUND'});
  const at=new Date(body.paidAt), prior=await readBundleTransfer(tx,applicationId,personId);
  if(prior){
    if(new Prisma.Decimal(prior.amount).eq(body.amount)&&prior.accountLastFive===body.accountLastFive&&prior.paidAt.getTime()===at.getTime())return prior;
    throw new ConflictException({code:'BUNDLE_TRANSFER_ALREADY_REPORTED',message:'已收到這組資格的匯款回報。資料需要更正時請聯絡客服核對。'});
  }
  const summary=await enrollmentBundlePayment(tx,applicationId,personId);
  const [window]=await tx.$queryRaw<{start:Date;deadline:Date|null;payable:boolean}[]>`
    SELECT max(o.created_at) AS start,min(s.payment_deadline) AS deadline,bool_and(o.status='CONFIRMED') AS payable
    FROM membership.enrollment_bundle_ball b JOIN commerce."order" o ON o.order_id=b.qualification_order_id
    JOIN commerce.package_purchase_snapshot s ON s.order_id=o.order_id WHERE b.bundle_id=${group.id}::uuid`;
  if(!summary||!window.payable||!window.deadline||window.deadline.getTime()<=Date.now())throw new ConflictException({code:'BUNDLE_NOT_PAYABLE'});
  const amount=new Prisma.Decimal(body.amount);
  // The member reports the minute shown on the transfer slip. Finance records the actual receipt separately.
  const firstReportableMinute=Math.floor(window.start.getTime()/60000)*60000;
  if(!amount.isPositive()||!amount.eq(summary.payableTotal)||!Number.isFinite(at.getTime())||at.getTime()<firstReportableMinute||at>=window.deadline||at.getTime()>Date.now()+60000)
    throw new UnprocessableEntityException({code:'BUNDLE_TRANSFER_INVALID',message:'請核對整組應付金額及實際匯款時間。'});
  await tx.$executeRaw`INSERT INTO commerce.enrollment_bundle_payment_report(bundle_id,amount,account_last_five,paid_at)
    VALUES (${group.id}::uuid,${amount},${body.accountLastFive},${at})`;
  return readBundleTransfer(tx,applicationId,personId);
}
