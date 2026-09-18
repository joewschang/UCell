const {PrismaClient}=require('../../../backend/node_modules/@prisma/client');
const url=new URL(process.env.DATABASE_URL);
if(url.hostname!=='127.0.0.1'||url.port!=='55432'||url.pathname!=='/ucell_admin_test') throw Error('TASK_TEST_DATABASE_ONLY');
const db=new PrismaClient();
(async()=>{try{if(!await db.person.count())await db.person.create({data:{legalName:'TRAIN A ISOLATED TEST',status:'EFFECTIVE'}});if(!await db.productReference.count())await db.productReference.create({data:{sku:'TRAIN-A-TEST',displayName:'ISOLATED TEST PRODUCT',currentPrice:'1600'}});}finally{await db.$disconnect();}})();
