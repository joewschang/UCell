'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=process.env.UCELL_API_ROOT||'/app/apps/api/dist/modules';
function edit(name,edits){
 const file=path.resolve(root,name);let text=fs.readFileSync(file,'utf8');
 for(const [a,b,n=1] of edits){if(text.split(a).length!==n+1)throw Error(name+' anchor: '+a);text=text.split(a).join(b);}
 fs.writeFileSync(file,text);
}
const replayFile=process.env.UCELL_REPLAY_FILE||'/app/packages/database/dist/historical-replay.js';
edit(replayFile,[[ "ret.order.purpose === 'REPURCHASE' && packagePurchase?.packageClass !== 'ACTIVE_DURATION'", "(ret.order.purpose === 'REPURCHASE' || await tx.couponRedemption.count({where:{orderId:ret.orderId,coupon:{code:'UCELL168'}}})) && packagePurchase?.packageClass !== 'ACTIVE_DURATION'"]]);
if(process.argv.includes('--worker'))return;
edit('order/order.service.js',[
 ["        if (!dto.qualificationId)\n            return this.createWebRetailMember", "        if(dto.couponCode && (!dto.qualificationId || !dto.checkout || dto.commercialOfferingCode)) require('./core-coupon.cjs').reject('請選擇正式會員資格並於主商品結帳使用優惠碼。');\n        if (!dto.qualificationId)\n            return this.createWebRetailMember"],
 ["items: dto.items, checkout: dto.checkout, purpose: 'RETAIL'","items: dto.items, couponCode:dto.couponCode, checkout: dto.checkout, purpose: 'RETAIL'"],
 ["            if (member && dto.checkout) {","            let campaign,pricing;\n            if(member && dto.couponCode){\n              const core=require('./core-coupon.cjs');\n              if(qualification.kind==='COMPANY_BOOTSTRAP'||products.some(p=>p.currency!=='TWD'))core.reject('優惠限正式會員資格與新台幣主商品。');\n              campaign=await core.eligible(tx,dto.qualificationId,now,dto.couponCode);pricing=core.price(lines,gross);\n            }\n            const net=pricing?new database_1.Prisma.Decimal(pricing.total):gross;\n            if (member && dto.checkout) {"],
 ["resolveCheckoutSnapshot)(tx, actorId, dto.checkout, gross)","resolveCheckoutSnapshot)(tx, actorId, dto.checkout, net)"],
 ["discountAmount: new database_1.Prisma.Decimal(0),\n                    netAmount: gross,","discountAmount: gross.sub(net),\n                    netAmount: net,"],
 ["action: 'ORDER_CREATED_CONFIRMED',","action: 'ORDER_CREATED_CONFIRMED',"],
 ["            if (member)\n                await this.outbox.enqueue", "            if(campaign)await tx.couponRedemption.create({data:{couponId:campaign.id,orderId:order.orderId,personId:actorId,snapshot:{...pricing,qualificationId:dto.qualificationId,revision:campaign.revision},expiresAt:campaign.endsAt}});\n            if (member)\n                await this.outbox.enqueue"],
 ["        // Legacy unit harnesses", "        if(order.lines?.some(line=>line.ruleProfileSnapshot?.coreCoupon?.code==='UCELL168') || (order.purpose==='RETAIL' && order.discountAmount?.gt(0) && await tx.couponRedemption.count({where:{orderId,coupon:{code:'UCELL168'}}}))) {\n          const {EpvService}=require('../epv/epv.service'),{EpvMonthService}=require('../epv/epv-month.service'),{BonusQueryService}=require('../bonus/bonus-query.service');\n          await tx.$queryRaw\x60SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(\x24{order.qualificationId},71))) AS guard\x60;\n          await new EpvService(this.prisma,null,new BonusQueryService(this.prisma),new EpvMonthService()).recognizeInTransaction(tx,orderId,order.ruleVersionCode);\n        }\n        // Legacy unit harnesses"],
]);
edit('member/member.controller.js',[
 ['    async createOrder(req, body, key)',"    async coreCouponQuote(req,body){return require('../order/core-coupon.cjs').quote(this.orderService,req.user.personId,body);}\n    async createOrder(req, body, key)"],
 ["__decorate([\n    (0, common_1.Post)('orders'),","__decorate([(0,common_1.Post)('orders/core-coupon-quote'),__param(0,(0,common_1.Req)()),__param(1,(0,common_1.Body)()),__metadata('design:paramtypes',[Object,MemberCreateOrderDto])],MemberController.prototype,'coreCouponQuote',null);\n__decorate([\n    (0, common_1.Post)('orders'),"]
]);
edit('epv/epv.service.js',[
 ['this.prisma.$transaction(async (tx) => {',"this.prisma.$transaction(tx=>this.recognizeInTransaction(tx,orderId,ruleVersionCode),{isolationLevel:database_1.Prisma.TransactionIsolationLevel.Serializable}));\n    }\n    async recognizeInTransaction(tx,orderId,ruleVersionCode) {"],
 ["if (order.purpose !== 'REPURCHASE')","if (order.purpose !== 'REPURCHASE' && !order.lines.some(l=>l.ruleProfileSnapshot?.coreCoupon?.code==='UCELL168'))"],
 ['        }, { isolationLevel: database_1.Prisma.TransactionIsolationLevel.Serializable }));','']
]);
edit('epv/epv-month.service.js',[[ "purpose: 'REPURCHASE', paidAt:","OR:[{purpose:'REPURCHASE'},{purpose:'RETAIL',couponRedemption:{is:{coupon:{code:'UCELL168'}}}}], paidAt:",2]]);
edit('coupon/coupon.service.js',[
 ["            const ruleCode = before?.ruleCode", "            if(before?.category==='CORE_PRODUCT'){\n              const row=await tx.couponDefinition.update({where:{id},data:{enabled:input.enabled,revision:{increment:1}}});\n              await this.audit.write(tx,{actorType:'USER',actorId:actor,action:'COUPON_UPDATED',entityType:'Coupon',entityId:id,beforeData:{enabled:before.enabled},afterData:{enabled:row.enabled},requestId,correlationId:(0,node_crypto_1.randomUUID)()});return row;\n            }\n            const ruleCode = before?.ruleCode"]
]);

