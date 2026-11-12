import {ConflictException,Injectable} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {IdempotencyService} from '../../common/idempotency/idempotency.service';
import {requestHash} from '../../common/utils/hash';
import {OrderService} from '../order/order.service';
import {SponsorResolver,saveSponsorSelection} from '../qualification/sponsor-resolver.service';
import {EnrollmentBundleInput} from './enrollment-bundle.dto';
import {activeBundle,bundleReceipt,ownedApplication,sponsorLabel} from './bundle-read';

function assertMutable(app:Awaited<ReturnType<typeof ownedApplication>>) {
  if(!['DRAFT','NEEDS_MORE_INFO'].includes(app.status)||!['NETWORK_MEMBER','FORMAL_PENDING'].includes(app.membershipState)
    ||app.personStatus!=='EFFECTIVE'||app.securityStatus!=='NORMAL'){
    throw new ConflictException({code:'FORMAL_APPLICATION_NOT_EDITABLE',message:'此申請目前無法變更資格訂單，請重新查詢申請進度。'});
  }
}

@Injectable()
export class EnrollmentBundleService {
  constructor(private readonly db:PrismaService,private readonly orders:OrderService,private readonly idem:IdempotencyService,
    private readonly audit:AuditService){}

  read(personId:string,applicationId:string){
    return this.db.$transaction(async tx=>{
      await ownedApplication(tx,personId,applicationId);
      const existing=await activeBundle(tx,applicationId);
      return existing?bundleReceipt(tx,existing.bundleId,applicationId):null;
    },{isolationLevel:'RepeatableRead'});
  }

  async create(personId:string,applicationId:string,input:EnrollmentBundleInput,key:string,requestId:string){
    const operation={applicationId,...JSON.parse(JSON.stringify(input))},hash=requestHash(operation);
    try {
      return await this.idem.execute('member:enrollment-bundle:'+personId,key,operation,async tx=>{
        const app=await ownedApplication(tx,personId,applicationId,true);
        const existing=await activeBundle(tx,applicationId);
        if(existing){
          if(existing.requestHash!==hash)throw new ConflictException({code:'ENROLLMENT_BUNDLE_EXISTS',message:'本次申請已送出一組訂單，請查看原訂單。'});
          return bundleReceipt(tx,existing.bundleId,applicationId);
        }
        assertMutable(app);
        const [prior]=await tx.$queryRaw<{orderId:string}[]>`
          SELECT o.order_id AS "orderId" FROM commerce.package_purchase_snapshot s
          JOIN commerce."order" o ON o.order_id=s.order_id
          WHERE s.person_id=${personId}::uuid AND s.package_class='QUALIFICATION'
            AND (o.status IN ('PAID','FULFILLED','PARTIAL_RETURN') OR
              (o.status='CONFIRMED' AND (s.payment_deadline IS NULL OR s.payment_deadline>now())))
          LIMIT 1`;
        if(prior)throw new ConflictException({code:'FORMAL_ENROLLMENT_ORDER_EXISTS',message:'此申請已有資格套組訂單，請先處理原訂單。'});
        const bundleId=randomUUID();
        await tx.$executeRaw`INSERT INTO membership.enrollment_bundle(bundle_id,application_id,person_id,request_hash)
          VALUES(${bundleId}::uuid,${applicationId}::uuid,${personId}::uuid,${hash})`;
        const shipping={fulfillmentMethod:input.fulfillmentMethod,deliveryUpdatedAt:input.deliveryUpdatedAt};
        let rootTree:string|undefined;
        for (const [index,ball] of input.balls.entries()){
          const position=index+1;
          const qualification=await this.orders.createPackageInTransaction(tx,{...ball.qualification,...shipping,
            sponsorCode:index===0?input.sponsorCode?.trim():undefined},requestId,personId,undefined,'QUALIFICATION');
          const qualificationId=qualification.qualificationId;
          if(!qualificationId)throw new ConflictException({code:'PACKAGE_ORDER_QUALIFICATION_MISSING'});
          if(position===1){
            rootTree=(await tx.ballNoAllocation.findUnique({where:{qualificationId},select:{binaryTreeId:true}}))?.binaryTreeId;
          }else if(rootTree){
            const [allocated]=await tx.$queryRaw<{ballNo:string}[]>`SELECT organization.allocate_ball_no(${rootTree}::uuid,${qualificationId}::uuid) AS "ballNo"`;
            await tx.qualification.update({where:{qualificationId},data:{ballNo:allocated.ballNo}});
          }
          const repurchase=ball.repurchase?await this.orders.createPackageInTransaction(tx,{...ball.repurchase,...shipping,
            targetQualificationId:qualificationId},requestId,personId,undefined,'ACTIVE_DURATION'):null;
          await tx.$executeRaw`INSERT INTO membership.enrollment_bundle_ball(bundle_id,position,qualification_id,qualification_order_id,repurchase_order_id)
            VALUES(${bundleId}::uuid,${position},${qualificationId}::uuid,${qualification.orderId}::uuid,${repurchase?.orderId??null}::uuid)`;
        }
        await this.audit.write(tx,{actorType:'MEMBER',actorId:personId,action:'ENROLLMENT_BUNDLE_CREATED',entityType:'ENROLLMENT_BUNDLE',
          entityId:bundleId,requestId,correlationId:bundleId,afterData:{applicationId,ballCount:input.balls.length,requestHash:hash}});
        return bundleReceipt(tx,bundleId,applicationId);
      },{timeout:120000,retryOnConflict:true});
    } catch(error){
      if(['P2002','P2034','23505','40001'].includes((error as any).code)||['23505','40001'].includes((error as any).meta?.code)){
        throw new ConflictException({code:'RETRYABLE_CONFLICT',message:'訂單正在更新，請以原訂單再試一次。'});
      }
      throw error;
    }
  }

