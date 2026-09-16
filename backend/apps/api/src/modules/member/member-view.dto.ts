import {ApiProperty,getSchemaPath} from '@nestjs/swagger';
export class QualificationView {
 @ApiProperty({format:'uuid'}) id!:string;
 @ApiProperty() code!:string;
 @ApiProperty() rank!:string;
 @ApiProperty() active!:boolean;
 @ApiProperty() ballLabel!:string;
}
export class PersonView {
 @ApiProperty() name!:string;
 @ApiProperty({format:'uuid'}) memberNo!:string;
 @ApiProperty({type:String,nullable:true}) email!:string|null;
 @ApiProperty({type:String,nullable:true}) phone!:string|null;
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
}
export class TreeNodeView { @ApiProperty() code!:string; @ApiProperty({description:'Masked name'}) name!:string; }
export class SponsorView {
 @ApiProperty({format:'uuid'}) qualificationId!:string;
 @ApiProperty({type:TreeNodeView,nullable:true}) sponsor!:TreeNodeView|null;
 @ApiProperty({type:[TreeNodeView]}) referrals!:TreeNodeView[];
 @ApiProperty({type:PaginationView}) pagination!:PaginationView;
}
export class SideView { @ApiProperty({type:Number,nullable:true}) count!:number|null; @ApiProperty({type:Number,nullable:true}) volume!:number|null; }
export class BinaryView { @ApiProperty({format:'uuid'}) qualificationId!:string; @ApiProperty({type:SideView}) left!:SideView; @ApiProperty({type:SideView}) right!:SideView; }
export class AwardView {
 @ApiProperty() id!:string;
 @ApiProperty() name!:string;
 @ApiProperty({enum:['PENDING','CALCULATED','PENDING45D','EFFECTIVE','PAYABLE','PAID','REVERSED','CLAWBACK']}) status!:string;
 @ApiProperty({type:Number,nullable:true,description:'Null for unfinalized or absent lifecycle evidence.'}) amount!:number|null;
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
export const memberViewModels=[LogoutView,QualificationView,PersonView,PaginationView,NoticeView,NoticesView,NoticeReadView,OrderLineView,OrderView,ProductView,PerformanceView,DashboardView,TreeNodeView,SponsorView,SideView,BinaryView,AwardView,BonusesView,LedgerEntryView,LedgerView,RecognitionView,RepurchaseView,OrderListEntryView,OrdersView,ContextView,LineSessionView];
export function memberEnvelope(type:Function,array=false){return {type:'object',required:['data','meta'],properties:{data:array?{type:'array',items:{$ref:getSchemaPath(type)}}:{$ref:getSchemaPath(type)},meta:{type:'object',required:['request_id','timestamp','api_version'],properties:{request_id:{type:'string'},timestamp:{type:'string',format:'date-time'},api_version:{type:'string',enum:['v1']}}}}};}
