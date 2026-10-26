const {PrismaClient}=require('/app/packages/database/node_modules/@prisma/client');
const assert=require('assert/strict'),db=new PrismaClient();
(async()=>{
 const helper=require('/tmp/geo-membership-scope.js');
 const tree=await db.binaryTree.findUniqueOrThrow({where:{treeCode:'A'}}),now=new Date().toISOString(),time={asOf:now,knowledgeCutoff:now};
 const members=await db.binaryTreeMembership.findMany({where:{binaryTreeId:tree.binaryTreeId,effectiveFrom:{lte:new Date(now)},recordedAt:{lte:new Date(now)}},select:{qualificationId:true,binaryPositionNo:true},take:501});assert(members.length<=500);
 const edges=await db.binaryPlacement.findMany({where:{childQualificationId:{in:members.map(m=>m.qualificationId)},effectiveFrom:{lte:new Date(now)},OR:[{effectiveTo:null},{effectiveTo:{gt:new Date(now)}}]},select:{parentQualificationId:true,childQualificationId:true,side:true}});
 const counts=[];
 for(const position of [1n,2n,3n]){
  const root=members.find(m=>m.binaryPositionNo===position);assert(root);const expected=[],queue=[{id:root.qualificationId,side:null}];
  while(queue.length){const p=queue.shift();for(const e of edges.filter(e=>e.parentQualificationId===p.id)){const side=p.side||e.side;expected.push({descendantQualificationId:e.childQualificationId,firstSide:side});queue.push({id:e.childQualificationId,side});assert(expected.length<501);}}
  const actual=await helper.geoDescendants(db,tree.binaryTreeId,position,time),sort=rows=>rows.map(r=>r.descendantQualificationId+':'+r.firstSide).sort();assert.deepEqual(sort(actual),sort(expected));counts.push(actual.length);
 }
 const events=await helper.geoGpvSources(db,tree.binaryTreeId,1n,time);
 const rows=await db.$queryRawUnsafe("SELECT n::text, ltrim(n::bit(64)::text,'0') LIKE '100%' AS inside, substring(ltrim(n::bit(64)::text,'0') FROM 4 FOR 1) AS side FROM (VALUES (8::bigint),(9::bigint),(16::bigint),(19::bigint),(20::bigint),(9007199254740993::bigint)) v(n)");
 assert.deepEqual(rows.map(r=>r.inside),[true,true,true,true,false,true]);assert.deepEqual(rows.slice(0,4).map(r=>r.side),['0','1','0','1']);
 console.log(JSON.stringify({heapDescendants:true,descendantCounts:counts,comparedWithPlacementEdges:true,deepPositionPrecision:true,gpvSourceQuery:true,gpvEvents:events.length,mutations:0}));
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