  sponsorCandidate(personId:string,applicationId:string,code:string) {
    return this.db.$transaction(async tx=>{
      const app=await ownedApplication(tx,personId,applicationId);
      if(!['DRAFT','NEEDS_MORE_INFO','SUBMITTED','UNDER_REVIEW'].includes(app.status)||app.personStatus!=='EFFECTIVE'||app.securityStatus!=='NORMAL')
        throw new ConflictException({code:'BUNDLE_SPONSOR_UNAVAILABLE'});
      const evidence=await new SponsorResolver(this.db).resolveWithin(tx,{code});
      const label=await sponsorLabel(tx,Prisma.sql`${evidence.sponsorQualificationId}::uuid`);
      return {ballNo:evidence.kind==='COMPANY_ALIAS'?code.trim().toUpperCase():label?.ballNo,name:label?.name??evidence.displayLabel??null};
    },{isolationLevel:'RepeatableRead'});
  }

  setRootSponsor(personId:string,applicationId:string,sponsorCode:string,key:string,requestId:string) {
    const code=sponsorCode.trim().toUpperCase();
    return this.idem.execute('member:enrollment-bundle:sponsor:'+personId,key,{applicationId,code},async tx=>{
      const app=await ownedApplication(tx,personId,applicationId,true);
      if(!['DRAFT','NEEDS_MORE_INFO','SUBMITTED','UNDER_REVIEW'].includes(app.status)||
        app.personStatus!=='EFFECTIVE'||app.securityStatus!=='NORMAL')throw new ConflictException({code:'FORMAL_APPLICATION_NOT_EDITABLE'});
      const [root]=await tx.$queryRaw<{bundleId:string;qualificationId:string;reportedAt:Date|null}[]>`
        SELECT b.bundle_id AS "bundleId",r.qualification_id AS "qualificationId",report.paid_at AS "reportedAt"
        FROM membership.enrollment_bundle b JOIN membership.enrollment_bundle_ball r ON r.bundle_id=b.bundle_id AND r.position=1
        JOIN membership.qualification q ON q.qualification_id=r.qualification_id
        LEFT JOIN commerce.enrollment_bundle_payment_report report ON report.bundle_id=b.bundle_id
        WHERE b.application_id=${applicationId}::uuid AND b.superseded_at IS NULL AND q.status='DRAFT'
          AND NOT EXISTS (SELECT 1 FROM commerce.enrollment_bundle_payment p WHERE p.bundle_id=b.bundle_id)
          AND NOT EXISTS (SELECT 1 FROM membership.enrollment_bundle_ball row JOIN commerce."order" o ON o.order_id=row.qualification_order_id
            JOIN commerce.package_purchase_snapshot s ON s.order_id=o.order_id
            WHERE row.bundle_id=b.bundle_id AND (o.status<>'CONFIRMED' OR o.paid_at IS NOT NULL OR s.payment_deadline<=coalesce(report.paid_at,now())))
        FOR UPDATE OF b,q`;
      if(!root)throw new ConflictException({code:'BUNDLE_SPONSOR_UNAVAILABLE',message:'本組訂單已收款、失效或已安置，無法補填推薦球。'});
      const at=new Date(),resolver=new SponsorResolver(this.db);
      const sponsor=await resolver.resolveWithin(tx,{code,effectiveAt:at});
      if(root.reportedAt){
        const asOfTransfer=await resolver.resolveWithin(tx,{code,effectiveAt:root.reportedAt});
        if(asOfTransfer.sponsorQualificationId!==sponsor.sponsorQualificationId)throw new ConflictException({code:'SPONSOR_CODE_INELIGIBLE'});
      }
      const setup=await tx.qualificationSetup.findUnique({where:{qualificationId:root.qualificationId}});
      const relation=await tx.sponsorRelationship.findUnique({where:{childQualificationId:root.qualificationId}});
      const evidence=await tx.qualificationSponsorSelectionEvidence.findFirst({where:{qualificationId:root.qualificationId},orderBy:{selectedAt:'desc'},select:{selectedSponsorQualificationId:true}});
      const bound=[relation?.sponsorQualificationId,setup?.finalSponsorQualificationId,evidence?.selectedSponsorQualificationId].filter(Boolean);
      if(bound.length){
        if(bound.every(id=>id===sponsor.sponsorQualificationId))return bundleReceipt(tx,root.bundleId,applicationId);
        throw new ConflictException({code:'BUNDLE_ROOT_SPONSOR_EXISTS',message:'本組已有推薦球，請回到訂單核對。'});
      }
      const allocation=await tx.ballNoAllocation.findUnique({where:{qualificationId:root.qualificationId}});
      if(allocation){
        const member=await tx.binaryTreeMembership.findUnique({where:{qualificationId:sponsor.sponsorQualificationId}});
        if(allocation.binaryTreeId!==member?.binaryTreeId)throw new ConflictException({code:'BALL_ALLOCATION_TREE_MISMATCH',message:'推薦球與已編號的根球位於不同組織樹。'});
      }
      await saveSponsorSelection(tx,{qualificationId:root.qualificationId,sponsorId:sponsor.sponsorQualificationId,
        ownerId:sponsor.sponsorOwnerPersonId,personId,at,policyVersion:sponsor.policyVersion??sponsor.ruleVersion,correlationId:root.bundleId});
      await this.audit.write(tx,{actorType:'MEMBER',actorId:personId,action:'ENROLLMENT_BUNDLE_ROOT_SPONSOR_SET',
        entityType:'ENROLLMENT_BUNDLE',entityId:root.bundleId,requestId,correlationId:root.bundleId,
        afterData:{applicationId,qualificationId:root.qualificationId,sponsorKind:sponsor.kind}});
      return bundleReceipt(tx,root.bundleId,applicationId);
    },{retryOnConflict:true});
  }

