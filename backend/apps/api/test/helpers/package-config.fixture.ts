import {PrismaClient,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
export async function createActiveQualificationPackage(db:PrismaClient,at=new Date()){
 const token=randomUUID(), product=await db.productReference.create({data:{sku:`PKG-${token}`,displayName:'Isolated qualification product',currentPrice:new Prisma.Decimal(14400),currency:'TWD'}});
 const rule=await db.productRuleProfile.create({data:{productId:product.productId,effectiveFrom:new Date(at.getTime()-60000),gpvRate:new Prisma.Decimal(0),ruleVersionCode:`PKG-${token}`,parameterSnapshotHash:'a'.repeat(64)}});
 const profile=await db.packageProfile.create({data:{stableCode:`PKG-${token}`,packageClass:'QUALIFICATION',status:'ACTIVE'}});
 const version=await db.packageProfileVersion.create({data:{packageProfileId:profile.packageProfileId,version:1,displayName:'Isolated qualification package',currency:'TWD',priceAmount:new Prisma.Decimal(14400),selectableProductQuantity:1,selectionMode:'EXACT_QUANTITY',membershipEffect:'FORMAL_ELIGIBILITY',qualificationEffect:'CREATE_QUALIFICATION',effectiveFrom:new Date(at.getTime()-60000),salesFrom:new Date(at.getTime()-60000),status:'ACTIVE',recognitionConfigRef:'R1.0B',configHash:'b'.repeat(64),approvalReference:`TEST-${token}`,createdByActor:'SYSTEM',approvedByActor:'SYSTEM',approvedAt:at}});
 await db.packageSelectableProduct.create({data:{packageProfileVersionId:version.packageProfileVersionId,productRuleProfileId:rule.productRuleProfileId,enabledFrom:new Date(at.getTime()-60000),minQty:1,maxQty:1,selectionIncrement:1,status:'ACTIVE'}});
 return {product,rule,profile,version};
}
