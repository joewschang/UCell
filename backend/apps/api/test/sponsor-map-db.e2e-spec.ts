import {randomUUID} from 'node:crypto';
import {PrismaService} from '@ucell/database';
import {SponsorMapController} from '../src/modules/admin-observability/sponsor-map.controller';

const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('full sponsor forest across issued and legacy balls',()=>{
  let db:PrismaService;
  beforeAll(()=>{db=new PrismaService();});
  afterAll(async()=>db?.$disconnect());

  it('reads over a thousand live referrals, effective edges without binary positions, and excludes future/ended edges',async()=>{
    const member=await db.person.create({data:{legalName:'測試推薦人'}});
    const root=randomUUID(), future=randomUUID(),ended=randomUUID(),middle=randomUUID();
    const children=Array.from({length:1005},()=>randomUUID());
    const now=Date.now(),past=new Date(now-86_400_000),tomorrow=new Date(now+86_400_000);
    const all=[root,...children,middle,future,ended];
    await db.qualification.createMany({data:all.map(qualificationId=>({
      qualificationId,currentHolderPersonId:member.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:past,
    }))});
    await db.sponsorRelationship.createMany({data:[
      ...children.map((id,i)=>({sponsorQualificationId:root,childQualificationId:id,sponsorSequenceNo:i+1,effectiveFrom:past})),
      {sponsorQualificationId:children[4],childQualificationId:middle,sponsorSequenceNo:1,effectiveFrom:past},
      {sponsorQualificationId:root,childQualificationId:ended,sponsorSequenceNo:1006,effectiveFrom:past,effectiveTo:new Date(now-2000)},
      {sponsorQualificationId:root,childQualificationId:future,sponsorSequenceNo:1007,effectiveFrom:tomorrow},
    ]});
    const map=await new SponsorMapController(db).read(),byId=new Map(map.data.map(n=>[n.id,n]));
    expect(map.meta.complete).toBe(true);expect(map.meta.total).toBe(map.data.length);
    expect(map.data.filter(n=>n.parentId===root)).toHaveLength(children.length);
    expect(byId.get(root)).toMatchObject({parentId:null,name:'測試推薦人'});
    expect(byId.get(middle)).toMatchObject({parentId:children[4],sponsorSequenceNo:1});
    expect(byId.get(ended)?.parentId??null).toBeNull();expect(byId.get(future)?.parentId??null).toBeNull();
    expect(await db.binaryPlacement.count({where:{childQualificationId:{in:all}}})).toBe(0);
  });
});
