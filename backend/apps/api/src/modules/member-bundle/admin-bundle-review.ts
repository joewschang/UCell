import {Prisma, PrismaService} from '@ucell/database';
import {activeBundle, bundleReceipt} from './bundle-read';
import {enrollmentBundlePayment} from '../member/enrollment-bundle-payment';

export async function adminEnrollmentReview(db:PrismaService, applicationId:string, personId:string) {
  return db.$transaction(async tx=>{
    const group=await activeBundle(tx,applicationId);
    if(!group)return null;
    const receipt=await bundleReceipt(tx,group.bundleId,applicationId);
    const payment=await enrollmentBundlePayment(tx,applicationId,personId);
    return {...receipt, paymentVerified:payment?.rootPaid===true};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
