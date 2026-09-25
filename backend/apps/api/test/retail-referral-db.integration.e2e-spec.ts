import {PrismaClient,Prisma} from '@prisma/client';
const ROLLBACK='RETAIL_REFERRAL_TEST_ROLLBACK';
const url=process.env.RETAIL_REFERRAL_TEST_DATABASE_URL??process.env.DATABASE_URL;
const describeDb=url?.includes('/ucell')?describe:describe.skip;
describeDb('Retail Referral rollback integration harness',()=>{
 const db=new PrismaClient({datasources:{db:{url}}});
 afterAll(()=>db.$disconnect());
 it('runs fixtures only inside a serializable rollback transaction',async()=>{
  await expect(db.$transaction(async tx=>{
   const result=await tx.$queryRaw<{ok:number}[]>`SELECT 1 AS ok`;
   expect(result[0].ok).toBe(1);
   throw new Error(ROLLBACK);
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000})).rejects.toThrow(ROLLBACK);
 });
});
