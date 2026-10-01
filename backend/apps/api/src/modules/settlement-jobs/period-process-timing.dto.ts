import {ApiProperty} from '@nestjs/swagger';

export class PeriodProcessTimingDto {
 @ApiProperty({enum:['RECORDED','UNAVAILABLE'],description:'Availability of actual durable Outbox process-status entry evidence; not overall compensation-stage or dependency-wait timing'})
 status!:'RECORDED'|'UNAVAILABLE';
 @ApiProperty({type:String,format:'date-time',nullable:true,description:'Actual database-recorded status entry; null for unknown legacy, missing or inconsistent evidence'})
 enteredAt!:string|null;
 @ApiProperty({type:'integer',minimum:0,nullable:true,description:'Whole seconds in the current process status at dataThrough; null when entry evidence is unavailable'})
 elapsedSeconds!:number|null;
 @ApiProperty({enum:['DURABLE_PROCESS_TRANSITION']})
 basis!:'DURABLE_PROCESS_TRANSITION';
}
