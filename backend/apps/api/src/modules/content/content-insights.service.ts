import {Injectable} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {QualificationAccessService} from '../auth/qualification-access.service';

@Injectable()
export class ContentInsightsService {
 constructor(private readonly db:PrismaService,private readonly access:QualificationAccessService){}
 async read(personId?:string,qualificationId?:string,now=new Date()){
  if(personId)await this.access.assertHolder(personId,qualificationId!);
  const since=new Date(now.getTime()-30*86400000);
  const scope=qualificationId?Prisma.sql`AND l.referrer_qualification_id=${qualificationId}::uuid`:Prisma.empty;
  // All joins are aggregated by identity first, so repeat visits cannot multiply registrations.
  const rows=await this.db.$queryRaw<any[]>(Prisma.sql`
   WITH links AS (
    SELECT l.*,m.content_id FROM identity.referral_link l
    LEFT JOIN integration.content_share_link m USING(referral_link_id)
    WHERE l.created_at>=${since} AND l.created_at<=${now} ${scope}
   ), touches AS (
    SELECT l.referral_link_id,h.referral_attribution_id,min(h.occurred_at) first_touch
    FROM links l JOIN identity.referral_attribution_history h USING(referral_link_id)
    WHERE h.action IN ('CREATED','TOUCH_RECORDED','REPLACED')
      AND h.new_referrer_qualification_id=l.referrer_qualification_id
    GROUP BY l.referral_link_id,h.referral_attribution_id
   ), members AS (
    SELECT DISTINCT t.referral_link_id,h.bound_person_id,
      p.created_at>=t.first_touch AND p.created_at<=h.occurred_at AS is_new
    FROM touches t JOIN links l USING(referral_link_id)
    JOIN identity.referral_attribution_history h ON h.referral_attribution_id=t.referral_attribution_id
      AND h.action='BOUND_TO_PERSON' AND h.new_referrer_qualification_id=l.referrer_qualification_id
      AND h.occurred_at>=t.first_touch AND h.occurred_at<=t.first_touch+interval '30 days'
    JOIN identity.person p ON p.person_id=h.bound_person_id
   ), visitor_counts AS (
    SELECT l.content_id,count(DISTINCT t.referral_attribution_id)::int visitors
    FROM links l JOIN touches t USING(referral_link_id) GROUP BY l.content_id
   ), member_counts AS (
    SELECT l.content_id,count(DISTINCT m.bound_person_id)::int bound_members,
     count(DISTINCT m.bound_person_id) FILTER(WHERE m.is_new)::int registrations
    FROM links l JOIN members m USING(referral_link_id) GROUP BY l.content_id
   )
   SELECT l.content_id AS "contentId",
    (SELECT v.title FROM integration.content_version v WHERE v.content_id=l.content_id AND v.status='PUBLISHED' AND v.approved_at IS NOT NULL
      AND (v.publish_from IS NULL OR v.publish_from<=${now}) ORDER BY v.version DESC LIMIT 1) title,
    count(DISTINCT l.referral_link_id)::int links,
    coalesce(vc.visitors,0)::int visitors,
    coalesce(mc.bound_members,0)::int "boundMembers",
    coalesce(mc.registrations,0)::int registrations
   FROM links l LEFT JOIN visitor_counts vc ON vc.content_id IS NOT DISTINCT FROM l.content_id
   LEFT JOIN member_counts mc ON mc.content_id IS NOT DISTINCT FROM l.content_id
   GROUP BY l.content_id,vc.visitors,mc.bound_members,mc.registrations ORDER BY visitors DESC,links DESC`);
  const orderScope=qualificationId?Prisma.sql`AND s.referrer_qualification_id=${qualificationId}::uuid`:Prisma.empty;
  const orders=await this.db.$queryRaw<{orders:number}[]>(Prisma.sql`
   SELECT count(DISTINCT s.order_id)::int orders FROM commerce.retail_referral_order_line_snapshot s
   JOIN commerce."order" o ON o.order_id=s.order_id
   WHERE s.retail_referral_enabled=true AND s.referrer_qualification_id IS NOT NULL
    AND o.paid_at>=${since} AND o.paid_at<=${now}
    AND o.status IN ('PAID','FULFILLED','PARTIAL_RETURN') ${orderScope}`);
  const links=qualificationId?await this.db.referralLink.findMany({where:{referrerQualificationId:qualificationId,createdAt:{gte:since}},orderBy:{createdAt:'desc'},take:50,select:{referralLinkId:true,status:true,createdAt:true,expiresAt:true}}):[];
  return {since:since.toISOString(),asOf:now.toISOString(),rows,officialPaidOrders:orders[0]?.orders??0,links:links.map(l=>({id:l.referralLinkId,status:l.expiresAt<=now?'EXPIRED':l.status,createdAt:l.createdAt.toISOString(),expiresAt:l.expiresAt.toISOString()}))};
 }
}
