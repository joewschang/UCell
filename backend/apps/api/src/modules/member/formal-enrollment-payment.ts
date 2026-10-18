import {Prisma,PrismaService} from '@ucell/database';
export async function formalFeeCoveredByPackage(db:PrismaService|Prisma.TransactionClient,personId:string){
 const rows=await db.$queryRaw<Array<{orderId:string}>>`SELECT p.order_id AS "orderId" FROM commerce.package_purchase_snapshot p JOIN commerce."order" o ON o.order_id=p.order_id WHERE p.person_id=${personId}::uuid AND p.package_class='QUALIFICATION' AND p.membership_effect='FORMAL_ELIGIBILITY' AND o.status='PAID' LIMIT 1`;
 return rows.length>0;
}
