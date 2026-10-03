import {BadRequestException,Injectable} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {maturedPayableSourceSql} from '../settlement-jobs/matured-payable-source-query';
@Injectable()
export class MaturedPayableSourcesService{
 constructor(private readonly db:PrismaService){}
 async list(input:{thresholdHours:number;take?:number;cursor?:string;asOf?:string}){
  const take=input.take??25,now=new Date(),asOf=input.asOf?new Date(input.asOf):now;
  if(!Number.isInteger(input.thresholdHours)||input.thresholdHours<1||input.thresholdHours>8760||!Number.isInteger(take)||take<1||take>100||!Number.isFinite(asOf.getTime())||asOf>now||input.cursor&&!/^MATURED-AWARD-[a-f0-9]{40}$/.test(input.cursor))throw new BadRequestException({code:'MATURED_PAYABLE_SOURCE_QUERY_INVALID'});
  const cutoff=new Date(asOf.getTime()-input.thresholdHours*3600000);
  return this.db.$transaction(async tx=>{
   const rows=await tx.$queryRaw<Array<{reference:string;source_type:string;award_type:string;qualification_no:bigint;amount:Prisma.Decimal;matures_at:Date;rule_version_code:string;created_at:Date}>>`
    WITH sources AS (${maturedPayableSourceSql(cutoff,asOf)}), public_sources AS (
     SELECT 'MATURED-AWARD-'||substr(encode(sha256(convert_to('{"id":"'||s.source_type||':'||s.source_id::text||'","kind":"MATURED-AWARD"}','UTF8')),'hex'),1,40) reference,
      s.source_type,s.award_type,q.qualification_no,s.amount,s.matures_at,s.rule_version_code,s.created_at
     FROM sources s JOIN membership.qualification q ON q.qualification_id=s.qualification_id
    ) SELECT * FROM public_sources WHERE (${input.cursor??null}::text IS NULL OR reference>${input.cursor??null}) ORDER BY reference LIMIT ${take+1}`;
   const page=rows.slice(0,take);
   return {items:page.map(row=>({reference:row.reference,sourceType:row.source_type,awardType:row.award_type,qualificationNo:row.qualification_no.toString(),amount:row.amount.toFixed(4),maturesAt:row.matures_at.toISOString(),ruleVersionCode:row.rule_version_code,recordedAt:row.created_at.toISOString()})),nextCursor:rows.length>take?page[page.length-1].reference:null,asOf:asOf.toISOString(),dataThrough:now.toISOString(),cutoff:cutoff.toISOString(),thresholdHours:input.thresholdHours,coverage:'CURRENT_PAGE_ONLY' as const};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
 }
}
