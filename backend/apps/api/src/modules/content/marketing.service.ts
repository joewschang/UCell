import {ConflictException,Injectable,NotFoundException,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService,appendMemberMessage,memberMessageText} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {IdempotencyService} from '../../common/idempotency/idempotency.service';
import {QualificationAccessService} from '../auth/qualification-access.service';

export const marketingSegments=['ALL','START','REACH','CONNECT','CELEBRATE'] as const;
export function marketingSegment(row:{links:number;visitors:number;registrations:number}){
 return row.registrations>0?'CELEBRATE':row.visitors>0?'CONNECT':row.links>0?'REACH':'START';
}
@Injectable()
export class MarketingService{
 constructor(private db:PrismaService,private access:QualificationAccessService,private idempotency:IdempotencyService,private audit:AuditService){}
 async read(input:{search?:string;segment?:string;page?:number}={},qualificationId?:string,now=new Date()){
  const search=input.search?.trim()??'',segment=input.segment??'ALL',page=input.page??1;
  if(search.length>50||!marketingSegments.includes(segment as any)||!Number.isInteger(page)||page<1||page>100000)throw new UnprocessableEntityException('MARKETING_FILTER_INVALID');
  const since=new Date(now.getTime()-30*86400000),scope=qualificationId?Prisma.sql`AND q.qualification_id=${qualificationId}::uuid`:Prisma.empty;
  // One statement gives the cards and paged list the same database snapshot.
  // Outcomes are deduplicated across links; cohort is links created in the last 30 days.
  const result=await this.db.$queryRaw<any[]>(Prisma.sql`
   WITH eligible AS (
    SELECT q.qualification_id,q.ball_no,p.person_id,p.member_no
    FROM membership.qualification q JOIN identity.person p ON p.person_id=q.current_holder_person_id
    WHERE q.kind='MEMBER_ORIGIN' AND q.status='EFFECTIVE' AND p.membership_state='FORMAL_MEMBER' ${scope}
   ), links AS (
    SELECT l.* FROM identity.referral_link l JOIN eligible e ON e.qualification_id=l.referrer_qualification_id
    WHERE l.created_at>=${since} AND l.created_at<=${now}
   ), touches AS (
    SELECT l.referrer_qualification_id,l.referral_link_id,h.referral_attribution_id,min(h.occurred_at) first_touch
    FROM links l JOIN identity.referral_attribution_history h USING(referral_link_id)
    WHERE h.action IN ('CREATED','TOUCH_RECORDED','REPLACED') AND h.new_referrer_qualification_id=l.referrer_qualification_id AND h.occurred_at<=${now}
    GROUP BY l.referrer_qualification_id,l.referral_link_id,h.referral_attribution_id
   ), members AS (
    SELECT DISTINCT t.referrer_qualification_id,h.bound_person_id,p.created_at>=t.first_touch AND p.created_at<=h.occurred_at is_new
    FROM touches t JOIN identity.referral_attribution_history h USING(referral_attribution_id)
    JOIN identity.person p ON p.person_id=h.bound_person_id
    WHERE h.action='BOUND_TO_PERSON' AND h.new_referrer_qualification_id=t.referrer_qualification_id
     AND h.occurred_at>=t.first_touch AND h.occurred_at<=t.first_touch+interval '30 days' AND h.occurred_at<=${now}
   ), link_stats AS (
    SELECT referrer_qualification_id,count(*)::int links,max(created_at) last_shared_at FROM links GROUP BY referrer_qualification_id
   ), touch_stats AS (
    SELECT referrer_qualification_id,count(DISTINCT referral_attribution_id)::int visitors FROM touches GROUP BY referrer_qualification_id
   ), member_stats AS (
    SELECT referrer_qualification_id,count(DISTINCT bound_person_id)::int bound_members,count(DISTINCT bound_person_id) FILTER(WHERE is_new)::int registrations FROM members GROUP BY referrer_qualification_id
   ), stats AS (
    SELECT e.qualification_id::text id,e.ball_no "ballNo",e.member_no "memberNo",
     coalesce(ls.links,0) links,coalesce(ts.visitors,0) visitors,coalesce(ms.bound_members,0) "boundMembers",coalesce(ms.registrations,0) registrations,ls.last_shared_at "lastSharedAt",
     n.published_at "lastEncouragedAt",n.body "lastMessage",nr.read_at "readAt"
    FROM eligible e LEFT JOIN link_stats ls ON ls.referrer_qualification_id=e.qualification_id
    LEFT JOIN touch_stats ts ON ts.referrer_qualification_id=e.qualification_id
    LEFT JOIN member_stats ms ON ms.referrer_qualification_id=e.qualification_id
    LEFT JOIN LATERAL (
     SELECT notification_id,published_at,body FROM integration.member_notification
     WHERE person_id=e.person_id AND source_type='SHARE_ENCOURAGEMENT' ORDER BY published_at DESC LIMIT 1
    ) n ON true LEFT JOIN integration.member_notification_read nr ON nr.notification_id=n.notification_id AND nr.person_id=e.person_id
   ), classified AS (
    SELECT *,CASE WHEN registrations>0 THEN 'CELEBRATE' WHEN visitors>0 THEN 'CONNECT' WHEN links>0 THEN 'REACH' ELSE 'START' END segment FROM stats
   ), filtered AS (
    SELECT * FROM classified WHERE (${search}='' OR position(lower(${search}) in lower(coalesce("ballNo",'')||' '||"memberNo"))>0)
     AND (${segment}='ALL' OR segment=${segment})
   )
   SELECT json_build_object(
    'since',${since}::timestamptz,'asOf',${now}::timestamptz,'page',${page}::int,'pageSize',25,
    'summary',json_build_object('balls',(SELECT count(*)::int FROM eligible),'members',(SELECT count(DISTINCT person_id)::int FROM eligible),
     'sharingBalls',(SELECT count(*)::int FROM stats WHERE links>0),'links',(SELECT count(*)::int FROM links),
     'visitors',(SELECT count(DISTINCT referral_attribution_id)::int FROM touches),
     'boundMembers',(SELECT count(DISTINCT bound_person_id)::int FROM members),
     'registrations',(SELECT count(DISTINCT bound_person_id)::int FROM members WHERE is_new)),
    'segments',(SELECT coalesce(json_object_agg(segment,total),'{}'::json) FROM (SELECT segment,count(*)::int total FROM classified GROUP BY segment) c),
    'total',(SELECT count(*)::int FROM filtered),
    'rows',(SELECT coalesce(json_agg(r),'[]'::json) FROM (SELECT * FROM filtered ORDER BY registrations DESC,visitors DESC,links DESC,"ballNo" NULLS LAST,id LIMIT 25 OFFSET ${(page-1)*25}) r)
   ) data`);
  return result[0].data;
 }
 async personal(personId:string,qualificationId:string){await this.access.assertHolder(personId,qualificationId);return this.read({},qualificationId);}
 async encourage(input:{qualificationId:string;memberNo:string;body:string},actor:string,key:string,requestId:string){
  const body=input.body?.trim();
  if(!body||body.length>600||memberMessageText(body)!==body||!/^\d{10}$/.test(input.memberNo))throw new UnprocessableEntityException('MARKETING_MESSAGE_INVALID');
  for(let attempt=0;;attempt++)try{
   return (await this.idempotency.execute(`admin:marketing:encourage:${actor}`,key,{...input,body},async tx=>{
    // Lock qualification and recipient: transfers cannot silently change the selected recipient,
    // and multiple balls/admins share one seven-day per-person cooldown.
    await tx.$queryRaw(Prisma.sql`SELECT qualification_id FROM membership.qualification WHERE qualification_id=${input.qualificationId}::uuid FOR UPDATE`);
    const q=await tx.qualification.findUnique({where:{qualificationId:input.qualificationId},include:{currentHolder:true}});
    if(!q||q.kind!=='MEMBER_ORIGIN'||q.status!=='EFFECTIVE'||!q.currentHolder||q.currentHolder.memberNo!==input.memberNo||q.currentHolder.membershipState!=='FORMAL_MEMBER')throw new NotFoundException('MARKETING_RECIPIENT_CHANGED');
    await tx.$queryRaw(Prisma.sql`SELECT person_id FROM identity.person WHERE person_id=${q.currentHolderPersonId}::uuid FOR UPDATE`);
    const now=new Date(),last=await tx.memberNotification.findFirst({where:{personId:q.currentHolderPersonId!,sourceType:'SHARE_ENCOURAGEMENT'},orderBy:{publishedAt:'desc'}});
    if(last&&last.publishedAt.getTime()>now.getTime()-7*86400000)throw new ConflictException({code:'MARKETING_COOLDOWN',message:'這位會員近七天已收到鼓勵，請先等待回應。'});
    const message=await appendMemberMessage(tx,{messageKey:`sharing:${actor}:${key}`,personId:q.currentHolderPersonId!,category:'SERVICE',title:'分享路上，為您加油',body,sourceType:'SHARE_ENCOURAGEMENT',sourceReference:`SHARING:${q.ballNo??input.memberNo}`,publishedAt:now});
    await this.audit.write(tx,{actorType:'USER',actorId:actor,action:'SHARE_ENCOURAGEMENT_CREATED',entityType:'MemberNotification',entityId:message.notificationId,afterData:{memberNo:input.memberNo,ballNo:q.ballNo,channel:'UCELL_PERSONAL'},requestId,correlationId:randomUUID()});
    return {status:'CREATED',memberNo:input.memberNo,publishedAt:now.toISOString(),channel:'UCELL_PERSONAL'};
   })).value;
  }catch(error){if(attempt<3&&['P2034','P2002'].includes((error as any)?.code))continue;throw error;}
 }
}
