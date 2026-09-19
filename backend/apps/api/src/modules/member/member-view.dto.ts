import {ApiProperty,getSchemaPath} from '@nestjs/swagger';
export class QualificationView {
 @ApiProperty({format:'uuid'}) id!:string;
 @ApiProperty({description:'Member-authorized immutable business Ball number; never a UUID.'}) code!:string;
 @ApiProperty() rank!:string;
 @ApiProperty() active!:boolean;
 @ApiProperty() ballLabel!:string;
 @ApiProperty({pattern:'^\\d{4}-(0[1-9]|1[0-2])$',description:'Asia/Taipei calendar month used for the Active projection.'}) monthReference!:string;
 @ApiProperty({type:()=>ActiveIntervalView,nullable:true,description:'Authoritative v3 Active interval for monthReference; null means no Active evidence.'}) activeInterval!:ActiveIntervalView|null;
}
export class ActiveIntervalView { @ApiProperty({format:'date-time'}) activeFrom!:string; @ApiProperty({format:'date-time'}) activeTo!:string; }
export class PersonView {
 @ApiProperty() name!:string;
 @ApiProperty({type:String,nullable:true}) alias!:string|null;
 @ApiProperty({pattern:'^\\d{10}$',description:'Immutable Asia/Taipei YYMM + monthly six-digit business member number.'}) memberNo!:string;
 @ApiProperty({type:String,nullable:true}) email!:string|null;
 @ApiProperty({type:String,nullable:true}) phone!:string|null;
 @ApiProperty({type:String,nullable:true}) gender!:string|null;
 @ApiProperty({type:String,format:'date',nullable:true}) birthDate!:string|null;
 @ApiProperty({enum:['NETWORK_MEMBER','FORMAL_PENDING','FORMAL_MEMBER'],nullable:true,description:'Null means pre-V1.1 legacy state has not been classified; never inferred from Qualification.'}) membershipState!:string|null;
 @ApiProperty({type:String,format:'date-time',nullable:true}) mobileVerifiedAt!:string|null;
}
export class PaginationView {
 @ApiProperty({example:100}) limit!:number;
 @ApiProperty({description:'True means bounded response; further pagination is not yet available.'}) truncated!:boolean;
}
export class NoticeView {
 @ApiProperty({format:'uuid'}) id!:string;
 @ApiProperty({type:String,format:'uuid',nullable:true}) qualificationId!:string|null;
 @ApiProperty({enum:['SERVICE','ORDER','ACCOUNT']}) category!:string;
 @ApiProperty() title!:string;
 @ApiProperty() body!:string;
 @ApiProperty({format:'date-time'}) timeLabel!:string;
 @ApiProperty({type:String,format:'date-time',nullable:true,description:'First persisted Person read evidence; not LINE read state.'}) readAt!:string|null;
}
export class NoticesView {
 @ApiProperty({format:'uuid'}) qualificationId!:string;
 @ApiProperty({type:[NoticeView]}) notices!:NoticeView[];
 @ApiProperty({type:PaginationView}) pagination!:PaginationView;
}
export class NoticeReadView {
 @ApiProperty({format:'uuid'}) qualificationId!:string;
 @ApiProperty({format:'uuid'}) notificationId!:string;
 @ApiProperty({format:'date-time'}) readAt!:string;
}
export class OrderLineView {
 @ApiProperty({format:'uuid'}) productId!:string;
 @ApiProperty() name!:string;
 @ApiProperty({pattern:'^\\d+(\\.\\d+)?$'}) quantity!:string;
 @ApiProperty({required:false,pattern:'^\\d+(\\.\\d+)?$'}) unitPrice?:string;
 @ApiProperty({pattern:'^\\d+(\\.\\d+)?$'}) amount!:string;
 @ApiProperty({type:Number,nullable:true,required:false,description:'Checkout does not recognize PV; null.'}) pv?:number|null;
}
export class OrderView {
 @ApiProperty({format:'uuid'}) qualificationId!:string;
 @ApiProperty({format:'uuid'}) id!:string;
 @ApiProperty() status!:string;
 @ApiProperty({description:'Core authoritative decimal-string TWD product amount; never client-computed.',pattern:'^\\d+(\\.\\d+)?$'}) total!:string;
 @ApiProperty({format:'date-time'}) createdAt!:string;
 @ApiProperty({type:[OrderLineView]}) lines!:OrderLineView[];
 @ApiProperty({required:false}) paymentStatus?:string;
 @ApiProperty({required:false}) shipmentStatus?:string;
 @ApiProperty({required:false}) replayed?:boolean;
}
export class ProductView {
 @ApiProperty({format:'uuid'}) id!:string;
 @ApiProperty() name!:string;
 @ApiProperty({type:Number,nullable:true,description:'Display only; Create Order revalidates Core price.'}) price!:number|null;
 @ApiProperty({type:Number,nullable:true}) pv!:number|null;
 @ApiProperty({description:'Orderable by effective traceable product profile; does not confirm ERP stock.'}) available!:boolean;
 @ApiProperty({type:String,nullable:true}) reason!:string|null;
 @ApiProperty() fulfillmentStatus!:string;
 @ApiProperty() availabilityMeaning!:string;
}
export class ScopedPeriodView {
 @ApiProperty({format:'uuid'}) qualificationId!:string;
 @ApiProperty({pattern:'^\\d{4}-(0[1-9]|1[0-2])$'}) period!:string;
}
export class PerformanceView extends ScopedPeriodView {
 @ApiProperty({type:Number,nullable:true}) pv!:number|null;
 @ApiProperty({type:Number,nullable:true}) rpv!:number|null;
 @ApiProperty({type:Number,nullable:true}) epv!:number|null;
 @ApiProperty({type:Number,nullable:true}) left!:number|null;
 @ApiProperty({type:Number,nullable:true}) right!:number|null;
 @ApiProperty({type:String,format:'date-time',nullable:true}) asOf!:string|null;
}
export class DashboardView {
 @ApiProperty({format:'uuid'}) qualificationId!:string;
 @ApiProperty({type:QualificationView}) qualification!:QualificationView;
 @ApiProperty() memberName!:string;
 @ApiProperty() memberNo!:string;
 @ApiProperty({enum:['ACTIVE','PENDING','INACTIVE'],description:'Core recognition schedule status; frontend cannot derive Active entitlement.'}) monthlyRepurchaseStatus!:string;
 @ApiProperty({type:Number,nullable:true}) pv!:number|null;
 @ApiProperty({type:Number,nullable:true}) rpv!:number|null;
 @ApiProperty({type:Number,nullable:true}) epv!:number|null;
 @ApiProperty({type:Number,nullable:true,description:'Unfinalized settlement is null, not zero.'}) bonusAmount!:number|null;
 @ApiProperty() bonusStatus!:string;
 @ApiProperty({pattern:'^\\d{4}-(0[1-9]|1[0-2])$'}) monthReference!:string;
 @ApiProperty({type:()=>ActiveIntervalView,nullable:true}) activeInterval!:ActiveIntervalView|null;
}
/** Member-safe topology node. It deliberately has no qualification/tree UUID, owner type, Company state or finance fields. */
export class TreeNodeView {
 @ApiProperty({description:'Authorized business Ball number only.'}) code!:string;
 @ApiProperty({description:'Present only for a direct-sponsored visible Ball; an empty string means the holder identity is intentionally omitted.'}) name!:string;
 @ApiProperty({enum:['DirectSponsoredIdentity','AnonymousBallNode']}) nodeKind!:'DirectSponsoredIdentity'|'AnonymousBallNode';
}
export class MemberTreeNodeView {
 @ApiProperty() ballNo!:string;
 @ApiProperty({description:'Decimal string; never converted to a JavaScript number.'}) binaryPositionNo!:string;
 @ApiProperty({enum:['LEFT','RIGHT'],nullable:true}) side!:'LEFT'|'RIGHT'|null;
 @ApiProperty({enum:['AnonymousBallNode']}) nodeKind!:'AnonymousBallNode';
}
export class MemberTreePageView {
 @ApiProperty({enum:['AVAILABLE','UNAVAILABLE']}) status!:'AVAILABLE'|'UNAVAILABLE';
 @ApiProperty({type:String,nullable:true}) snapshotToken!:string|null;
 @ApiProperty({type:String,format:'date-time',nullable:true}) snapshotExpiresAt!:string|null;
 @ApiProperty({type:String,nullable:true}) parentBallNo!:string|null;
 @ApiProperty({description:'A neutral upstream indicator only. It never identifies a hidden Company Bootstrap Ball.'}) hiddenBootstrapBoundary!:boolean;
 @ApiProperty({type:[MemberTreeNodeView]}) items!:MemberTreeNodeView[];
 @ApiProperty({type:String,nullable:true}) nextCursor!:string|null;
}
export class SponsorView {
 @ApiProperty({format:'uuid'}) qualificationId!:string;
 @ApiProperty({type:TreeNodeView,nullable:true}) sponsor!:TreeNodeView|null;
 @ApiProperty({type:[TreeNodeView]}) referrals!:TreeNodeView[];
 @ApiProperty({type:PaginationView}) pagination!:PaginationView;
}
export class SideView { @ApiProperty({type:Number,nullable:true}) count!:number|null; @ApiProperty({type:Number,nullable:true}) volume!:number|null; @ApiProperty({type:Number,nullable:true,description:'Authoritative settlement carry. Null while the read model is unavailable; never interpreted as zero.'}) carry!:number|null; }
export class ReadModelAvailabilityView {
 @ApiProperty({enum:['AVAILABLE','UNAVAILABLE']}) status!:'AVAILABLE'|'UNAVAILABLE';
 @ApiProperty({type:String,nullable:true,description:'Machine-readable reason. The frontend must not derive missing Core values.'}) reason!:string|null;
}
export class BinarySettlementScopeView {
 @ApiProperty({format:'uuid'}) settlementBatchId!:string;
 @ApiProperty({format:'date-time'}) periodStart!:string;
 @ApiProperty({format:'date-time'}) periodEnd!:string;
 @ApiProperty() ruleVersion!:string;
 @ApiProperty({pattern:'^[a-f0-9]{64}$'}) parameterSnapshotHash!:string;
 @ApiProperty({pattern:'^[a-f0-9]{64}$'}) calculationHash!:string;
 @ApiProperty({format:'date-time'}) finalizedAt!:string;
}
export class BinaryView {
 @ApiProperty({format:'uuid'}) qualificationId!:string;
 @ApiProperty({type:SideView}) left!:SideView;
 @ApiProperty({type:SideView}) right!:SideView;
 @ApiProperty({type:ReadModelAvailabilityView,description:'Availability of authoritative left/right volume and carry for the requested settlement period.'}) settlementMetrics!:ReadModelAvailabilityView;
 @ApiProperty({type:BinarySettlementScopeView,nullable:true,description:'Exact immutable settlement evidence used for volume/carry. Null when no explicit finalized settlement scope was requested.'}) settlementScope!:BinarySettlementScopeView|null;
 @ApiProperty({type:ReadModelAvailabilityView,description:'Availability of the bounded, privacy-safe full Binary Tree read model.'}) fullTree!:ReadModelAvailabilityView;
}
export class AwardView {
 @ApiProperty() id!:string;
 @ApiProperty() name!:string;
 @ApiProperty({enum:['PENDING','CALCULATED','PENDING45D','EFFECTIVE','PAYABLE','PAID','REVERSED','CLAWBACK']}) status!:string;
 @ApiProperty({type:Number,nullable:true,description:'Null for unfinalized or absent lifecycle evidence.'}) amount!:number|null;
 @ApiProperty({type:Number,nullable:true}) theoryAmount!:number|null;
 @ApiProperty({type:Number,nullable:true,description:'Null until the settlement batch is FINALIZED.'}) finalAmount!:number|null;
 @ApiProperty({type:Number,nullable:true,description:'Null until final settlement evidence exists.'}) payableAmount!:number|null;
 @ApiProperty({enum:['PENDING','FINALIZED']}) settlementStatus!:string;
 @ApiProperty({type:String,nullable:true}) pendingReason!:string|null;
 @ApiProperty({type:String,format:'date',nullable:true}) settlementDate!:string|null;
 @ApiProperty({type:String,format:'date',nullable:true}) nominalPayoutDate!:string|null;
 @ApiProperty({type:String,format:'date',nullable:true}) adjustedPayoutDate!:string|null;
 @ApiProperty({type:String,nullable:true}) businessCalendarVersion!:string|null;
 @ApiProperty({type:String,nullable:true}) ruleVersion!:string|null;
 @ApiProperty({type:String,nullable:true}) parameterSnapshotHash!:string|null;
}
export class BonusesView extends ScopedPeriodView { @ApiProperty({type:[AwardView]}) awards!:AwardView[]; @ApiProperty({type:PaginationView}) pagination!:PaginationView; }
export class LedgerEntryView { @ApiProperty() id!:string; @ApiProperty() label!:string; @ApiProperty({type:Number,nullable:true}) amount!:number|null; @ApiProperty({format:'date-time'}) postedAt!:string; @ApiProperty() sourceId!:string; }
export class LedgerView extends ScopedPeriodView { @ApiProperty({type:[LedgerEntryView]}) entries!:LedgerEntryView[]; @ApiProperty({type:PaginationView}) pagination!:PaginationView; }
export class RecognitionView { @ApiProperty({format:'uuid'}) id!:string; @ApiProperty() status!:string; @ApiProperty({format:'date-time'}) dueAt!:string; }
export class RepurchaseView extends ScopedPeriodView { @ApiProperty({enum:['ACTIVE','PENDING','INACTIVE']}) status!:string; @ApiProperty({type:[RecognitionView]}) recognitions!:RecognitionView[]; }
export class OrderListEntryView { @ApiProperty() id!:string; @ApiProperty({format:'date-time'}) createdAt!:string; @ApiProperty({type:Number,nullable:true,description:'Display DTO only; not input to mutation.'}) total!:number|null; @ApiProperty() status!:string; @ApiProperty() paymentStatus!:string; @ApiProperty() shipmentStatus!:string; }
export class OrdersView { @ApiProperty({format:'uuid'}) qualificationId!:string; @ApiProperty({type:[OrderListEntryView]}) orders!:OrderListEntryView[]; @ApiProperty({type:PaginationView}) pagination!:PaginationView; }
export class ContextView { @ApiProperty({format:'uuid'}) qualificationId!:string; @ApiProperty({type:QualificationView}) qualification!:QualificationView; }
export class LogoutView { @ApiProperty({enum:['REVOKED']}) status!:string; @ApiProperty({format:'uuid'}) sessionId!:string; }
export class LineSessionView { @ApiProperty({description:'Opaque UCell bearer, not LINE token.'}) accessToken!:string; @ApiProperty({format:'date-time'}) expiresAt!:string; @ApiProperty({format:'uuid'}) sessionId!:string; }
export const memberViewModels=[LogoutView,ActiveIntervalView,QualificationView,PersonView,PaginationView,NoticeView,NoticesView,NoticeReadView,OrderLineView,OrderView,ProductView,PerformanceView,DashboardView,TreeNodeView,MemberTreeNodeView,MemberTreePageView,SponsorView,SideView,ReadModelAvailabilityView,BinarySettlementScopeView,BinaryView,AwardView,BonusesView,LedgerEntryView,LedgerView,RecognitionView,RepurchaseView,OrderListEntryView,OrdersView,ContextView,LineSessionView];
export function memberEnvelope(type:Function,array=false){return {type:'object',required:['data','meta'],properties:{data:array?{type:'array',items:{$ref:getSchemaPath(type)}}:{$ref:getSchemaPath(type)},meta:{type:'object',required:['request_id','timestamp','api_version'],properties:{request_id:{type:'string'},timestamp:{type:'string',format:'date-time'},api_version:{type:'string',enum:['v1']}}}}};}
