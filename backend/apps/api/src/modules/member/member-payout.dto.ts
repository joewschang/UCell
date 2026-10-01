import {PayoutBatchStatus} from '@prisma/client';
import {ApiProperty} from '@nestjs/swagger';
export class MemberPaymentResultView{
 @ApiProperty() reference!:string;
 @ApiProperty({enum:['PAID','FAILED']}) status!:string;
 @ApiProperty({description:'Stored cumulative confirmation for this result; decimal string, not a sum of reports'}) paidAmount!:string;
 @ApiProperty() netAmount!:string;
 @ApiProperty() grossAmount!:string;
 @ApiProperty() recoveryOffset!:string;
 @ApiProperty() occurredAt!:string;
 @ApiProperty() recordedAt!:string;
 @ApiProperty() periodStart!:string;
 @ApiProperty() periodEnd!:string;
 @ApiProperty({enum:PayoutBatchStatus}) batchStatus!:string;
}
export class MemberPayoutView{
 @ApiProperty() qualificationNo!:string;
 @ApiProperty({type:[MemberPaymentResultView]}) items!:MemberPaymentResultView[];
 @ApiProperty() total!:number;
 @ApiProperty() offset!:number;
 @ApiProperty({type:Number,nullable:true}) nextOffset!:number|null;
 @ApiProperty() asOf!:string;
}