  release(personId:string,applicationId:string,bundleId:string,key:string,requestId:string) {
    return this.idem.execute('member:enrollment-bundle:release:'+personId,key,{applicationId,bundleId},async tx=>{
      const app=await ownedApplication(tx,personId,applicationId,true);
      assertMutable(app);
      const existing=await activeBundle(tx,applicationId);
      if(existing?.bundleId!==bundleId)throw new ConflictException({code:'ENROLLMENT_BUNDLE_CHANGED',message:'訂單已變更，請重新查詢。'});
      await tx.$queryRaw`SELECT bundle_id FROM membership.enrollment_bundle WHERE bundle_id=${bundleId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT o.order_id FROM commerce."order" o JOIN membership.enrollment_bundle_ball b
        ON o.order_id IN (b.qualification_order_id,b.repurchase_order_id) WHERE b.bundle_id=${bundleId}::uuid ORDER BY o.order_id FOR UPDATE OF o`;
      const receipt=await bundleReceipt(tx,bundleId,applicationId);
      if(!receipt.mayRestart)throw new ConflictException({code:'ENROLLMENT_BUNDLE_CANNOT_RELEASE',message:'本組尚未到期或已有付款、配貨紀錄，請聯絡承辦人核對。'});
      const ids=receipt.balls.flatMap(b=>b.repurchase?[b.qualification.orderId,b.repurchase.orderId]:[b.qualification.orderId]);
      const at=new Date();
      for(const ball of receipt.balls.filter(b=>b.qualificationStatus==='DRAFT')){
        await tx.qualification.update({where:{qualificationId:ball.qualificationId},data:{status:'VOIDED',activeFlag:false}});
        await tx.qualificationStatusHistory.updateMany({where:{qualificationId:ball.qualificationId,effectiveTo:null},data:{effectiveTo:at}});
        await tx.qualificationStatusHistory.create({data:{qualificationId:ball.qualificationId,status:'VOIDED',effectiveFrom:at,sourceType:'ENROLLMENT_BUNDLE_EXPIRED',sourceId:bundleId}});
      }
      const coupons=await tx.couponRedemption.findMany({where:{orderId:{in:ids},order:{status:'CONFIRMED'}},select:{orderId:true}});
      await tx.order.updateMany({where:{orderId:{in:ids},status:'CONFIRMED'},data:{status:'VOIDED'}});
      if(coupons.length)await tx.couponUsageEvent.createMany({data:coupons.map(c=>({orderId:c.orderId,kind:'VOIDED'}))});
      await tx.$executeRaw`UPDATE membership.enrollment_bundle SET superseded_at=${at} WHERE bundle_id=${bundleId}::uuid AND superseded_at IS NULL`;
      await this.audit.write(tx,{actorType:'MEMBER',actorId:personId,action:'ENROLLMENT_BUNDLE_RELEASED',entityType:'ENROLLMENT_BUNDLE',
        entityId:bundleId,requestId,correlationId:bundleId,afterData:{applicationId,orderIds:ids,reason:'UNPAID_EXPIRED'}});
      return {bundleId,status:'RELEASED'};
    },{timeout:120000,retryOnConflict:true});
  }
}
