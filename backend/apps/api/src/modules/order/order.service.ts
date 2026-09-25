import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { randomUUID, createHash } from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { OutboxService } from '../../common/outbox/outbox.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentConfirmationDto } from './dto/payment-confirmation.dto';
import { QualificationAccessService } from '../auth/qualification-access.service';
import { PackageConfigService } from '../package-config/package-config.service';
import { SponsorResolver } from '../qualification/sponsor-resolver.service';
import { OrganizationService } from '../organization/organization.service';
import { RetailReferrerAttributionService } from './retail-referrer-attribution.service';

type MemberOrderInput=Partial<CreateOrderDto>&{packageVersionId?:string;targetQualificationId?:string;sponsorCode?:string;retailReferralCode?:string;selections?:Array<{productRuleProfileId:string;quantity:number}>};

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly packages?: PackageConfigService,
    private readonly sponsors?: SponsorResolver,
    private readonly organization?: OrganizationService,
    private readonly retailAttributions?: RetailReferrerAttributionService,
  ) {}

  async createMember(dto:MemberOrderInput,key:string,requestId:string,personId:string){
    if(dto.packageVersionId)return this.createPackageForPerson(dto,key,requestId,personId);
    if(!dto.items?.length||dto.selections?.length)throw new UnprocessableEntityException({code:'INVALID_ORDER_SHAPE'});
    if(!dto.qualificationId)return this.createWebRetailMember(dto,key,requestId,personId);
    await new QualificationAccessService(this.prisma).assertHolder(personId,dto.qualificationId);
    try{return await this.create({qualificationId:dto.qualificationId,items:dto.items,purpose:'RETAIL',sourceReferralToken:dto.sourceReferralToken,clientReference:dto.clientReference},key,requestId,personId,true);}
    catch(error){if(['P2002','P2034'].includes((error as any).code))throw new ConflictException({code:'RETRYABLE_CONFLICT',message:'Concurrent operation; retry the identical request with the same Idempotency-Key.'});throw error;}
  }

  private async createWebRetailMember(dto:MemberOrderInput,key:string,requestId:string,personId:string){
    if(dto.sponsorCode)throw new UnprocessableEntityException({code:'QUALIFICATION_SPONSOR_CODE_NOT_ALLOWED_FOR_RETAIL'});
    const correlationId=randomUUID();
    try{return await this.idempotency.execute(`member:web-retail-order:create:${personId}`,key,dto,async tx=>{
      const person=await tx.person.findUnique({where:{personId},select:{status:true}});
      if(person?.status!=='EFFECTIVE')throw new ConflictException({code:'MEMBER_PERSON_DISABLED'});
      const ownedEffective=await tx.qualification.count({where:{currentHolderPersonId:personId,status:'EFFECTIVE'}});
      if(ownedEffective)throw new ConflictException({code:'QUALIFIED_MEMBER_RETAIL_REQUIRES_BALL_CONTEXT'});
      const delivery=await tx.deliveryProfile.findFirst({where:{personId,effectiveTo:null},select:{deliveryProfileId:true}});
      if(!delivery)throw new UnprocessableEntityException({code:'DELIVERY_PROFILE_REQUIRED',message:'請先完成配送資料，再建立零售訂單。'});
      const now=new Date(),productIds=[...new Set(dto.items!.map(item=>item.productId))];
      const products=await tx.productReference.findMany({where:{productId:{in:productIds},isActive:true}});
      if(products.length!==productIds.length)throw new ConflictException({code:'RESOURCE_NOT_FOUND'});
      const lines:any[]=[]; let gross=new Prisma.Decimal(0); let ruleVersionCode='R1.0B'; let parameterSnapshotHash:string|undefined;
      for(const item of dto.items!){
        const product=products.find(row=>row.productId===item.productId)!;
        const profiles=await tx.productRuleProfile.findMany({where:{productId:product.productId,effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},orderBy:{effectiveFrom:'desc'}});
        if(profiles.length!==1)throw new UnprocessableEntityException({code:'RULE_PROFILE_CONFIGURATION_PENDING'});
        const profile=profiles[0];
        const quantity=new Prisma.Decimal(item.quantity);
        if(!quantity.isInteger()||quantity.lte(0)||quantity.gt(99)||product.currentPrice.lt(0))throw new UnprocessableEntityException({code:'INVALID_PRODUCT_QUANTITY_OR_PRICE'});
        const lineAmount=product.currentPrice.mul(quantity); gross=gross.add(lineAmount); ruleVersionCode=profile.ruleVersionCode; parameterSnapshotHash=profile.parameterSnapshotHash??parameterSnapshotHash;
        lines.push({productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity,unitPrice:product.currentPrice,lineAmount,gpvRateSnapshot:new Prisma.Decimal(0),gpvAmountSnapshot:new Prisma.Decimal(0),pvRateSnapshot:new Prisma.Decimal(0),ruleProfileSnapshot:{profileId:profile.productRuleProfileId,ruleVersionCode:profile.ruleVersionCode,parameterSnapshotHash:profile.parameterSnapshotHash,pricingContext:'WEB_MEMBER_RETAIL_LIST_PRICE',retailReferral:{enabled:profile.retailReferralEnabled,calculationType:profile.retailReferralCalculationType,rate:profile.retailReferralRate?.toString()??null,baseType:profile.retailReferralBaseType}}});
      }
      const order=await tx.order.create({data:{purchaserPersonId:personId,purpose:'RETAIL',status:'CONFIRMED',grossAmount:gross,discountAmount:new Prisma.Decimal(0),netAmount:gross,ruleVersionCode,parameterSnapshotHash,clientReference:dto.clientReference,confirmedAt:now,lines:{create:lines}},include:{lines:true}});
      const attribution=await (this.retailAttributions??new RetailReferrerAttributionService(this.prisma,this.sponsors??new SponsorResolver(this.prisma))).resolveForRetailOrder(tx,{personId,candidateCode:dto.retailReferralCode,orderId:order.orderId,at:now,correlationId});
      const profileById=new Map<string,any>();
      for(const item of lines){const profileId=(item.ruleProfileSnapshot as any).profileId;if(!profileById.has(profileId))profileById.set(profileId,await tx.productRuleProfile.findUniqueOrThrow({where:{productRuleProfileId:profileId}}));}
      await tx.retailReferralOrderLineSnapshot.createMany({
        data: order.lines.map(line => {
          const profile=profileById.get((line.ruleProfileSnapshot as any).profileId);
          return {
            orderLineId:line.orderLineId, orderId:order.orderId,
            retailReferrerAttributionId:attribution?.retailReferrerAttributionId,
            referrerQualificationId:attribution?.referrerQualificationId,
            referrerBallNoSnapshot:attribution?.referrerBallNoSnapshot,
            retailReferralEnabled:profile.retailReferralEnabled,
            calculationType:profile.retailReferralCalculationType, rate:profile.retailReferralRate,
            baseType:profile.retailReferralBaseType, netPaidItemAmount:line.lineAmount,
            productRuleProfileId:profile.productRuleProfileId, productRuleVersion:profile.ruleVersionCode,
            parameterSnapshotHash:profile.parameterSnapshotHash,
            attributionEvidence:{attributionId:attribution?.retailReferrerAttributionId??null,source:attribution?.source??'NONE',asOf:now.toISOString()},
          };
        }),
      });
      await this.audit.write(tx,{actorType:'MEMBER',actorId:personId,action:'WEB_MEMBER_RETAIL_ORDER_CREATED',entityType:'ORDER',entityId:order.orderId,afterData:{orderId:order.orderId,personId,qualificationId:null,netAmount:order.netAmount.toString(),retailReferrerBallNo:attribution?.referrerBallNoSnapshot??null},requestId,correlationId});
      await this.outbox.enqueue(tx,{eventType:'WEB_MEMBER_RETAIL_ORDER_CREATED',aggregateType:'ORDER',aggregateId:order.orderId,payload:{schemaVersion:1,orderId:order.orderId,personId,recognitionStatus:'PAYMENT_PENDING'},correlationId});
      return order;
    });}catch(error){if(['P2002','P2034','23P01'].includes((error as any).code))throw new ConflictException({code:'RETRYABLE_CONFLICT'});throw error;}
  }

  async listWebRetailMember(personId:string){
    const orders=await this.prisma.order.findMany({where:{purchaserPersonId:personId,qualificationId:null,purpose:'RETAIL'},select:{orderNo:true,status:true,netAmount:true,createdAt:true,confirmedAt:true,lines:{select:{productNameSnapshot:true,quantity:true}}},orderBy:{createdAt:'desc'},take:100});
    return orders.map(order=>({orderNo:order.orderNo.toString(),status:order.status,total:order.netAmount.toString(),createdAt:order.createdAt.toISOString(),confirmedAt:order.confirmedAt?.toISOString()??null,itemCount:order.lines.reduce((count,line)=>count+Number(line.quantity),0),itemNames:order.lines.map(line=>line.productNameSnapshot)}));
  }
  async createPaperQualification(dto:MemberOrderInput,key:string,requestId:string,actorId:string,paperApplicationId:string){
    const application=await this.prisma.paperApplication.findUnique({where:{paperApplicationId},select:{personId:true}});
    if(!application)throw new ConflictException({code:'PAPER_APPLICATION_NOT_FOUND'});
    return this.createPackageForPerson(dto,key,requestId,application.personId,{scope:`admin:paper-package-order:create:${paperApplicationId}`,actorId,paperApplicationId});
  }

  private async createPackageForPerson(dto:MemberOrderInput,key:string,requestId:string,personId:string,paper?:{scope:string;actorId:string;paperApplicationId:string}){
    if(dto.items?.length||!dto.selections?.length)throw new UnprocessableEntityException({code:'INVALID_PACKAGE_ORDER_SHAPE'});
    const correlationId=randomUUID();
    try{return await this.idempotency.execute(paper?.scope??`member:package-order:create:${personId}`,key,dto,async tx=>{
      const person=await tx.person.findUnique({where:{personId}});
      if(!person || (paper ? !['DRAFT','EFFECTIVE'].includes(person.status) : person.status!=='EFFECTIVE'))throw new ConflictException({code:paper?'PAPER_PERSON_NOT_ELIGIBLE':'MEMBER_PERSON_DISABLED'});
      if(paper){const application=await tx.paperApplication.findUnique({where:{paperApplicationId:paper.paperApplicationId},select:{personId:true,orderId:true,status:true}});if(!application||application.personId!==personId||application.status!=='OPEN')throw new ConflictException({code:'PAPER_APPLICATION_NOT_OPEN'});if(application.orderId)throw new ConflictException({code:'PAPER_APPLICATION_ORDER_ALREADY_CREATED'});}
      const now=new Date(),prepared=await (this.packages??new PackageConfigService(this.prisma)).checkoutData(tx,personId,{packageVersionId:dto.packageVersionId!,targetQualificationId:dto.targetQualificationId,selections:dto.selections!},now),v=prepared.version;
      let qualificationId=dto.targetQualificationId;
      let sponsorEvidence:Awaited<ReturnType<SponsorResolver['resolveWithin']>>|undefined;
      if(v.profile.packageClass==='QUALIFICATION'){
        if(dto.sponsorCode)sponsorEvidence=await (this.sponsors??new SponsorResolver(this.prisma)).resolveWithin(tx as any,{code:dto.sponsorCode,effectiveAt:now,ruleVersion:'R1.0B'});
        const qualification=await tx.qualification.create({data:{currentHolderPersonId:personId,planLevelCode:v.profile.stableCode,status:'DRAFT',activeFlag:false}});qualificationId=qualification.qualificationId;
        await tx.qualificationHolderHistory.create({data:{qualificationId,holderPersonId:personId,effectiveFrom:now,sourceType:'PACKAGE_CHECKOUT'}});
        await tx.qualificationStatusHistory.create({data:{qualificationId,status:'DRAFT',effectiveFrom:now,sourceType:'PACKAGE_CHECKOUT'}});
        if(sponsorEvidence)await tx.qualificationSponsorSelectionEvidence.create({data:{qualificationId,attributionReferrerQualificationId:sponsorEvidence.sponsorQualificationId,selectedSponsorQualificationId:sponsorEvidence.sponsorQualificationId,selectedSponsorOwnerPersonId:sponsorEvidence.sponsorOwnerPersonId,selectedByPersonId:personId,selectedAt:now,source:sponsorEvidence.kind==='COMPANY_ALIAS'?'COMPANY_ALIAS_CANDIDATE_REVALIDATED':'SPONSOR_CODE_CANDIDATE_REVALIDATED',policyVersion:sponsorEvidence.kind==='COMPANY_ALIAS'?sponsorEvidence.policyVersion:sponsorEvidence.ruleVersion,correlationId}});
      }
      if(!qualificationId)throw new UnprocessableEntityException({code:'TARGET_QUALIFICATION_REQUIRED'});
      const order=await tx.order.create({data:{qualificationId,purpose:v.profile.packageClass==='QUALIFICATION'?'ENTRY':'REPURCHASE',status:'CONFIRMED',currency:v.currency,grossAmount:v.priceAmount,discountAmount:new Prisma.Decimal(0),netAmount:v.priceAmount,ruleVersionCode:v.recognitionConfigRef!,parameterSnapshotHash:v.configHash,confirmedAt:now,lines:{create:prepared.selections.map(s=>({productId:s.product.productId,skuSnapshot:s.product.sku,productNameSnapshot:s.product.displayName,quantity:new Prisma.Decimal(s.quantity),unitPrice:new Prisma.Decimal(0),lineAmount:new Prisma.Decimal(0),gpvRateSnapshot:new Prisma.Decimal(0),gpvAmountSnapshot:new Prisma.Decimal(0),pvRateSnapshot:new Prisma.Decimal(0),ruleProfileSnapshot:{profileId:s.profile.productRuleProfileId,packageSelection:true,recognitionConfigRef:v.recognitionConfigRef,packageConfigHash:v.configHash}}))}},include:{lines:true}});
      if(paper)await tx.paperApplication.update({where:{paperApplicationId:paper.paperApplicationId},data:{orderId:order.orderId,status:'ORDER_CREATED'}});
      const snapshot=await tx.packagePurchaseSnapshot.create({data:{orderId:order.orderId,personId,targetQualificationId:dto.targetQualificationId,packageProfileVersionId:v.packageProfileVersionId,packageCode:v.profile.stableCode,packageName:v.displayName,packageClass:v.profile.packageClass,currency:v.currency,priceAmount:v.priceAmount,selectableProductQuantity:v.selectableProductQuantity,membershipEffect:v.membershipEffect,qualificationEffect:v.qualificationEffect,activeDurationUnit:v.activeDurationUnit,activeDurationValue:v.activeDurationValue,recognitionConfigRef:v.recognitionConfigRef!,packageConfigHash:v.configHash,purchasedAt:now,selections:{create:prepared.selections.map(s=>({productRuleProfileId:s.productRuleProfileId,productId:s.product.productId,skuSnapshot:s.product.sku,productDisplaySnapshot:s.product.displayName,quantity:s.quantity,productConfigHash:s.productConfigHash}))}}});
      await this.audit.write(tx,{actorType:paper?'USER':'MEMBER',actorId:paper?.actorId??personId,action:paper?'PAPER_ORDER_CREATED':'PACKAGE_ORDER_CREATED',entityType:'ORDER',entityId:order.orderId,afterData:{orderId:order.orderId,qualificationId,packagePurchaseSnapshotId:snapshot.packagePurchaseSnapshotId,packageCode:v.profile.stableCode,packageClass:v.profile.packageClass,netAmount:v.priceAmount.toString(),sponsorEvidence:sponsorEvidence?(sponsorEvidence.kind==='COMPANY_ALIAS'?{kind:'COMPANY_ALIAS',displayLabel:sponsorEvidence.displayLabel,policyVersion:sponsorEvidence.policyVersion,ruleVersion:sponsorEvidence.ruleVersion,effectiveAt:sponsorEvidence.effectiveAt}:{kind:'BALL',sponsorBallNo:sponsorEvidence.sponsorBallNo,ruleVersion:sponsorEvidence.ruleVersion,effectiveAt:sponsorEvidence.effectiveAt}):null},requestId,correlationId});
      await this.outbox.enqueue(tx,{eventType:'MEMBER_PACKAGE_ORDER_CREATED',aggregateType:'ORDER',aggregateId:order.orderId,payload:{schemaVersion:1,orderId:order.orderId,qualificationId,personId,packagePurchaseSnapshotId:snapshot.packagePurchaseSnapshotId,packageClass:v.profile.packageClass,recognitionStatus:'PAYMENT_PENDING',source:paper?'ADMIN_PAPER_ORDER':'MEMBER'},correlationId});
      return {...order,packagePurchaseSnapshotId:snapshot.packagePurchaseSnapshotId,packageClass:v.profile.packageClass};
    });}catch(error){if(['P2002','P2034'].includes((error as any).code))throw new ConflictException({code:'RETRYABLE_CONFLICT',message:'Concurrent operation; retry the identical request with the same Idempotency-Key.'});throw error;}
  }
  async create(dto: CreateOrderDto, key: string, requestId: string, actorId?: string, member=false) {
    const correlationId = randomUUID();

    return this.idempotency.execute(`${member?'member':'admin'}:order:create:${actorId ?? 'system'}`, key, dto, async (tx) => {
      if(member){
        await new QualificationAccessService(tx as any).assertHolder(actorId!,dto.qualificationId);
        const person=await tx.person.findUnique({where:{personId:actorId}});
        if(person?.status!=='EFFECTIVE')throw new ConflictException({code:'MEMBER_PERSON_DISABLED'});
      }
      const qualification = await tx.qualification.findUnique({
        where: { qualificationId: dto.qualificationId },
      });
      if (!qualification || qualification.status !== 'EFFECTIVE') {
        throw new ConflictException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Qualification不存在或尚未生效。',
        });
      }

      const productIds = [...new Set(dto.items.map(i => i.productId))];
      const products = await tx.productReference.findMany({
        where: { productId: { in: productIds }, isActive: true },
      });

      if (products.length !== productIds.length) {
        throw new ConflictException({
          code: 'RESOURCE_NOT_FOUND',
          message: '部分商品不存在或未啟用。',
        });
      }

      const now = new Date();
      const lines: Array<{
        productId: string;
        skuSnapshot: string;
        productNameSnapshot: string;
        quantity: Prisma.Decimal;
        unitPrice: Prisma.Decimal;
        lineAmount: Prisma.Decimal;
        gpvRateSnapshot: Prisma.Decimal;
        gpvAmountSnapshot: Prisma.Decimal;
        pvRateSnapshot?: Prisma.Decimal;
        ruleProfileSnapshot: Prisma.InputJsonValue;
      }> = [];

      let gross = new Prisma.Decimal(0);
      let ruleVersionCode = 'R1.0B';
      let parameterSnapshotHash: string | undefined;

      for (const item of dto.items) {
        const product = products.find(p => p.productId === item.productId)!;
        const profileQuery:Prisma.ProductRuleProfileFindManyArgs={
          where: {
            productId: item.productId,
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          orderBy: { effectiveFrom: 'desc' },
        };
        const profiles:Prisma.ProductRuleProfileGetPayload<{}>[]=[];
        if(member)profiles.push(...await tx.productRuleProfile.findMany(profileQuery));
        else {const first=await tx.productRuleProfile.findFirst(profileQuery);if(first)profiles.push(first);}
        const profile=profiles[0];
        if(member&&(profiles.length!==1||profile.ruleVersionCode!=='R1.0B'||!profile.parameterSnapshotHash||!/^[a-f0-9]{64}$/.test(profile.parameterSnapshotHash)))throw new UnprocessableEntityException({code:'RULE_PROFILE_CONFIGURATION_PENDING',message:'One traceable effective R1.0B product profile required; no inferred PV/BV mapping.'});

        if (!profile) {
          throw new UnprocessableEntityException({
            code: 'DOMAIN_RULE_VIOLATION',
            message: `商品 ${product.sku} 沒有目前有效的制度Rule Profile。`,
          });
        }

        const quantity = new Prisma.Decimal(item.quantity);
        if(member&&(!quantity.isInteger()||quantity.lte(0)||quantity.gt(99)||product.currentPrice.lt(0)))throw new UnprocessableEntityException({code:'INVALID_PRODUCT_QUANTITY_OR_PRICE'});
        const lineAmount = product.currentPrice.mul(quantity);
        const gpvAmount = lineAmount.mul(profile.gpvRate);

        gross = gross.add(lineAmount);
        ruleVersionCode = profile.ruleVersionCode;
        parameterSnapshotHash = profile.parameterSnapshotHash ?? parameterSnapshotHash;

        lines.push({
          productId: product.productId,
          skuSnapshot: product.sku,
          productNameSnapshot: product.displayName,
          quantity,
          unitPrice: product.currentPrice,
          lineAmount,
          gpvRateSnapshot: profile.gpvRate,
          gpvAmountSnapshot: gpvAmount,
          pvRateSnapshot: profile.pvRate ?? undefined,
          ruleProfileSnapshot: {
            profileId: profile.productRuleProfileId,
            gpvRate: profile.gpvRate.toString(),
            pvRate: profile.pvRate?.toString() ?? null,
            rpvEligible: profile.rpvEligible,
            epvEligible: profile.epvEligible,
            ruleVersionCode: profile.ruleVersionCode,
            parameterSnapshotHash: profile.parameterSnapshotHash,
          },
        });
      }

      const sourceReferralTokenHash = dto.sourceReferralToken
        ? createHash('sha256').update(dto.sourceReferralToken).digest('hex')
        : undefined;

      const order = await tx.order.create({
        data: {
          qualificationId: dto.qualificationId,
          purpose: dto.purpose ?? 'RETAIL',
          status: 'CONFIRMED',
          grossAmount: gross,
          discountAmount: new Prisma.Decimal(0),
          netAmount: gross,
          ruleVersionCode,
          parameterSnapshotHash,
          sourceReferralTokenHash,
          clientReference: dto.clientReference,
          confirmedAt: now,
          lines: { create: lines },
        },
        include: { lines: true },
      });

      await this.audit.write(tx, {
        actorType: actorId ? 'USER' : 'SYSTEM',
        actorId,
        action: 'ORDER_CREATED_CONFIRMED',
        entityType: 'ORDER',
        entityId: order.orderId,
        afterData: {
          orderId: order.orderId,
          qualificationId: order.qualificationId,
          netAmount: order.netAmount.toString(),
          lineCount: order.lines.length,
        },
        requestId,
        correlationId,
      });
      if(member)await this.outbox.enqueue(tx,{eventType:'MEMBER_ORDER_CREATED',aggregateType:'ORDER',aggregateId:order.orderId,payload:{orderId:order.orderId,qualificationId:order.qualificationId,personId:actorId},correlationId});

      return order;
    });
  }

  async confirmPayment(
    orderId: string,
    dto: PaymentConfirmationDto,
    key: string,
    requestId: string,
    actorId?: string,
  ) {
    const correlationId = randomUUID();
    return this.idempotency.execute(`admin:payment:${orderId}`, key, dto, async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderId },
        include: { lines: true },
      });
      if (!order) {
        throw new ConflictException({ code: 'RESOURCE_NOT_FOUND', message: '訂單不存在。' });
      }
      if (order.status === 'PAID' || order.status === 'FULFILLED') {
        throw new ConflictException({ code: 'ORDER_LOCKED', message: '訂單已付款，不可重複確認。' });
      }
      if (order.status !== 'CONFIRMED') {
        throw new ConflictException({ code: 'ORDER_LOCKED', message: '只有CONFIRMED訂單可確認付款。' });
      }

      const amount = new Prisma.Decimal(dto.amount);
      if (!amount.equals(order.netAmount)) {
        throw new UnprocessableEntityException({
          code: 'DOMAIN_RULE_VIOLATION',
          message: '付款金額必須等於訂單應付金額。',
          details: { expected: order.netAmount.toString(), received: amount.toString() },
        });
      }

      const occurredAt = new Date(dto.occurredAt);
      const payment = await tx.paymentEvent.create({
        data: {
          orderId,
          eventType: 'PAYMENT_CONFIRMED',
          amount,
          paymentMethod: dto.paymentMethod,
          referenceNo: dto.referenceNo,
          idempotencyKey: key,
          occurredAt,
          createdBy: actorId,
          correlationId,
        },
      });

      await tx.order.update({
        where: { orderId },
        data: { status: 'PAID', paidAt: occurredAt },
      });

      // Legacy unit harnesses predate the additive package delegate; production Prisma always provides it.
      const packageSnapshot=tx.packagePurchaseSnapshot?await tx.packagePurchaseSnapshot.findUnique({where:{orderId}}):null;
      if(packageSnapshot){
        const packageQualificationId=order.qualificationId;
        if(!packageQualificationId)throw new UnprocessableEntityException({code:'PACKAGE_ORDER_QUALIFICATION_MISSING'});
        let downstreamStatus='RECOGNITION_CONFIGURATION_PENDING';
        if(packageSnapshot.packageClass==='QUALIFICATION'){
          const selected=tx.qualificationSponsorSelectionEvidence?await tx.qualificationSponsorSelectionEvidence.findFirst({where:{qualificationId:packageQualificationId},orderBy:{selectedAt:'desc'}}):null;
          let sponsorQualificationId:string|undefined;
          if(selected){
            const selectedBall=await tx.qualification.findUnique({where:{qualificationId:selected.selectedSponsorQualificationId},select:{ballNo:true}});
            if(!selectedBall?.ballNo)throw new UnprocessableEntityException({code:'SPONSOR_EVIDENCE_INVALID'});
            const resolved=await (this.sponsors??new SponsorResolver(this.prisma)).resolveWithin(tx as any,{code:selectedBall.ballNo,effectiveAt:occurredAt,ruleVersion:'R1.0B'});
            const resolvedSponsorId=resolved.sponsorQualificationId; if(!resolvedSponsorId||resolvedSponsorId!==selected.selectedSponsorQualificationId)throw new UnprocessableEntityException({code:'SPONSOR_EVIDENCE_INVALID'});
            sponsorQualificationId=resolvedSponsorId;
            const sponsorSequenceNo=await (this.organization??new OrganizationService(this.prisma)).allocateSponsorSequence(tx,resolvedSponsorId);
            await tx.sponsorRelationship.create({data:{sponsorQualificationId:resolvedSponsorId,childQualificationId:packageQualificationId,sponsorSequenceNo,effectiveFrom:occurredAt}});
          }
          const placementDueAt=sponsorQualificationId?new Date(occurredAt.getTime()+72*60*60*1000):undefined;
          await tx.qualificationSetup.create({data:{qualificationId:packageQualificationId,ownerPersonId:packageSnapshot.personId,qualifyingOrderId:orderId,packagePurchaseSnapshotId:packageSnapshot.packagePurchaseSnapshotId,packageType:packageSnapshot.packageCode,setupStatus:sponsorQualificationId?'PLACEMENT_PENDING':'BALL_SETUP_PENDING',finalSponsorQualificationId:sponsorQualificationId,placementRequestedAt:sponsorQualificationId?occurredAt:undefined,placementDueAt,setupPolicyVersion:'NR-DEC-004-V1'}});
          downstreamStatus=sponsorQualificationId?'PLACEMENT_PENDING':'BALL_SETUP_PENDING';
        }
        await this.outbox.enqueue(tx,{eventType:'PACKAGE_PAYMENT_CONFIRMED',aggregateType:'ORDER',aggregateId:orderId,correlationId,payload:{schemaVersion:1,eventType:'PACKAGE_PAYMENT_CONFIRMED',orderId,qualificationId:order.qualificationId,packagePurchaseSnapshotId:packageSnapshot.packagePurchaseSnapshotId,packageClass:packageSnapshot.packageClass,occurredAt:occurredAt.toISOString(),recognitionStatus:'CONFIGURATION_PENDING',downstreamStatus}});
        await this.audit.write(tx,{actorType:actorId?'USER':'SYSTEM',actorId,action:'PACKAGE_PAYMENT_CONFIRMED',entityType:'ORDER',entityId:orderId,afterData:{paymentEventId:payment.paymentEventId,packagePurchaseSnapshotId:packageSnapshot.packagePurchaseSnapshotId,downstreamStatus},requestId,correlationId});
        return {orderId,status:'PAID',paymentEventId:payment.paymentEventId,correlationId,packagePurchaseSnapshotId:packageSnapshot.packagePurchaseSnapshotId,downstreamStatus};
      }

      if(!order.qualificationId){
        await this.outbox.enqueue(tx,{eventType:'WEB_MEMBER_RETAIL_PAYMENT_CONFIRMED',aggregateType:'ORDER',aggregateId:orderId,correlationId,payload:{schemaVersion:1,orderId,personId:order.purchaserPersonId,amount:order.netAmount.toString(),occurredAt:occurredAt.toISOString(),ruleVersionCode:order.ruleVersionCode,parameterSnapshotHash:order.parameterSnapshotHash,recognitionStatus:'RETAIL_REFERRAL_RECOGNITION_PENDING'}});
        await this.audit.write(tx,{actorType:actorId?'USER':'SYSTEM',actorId,action:'WEB_MEMBER_RETAIL_PAYMENT_CONFIRMED',entityType:'ORDER',entityId:orderId,afterData:{paymentEventId:payment.paymentEventId,amount:amount.toString(),referenceNo:dto.referenceNo},requestId,correlationId});
        return {orderId,status:'PAID',paymentEventId:payment.paymentEventId,correlationId};
      }

      await this.outbox.enqueue(tx, {
        eventType: 'SALE_CONFIRMED',
        aggregateType: 'ORDER',
        aggregateId: orderId,
        correlationId,
        payload: {
          eventType: 'SALE_CONFIRMED',
          source: 'MANUAL',
          orderId,
          qualificationId: order.qualificationId,
          amount: order.netAmount.toString(),
          occurredAt: occurredAt.toISOString(),
          ruleVersionCode: order.ruleVersionCode,
          parameterSnapshotHash: order.parameterSnapshotHash,
        },
      });

      await this.audit.write(tx, {
        actorType: actorId ? 'USER' : 'SYSTEM',
        actorId,
        action: 'PAYMENT_CONFIRMED',
        entityType: 'ORDER',
        entityId: orderId,
        afterData: {
          paymentEventId: payment.paymentEventId,
          amount: amount.toString(),
          referenceNo: dto.referenceNo,
        },
        requestId,
        correlationId,
      });

      return {
        orderId,
        status: 'PAID',
        paymentEventId: payment.paymentEventId,
        correlationId,
      };
    });
  }


  async search(input:{status?:string;qualificationId?:string;q?:string;take?:number}={}){
    const take=Math.min(Math.max(input.take ?? 50,1),100);
    const q=input.q?.trim();

    const orders=await this.prisma.order.findMany({
      where:{
        ...(input.status?{status:input.status as any}:{}),
        ...(input.qualificationId?{qualificationId:input.qualificationId}:{}),
        ...(q?{
          OR:[
            {clientReference:{contains:q,mode:'insensitive'}},
            {qualification:{currentHolder:{legalName:{contains:q,mode:'insensitive'}}}},
            {qualification:{currentHolder:{mobile:{contains:q}}}},
          ]
        }:{})
      },
      include:{
        qualification:{include:{currentHolder:true}},
        lines:true,
        paymentEvents:true,
      },
      orderBy:{createdAt:'desc'},
      take,
    });
    if(!orders.length)return orders;
    const orderIds=orders.map(row=>row.orderId),[snapshots,setups]=await Promise.all([
      this.prisma.packagePurchaseSnapshot.findMany({where:{orderId:{in:orderIds}},include:{selections:true}}),
      this.prisma.qualificationSetup.findMany({where:{qualifyingOrderId:{in:orderIds}}}),
    ]);
    return orders.map(order=>{const snapshot=snapshots.find(row=>row.orderId===order.orderId),setup=setups.find(row=>row.qualifyingOrderId===order.orderId);return {...order,...this.packageReadback(snapshot,setup)};});
  }

  async get(orderId: string) {
    return this.prisma.$transaction(async tx=>{
    const order=await tx.order.findUniqueOrThrow({
      where: { orderId },
      include: { lines: true, paymentEvents: true },
    });
    const returned=await tx.returnLine.groupBy({by:['orderLineId'],where:{returnCase:{orderId,status:'POSTED'}},_sum:{quantity:true}});
    const [snapshot,setup]=await Promise.all([tx.packagePurchaseSnapshot.findUnique({where:{orderId},include:{selections:true}}),tx.qualificationSetup.findFirst({where:{qualifyingOrderId:orderId}})]);
    return {...order,...this.packageReadback(snapshot,setup),lines:order.lines.map(line=>{
      const quantity=returned.find(row=>row.orderLineId===line.orderLineId)?._sum.quantity??new Prisma.Decimal(0);
      return {...line,returnedQuantity:quantity.toString(),remainingReversibleQuantity:Prisma.Decimal.max(0,line.quantity.minus(quantity)).toString()};
    })};
    },{isolationLevel:'RepeatableRead'});
  }

  private packageReadback(snapshot:any,setup:any){if(!snapshot)return {packagePurchase:null,packageDownstreamStatus:null};return {packagePurchase:{packagePurchaseSnapshotId:snapshot.packagePurchaseSnapshotId,packageProfileVersionId:snapshot.packageProfileVersionId,packageCode:snapshot.packageCode,packageName:snapshot.packageName,packageClass:snapshot.packageClass,currency:snapshot.currency,priceAmount:snapshot.priceAmount.toString(),selectableProductQuantity:snapshot.selectableProductQuantity,membershipEffect:snapshot.membershipEffect,qualificationEffect:snapshot.qualificationEffect,activeDurationUnit:snapshot.activeDurationUnit,activeDurationValue:snapshot.activeDurationValue,recognitionConfigRef:snapshot.recognitionConfigRef,packageConfigHash:snapshot.packageConfigHash,purchasedAt:snapshot.purchasedAt.toISOString(),selections:(snapshot.selections??[]).map((row:any)=>({productRuleProfileId:row.productRuleProfileId,productId:row.productId,sku:row.skuSnapshot,displayName:row.productDisplaySnapshot,quantity:row.quantity,productConfigHash:row.productConfigHash}))},packageDownstreamStatus:setup?.setupStatus??(snapshot.packageClass==='ACTIVE_DURATION'?'RECOGNITION_CONFIGURATION_PENDING':'PAYMENT_PENDING')};}
}
