const {PrismaClient}=require('/app/packages/database/node_modules/@prisma/client');
const {OrganizationGeoService}=require('/app/apps/api/dist/modules/organization-geo/organization-geo.service');
const {AdminObservabilityService}=require('/app/apps/api/dist/modules/admin-observability/admin-observability.service');
const assert=require('assert/strict'),db=new PrismaClient();
(async()=>{
 const s=await db.authSession.findFirst({where:{provider:'ENTRA',roleCode:'SUPER_ADMIN',status:'ACTIVE',revokedAt:null,expiresAt:{gt:new Date()}},orderBy:{issuedAt:'desc'}});assert(s,'active administrator session required');
 const p={personId:s.personId,provider:s.provider,subject:s.subject,role:s.roleCode,sessionId:s.authSessionId};
 const root=await db.qualification.findUniqueOrThrow({where:{ballNo:'AX000001'}}),now=new Date(),query={rootBallNo:root.ballNo,side:'ALL',level:'CITY',dateFrom:new Date(now.getTime()-30*86400000).toISOString(),dateTo:now.toISOString(),asOf:now.toISOString(),knowledgeCutoff:now.toISOString()};
 const geo=new OrganizationGeoService(db),summary=await geo.capture(p,query);assert(summary.summary,summary.reason);assert.equal(summary.distribution.reduce((n,r)=>n+r.balls,0),summary.summary.balls);
 const district=await geo.capture(p,{...query,level:'DISTRICT',parentAreaCode:'63000'});assert(district.summary,district.reason);
 const org=new AdminObservabilityService(db),binary=await org.binaryTree(root.qualificationId,2),sponsor=await org.sponsorTree(root.qualificationId,2);assert(binary.length>=7);assert(binary.every(n=>n.ball_no));assert(sponsor.some(n=>n.ball_no==='AX000001'));
 await assert.rejects(()=>org.binaryTree(root.qualificationId,NaN));
 const future=new Date(now.getTime()+700).toISOString();assert(geo.time({...query,asOf:future,knowledgeCutoff:future}).asOf<=new Date().toISOString());
 const unplaced=await db.qualification.count({where:{ballAllocation:{binaryTreeId:(await db.binaryTree.findUniqueOrThrow({where:{treeCode:'A'}})).binaryTreeId},binaryTreeMembership:null}});
 console.log(JSON.stringify({geoStatus:summary.status,geoDescendants:summary.summary.balls,geoMembers:summary.summary.members,gpv:summary.summary.gpv,distributionReconciled:true,districtRead:true,binaryRead:true,sponsorRead:true,invalidQueryRejected:true,clockSkewNormalized:true,pendingBalls:unplaced,geoRefreshEnabled:process.env.GEO_PROFILE_REFRESH_ENABLED==='true',unlocatedBalls:summary.summary.unlocatedBalls,mutations:0}));
})().catch(e=>{console.error(e.response||e.message);process.exitCode=1}).finally(()=>db.$disconnect());
