import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { randomUUID, createHash } from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { OutboxService } from '../../common/outbox/outbox.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentConfirmationDto } from './dto/payment-confirmation.dto';
import { QualificationAccessService } from '../auth/qualification-access.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async createMember(dto:CreateOrderDto,key:string,requestId:string,personId:string){
    await new QualificationAccessService(this.prisma).assertHolder(personId,dto.qualificationId);
    try{return await this.create({...dto,purpose:'RETAIL'},key,requestId,personId,true);}
    catch(error){if(['P2002','P2034'].includes((error as any).code))throw new ConflictException({code:'RETRYABLE_CONFLICT',message:'Concurrent operation; retry the identical request with the same Idempotency-Key.'});throw error;}
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

    return this.prisma.order.findMany({
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
  }

  async get(orderId: string) {
    return this.prisma.$transaction(async tx=>{
    const order=await tx.order.findUniqueOrThrow({
      where: { orderId },
      include: { lines: true, paymentEvents: true },
    });
    const returned=await tx.returnLine.groupBy({by:['orderLineId'],where:{returnCase:{orderId,status:'POSTED'}},_sum:{quantity:true}});
    return {...order,lines:order.lines.map(line=>{
      const quantity=returned.find(row=>row.orderLineId===line.orderLineId)?._sum.quantity??new Prisma.Decimal(0);
      return {...line,returnedQuantity:quantity.toString(),remainingReversibleQuantity:Prisma.Decimal.max(0,line.quantity.minus(quantity)).toString()};
    })};
    },{isolationLevel:'RepeatableRead'});
  }
}
