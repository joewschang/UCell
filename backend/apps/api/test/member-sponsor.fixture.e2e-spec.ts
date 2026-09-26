import {PrismaClient} from '@prisma/client';
import {createEffectiveMemberSponsorFixture} from './helpers/member-sponsor.fixture';
const url=process.env.PHASE2_TEST_DATABASE_URL;const describeDb=url?describe:describe.skip;
describeDb('member sponsor fixture',()=>{let db:PrismaClient;beforeAll(()=>db=new PrismaClient({datasources:{db:{url}}}));afterAll(()=>db.$disconnect());it('creates an effective attached member ball',async()=>{const f=await createEffectiveMemberSponsorFixture(db);expect(f.qualification.ballNo).toMatch(/\d{6}$/);expect(await db.binaryTreeMembership.findUnique({where:{qualificationId:f.qualification.qualificationId}})).not.toBeNull();});});
