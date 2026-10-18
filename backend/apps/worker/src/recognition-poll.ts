import {PrismaService,emitStructuredOperationalError,isRecognitionTransactionConflict} from '@ucell/database';
import {randomUUID} from 'node:crypto';

/** Persist recovery independently of the aborted financial transaction. Unknown
 * outcomes and business failures require manual investigation, never auto replay.
 * The original schedule and financial uniqueness constraints remain authoritative. */
export async function pollRecognitionQueue(db:PrismaService,process:(id:string,db:PrismaService)=>Promise<unknown>,now=new Date()){
 const rows=await db.monthlyRecognitionSchedule.findMany({
  where:{status:{in:['SCHEDULED','DUE']},dueAt:{lte:now},workerBlocked:false,OR:[{workerNextAttemptAt:null},{workerNextAttemptAt:{lte:now}}]},
  orderBy:[{dueAt:'asc'},{recognitionId:'asc'}],take:20
 });
 for(const row of rows){
  try{await process(row.recognitionId,db);}
  catch(error){
   const conflict=isRecognitionTransactionConflict(error),failures=row.workerFailureCount+1;
   const blocked=!conflict||failures>=5,traceId=randomUUID();
   const errorCode=conflict?'RECOGNITION_TRANSACTION_CONFLICT':'RECOGNITION_REVIEW_REQUIRED';
   emitStructuredOperationalError({service:'worker',operation:'processRecognition',traceId,error,errorCode,retryable:!blocked});
   try{
    // A stale poll must not overwrite a successful recognition, cancellation or
    // another poll's newer failure. Only the matching pending generation changes.
    await db.monthlyRecognitionSchedule.updateMany({
     where:{recognitionId:row.recognitionId,status:{in:['SCHEDULED','DUE']},workerFailureCount:row.workerFailureCount,workerBlocked:false},
     data:{workerFailureCount:{increment:1},workerBlocked:blocked,workerNextAttemptAt:blocked?null:new Date(now.getTime()+60000*2**(failures-1)),workerLastFailedAt:now,workerLastErrorCode:errorCode,workerLastTraceId:traceId}
    });
   }catch(persistError){
    emitStructuredOperationalError({service:'worker',operation:'persistRecognitionFailure',traceId,error:persistError,errorCode:'RECOGNITION_FAILURE_RECORD_FAILED',retryable:false});
   }
  }
 }
}
