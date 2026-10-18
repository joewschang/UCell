import {PrismaService} from '../packages/database/src';
import {validateFormalSponsor} from '../apps/api/src/modules/member/formal-application-sponsor';
const db=new PrismaService();
(async()=>{const p=await db.person.findFirstOrThrow({where:{memberNo:'2610000004'},select:{personId:true}});const result=await validateFormalSponsor(db,p.personId,'UCELL001X000007');console.log(JSON.stringify({validation:'PASS',ballNo:result.sponsorBallNo,applications:await db.formalMemberApplication.count({where:{personId:p.personId}})}));})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
