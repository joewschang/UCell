import {memberApi} from '../memberApi';
import {MemberApiError} from '../api';
import type {BundleRequest} from './model';

export type BundleOrder = {orderId:string;orderNo:string;publicOrderNo?:string|null;packageName:string;total:string;status:string;paymentDeadline:string|null};
export type BundleLine = {position:number;parentPosition:number|null;side:'LEFT'|'RIGHT'|null;
  qualificationId:string;ballNo:string|null;qualificationStatus:string|null;placementStatus:string|null;
  qualification:BundleOrder;repurchase:BundleOrder|null;repurchasePayable:boolean};
export type BundleReceipt = {bundleId:string;applicationId:string;currency:string;qualificationTotal:string;repurchaseTotal:string;total:string;mayRestart:boolean;rootSponsor:null|{ballNo:string|null;name:string|null};balls:BundleLine[]};
const bundlePath=(id:string)=>'/member/formal-enrollment/applications/'+encodeURIComponent(id)+'/bundle';
export function getBundle(id:string,signal?:AbortSignal) {
  return memberApi<BundleReceipt|null>(bundlePath(id),{signal});
}
export function createBundle(id:string,body:BundleRequest,key:string) {
  return memberApi<BundleReceipt>(bundlePath(id),{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(body)});
}
export function releaseExpired(id:string,bundleId:string,key:string) {
  return memberApi(bundlePath(id)+'/'+encodeURIComponent(bundleId)+'/release-expired',{method:'POST',headers:{'Idempotency-Key':key},body:'{}'});
}
export type PaymentReport = {bundleId:string;amount:string;actorReportedAt:string;paidAt:string;accountLastFive:string};
export function getPaymentReport(applicationId:string,signal?:AbortSignal){
  return memberApi<PaymentReport|null>(bundlePath(applicationId)+'/payment-report',{signal});
}
export function reportPayment(applicationId:string,data:{amount:string;paidAt:string;accountLastFive:string},key:string){
  return memberApi<PaymentReport>(bundlePath(applicationId)+'/payment-report',{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(data)});
}
export async function getSponsorCandidate(applicationId:string,code:string,signal:AbortSignal) {
  const candidate=await memberApi<{ballNo:string;name:string}>(bundlePath(applicationId)+'/sponsor-candidate?'+new URLSearchParams({code}),{signal});
  if(!candidate?.ballNo||!candidate.name) throw Error('推薦球資料不完整，請核對球號或洽承辦人。');
  return candidate;
}
export function assignRootSponsor(applicationId:string,sponsorCode:string,key:string) {
  return memberApi(bundlePath(applicationId)+'/root-sponsor',{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify({sponsorCode})});
}
export function bundleError(error:unknown) {
  if(error instanceof MemberApiError) {
    const messages:Record<string,string>={
      BUNDLE_ALREADY_EXISTS:'這份申請已有整組訂單，請重新查詢訂單進度。',
      IDEMPOTENCY_CONFLICT:'送出內容和先前請求不同，請重新查詢訂單進度。',
      PACKAGE_QUOTE_CHANGED:'套組價格或優惠已更新，請返回套組選擇重新取得報價。',
      SPONSOR_NOT_FOUND:'找不到第 1 球的推薦球號，請重新核對。',
    };
    return (error.code&&messages[error.code])||error.message;
  }
  return error instanceof Error?error.message:'暫時無法連線，請重新查詢。';
}
export type BundlePaymentSummary = {bundleId:string;qualificationCount:number;paidQualifications:number;
  qualificationTotal:string;outstandingQualificationTotal:string;rootOrderId:string;rootPaid:boolean;paymentReported:boolean;currency:'TWD'};
