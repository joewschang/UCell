import {treePlacementPage} from '../qualification/placement-time-page';
import {placementReadyIds} from '../../common/utils/placement-ready';
import {attachPlacementOrders} from '../../common/utils/placement-order-number';
import {ConflictException} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import type {BinaryTreeService,TreePrincipal} from './binary-tree.service';

export function inSubtree(position:bigint,root:bigint){
 if(root<1n||position<root)return false;
 while(position>root)position/=2n;
 return position===root;
}

/** Used again inside the placement transaction; browsing never reserves a slot. */
export async function assertCurrentPlacement(tx:Prisma.TransactionClient,treeId:string,qualificationId:string,parentId:string){
 const target=await tx.qualification.findUnique({where:{qualificationId},include:{ballAllocation:true,currentHolder:true,currentHolderLegalEntity:{select:{membershipState:true,status:true}},sponsorRelation:{include:{sponsor:{select:{kind:true}}}},binaryTreeMembership:true}});
 const setup=await tx.qualificationSetup.findUnique({where:{qualificationId}});
 if(!target||target.kind!=='MEMBER_ORIGIN'||!target.ballNo||target.ballAllocation?.binaryTreeId!==treeId)throw new ConflictException({code:'BINARY_TREE_SCOPE_MISMATCH'});
 if(target.binaryTreeMembership)throw new ConflictException({code:'QUALIFICATION_ALREADY_PLACED'});
 if(!['DRAFT','EFFECTIVE'].includes(target.status)||(target.currentHolder?.membershipState!=='FORMAL_MEMBER'&&!(target.currentHolderLegalEntity?.membershipState==='FORMAL_MEMBER'&&target.currentHolderLegalEntity.status==='ACTIVE')))throw new ConflictException({code:'FORMAL_MEMBERSHIP_REQUIRED'});
 if(!setup||!['PLACEMENT_PENDING','PLACEMENT_OVERDUE'].includes(setup.setupStatus)||setup.finalSponsorQualificationId!==target.sponsorRelation?.sponsorQualificationId)throw new ConflictException({code:'PLACEMENT_NOT_PENDING'});
 const order=await tx.order.findUnique({where:{orderId:setup.qualifyingOrderId},select:{status:true,paidAt:true}});
 if(!order||!order.paidAt||!['PAID','FULFILLED','PARTIAL_RETURN'].includes(order.status))throw new ConflictException({code:'QUALIFYING_ORDER_NOT_PAID'});
 const sponsor=target.sponsorRelation;
 if(!sponsor||sponsor.effectiveFrom>new Date()||(sponsor.effectiveTo&&sponsor.effectiveTo<=new Date()))throw new ConflictException({code:'SPONSOR_CONFIRMATION_MISSING'});
 const [root,parent]=await Promise.all([tx.binaryTreeMembership.findUnique({where:{qualificationId:sponsor.sponsorQualificationId}}),tx.binaryTreeMembership.findUnique({where:{qualificationId:parentId}})]);
 if(root?.binaryTreeId!==treeId||parent?.binaryTreeId!==treeId||(sponsor.sponsor.kind!=='COMPANY_BOOTSTRAP'&&!inSubtree(parent.binaryPositionNo,root.binaryPositionNo)))throw new ConflictException({code:'SPONSOR_SUBTREE_REQUIRED'});
}

const treeSelect={binaryTreeId:true,treeCode:true,treeName:true,status:true,topologyVersion:true} as const;
export async function currentTreeList(db:PrismaService,commands:BinaryTreeService,p:TreePrincipal,after?:string){
 await commands.authorize(p);
 const rows=await db.binaryTree.findMany({where:after?{binaryTreeId:{gt:after}}:{},orderBy:{binaryTreeId:'asc'},take:51,select:treeSelect});
 await commands.authorize(p);
 return {items:rows.slice(0,50),nextCursor:rows.length>50?rows[49].binaryTreeId:null};
}

export async function currentTreeState(db:PrismaService,commands:BinaryTreeService,p:TreePrincipal,id:string,input:{ballNo?:string;candidateBallNo?:string;after?:string},includeHolderNames=false){
 await commands.authorize(p);
 const result=await db.$transaction(async tx=>{
  const tree=await tx.binaryTree.findUnique({where:{binaryTreeId:id},select:treeSelect});
  if(!tree)throw new ConflictException({code:'TREE_NOT_FOUND'});
  const eligible=await placementReadyIds(tx);
  const pendingWhere={qualificationId:{in:eligible},kind:'MEMBER_ORIGIN' as const,ballAllocation:{binaryTreeId:id},binaryTreeMembership:null};
  const {pending,pendingTotal}=await treePlacementPage(tx,pendingWhere,input.after);
  await attachPlacementOrders(tx,pending);
  const mapPending=(q:typeof pending[number])=>({qualificationId:q.qualificationId,requestedAt:q.requestedAt,orderNo:(q as any).orderNo,displayOrderNo:(q as any).displayOrderNo,ballNo:q.ballNo,memberNo:q.currentHolder?.memberNo,planLevelCode:q.planLevelCode,sponsorBallNo:q.sponsorRelation?.sponsor.ballNo});
  const candidate=input.candidateBallNo?await tx.qualification.findFirst({where:{...pendingWhere,ballNo:input.candidateBallNo},include:{sponsorRelation:{include:{sponsor:{select:{ballNo:true,kind:true,binaryTreeMembership:true}}}}}}):null;
  if(input.candidateBallNo&&!candidate)throw new ConflictException({code:'UNPLACED_TREE_BALL_REQUIRED'});
  const sponsor=candidate?.sponsorRelation?.sponsor;
  const companySponsor=sponsor?.kind==='COMPANY_BOOTSTRAP';
  const rootBall=input.ballNo||(companySponsor?undefined:sponsor?.ballNo);
  const root=await tx.binaryTreeMembership.findFirst({where:{binaryTreeId:id,...(rootBall?{qualification:{ballNo:rootBall}}:{binaryPositionNo:1n})},include:{qualification:{select:{ballNo:true}}}});
  if(!root)throw new ConflictException({code:'TREE_BALL_NOT_FOUND'});
  if(candidate&&(sponsor?.binaryTreeMembership?.binaryTreeId!==id||(!companySponsor&&!inSubtree(root.binaryPositionNo,sponsor.binaryTreeMembership.binaryPositionNo))))throw new ConflictException({code:'SPONSOR_SUBTREE_REQUIRED'});
  const positions=[root.binaryPositionNo];
  const maxPosition=9223372036854775807n;
  for(let i=0;i<3&&i<positions.length;i++)if(positions[i]*2n+1n<=maxPosition)positions.push(positions[i]*2n,positions[i]*2n+1n);
  const rows=await tx.binaryTreeMembership.findMany({where:{binaryTreeId:id,binaryPositionNo:{in:positions},effectiveFrom:{lte:new Date()}},orderBy:{binaryPositionNo:'asc'},include:{qualification:{select:{ballNo:true,kind:true,planLevelCode:true,...(includeHolderNames?{currentHolder:{select:{legalName:true,preferredName:true}},currentHolderLegalEntity:{select:{registeredName:true}}}:{})}}}});
  const ancestors:bigint[]=[];let cursor=root.binaryPositionNo;
  const stop=companySponsor?1n:sponsor?.binaryTreeMembership?.binaryPositionNo??1n;
  while(cursor>=stop&&cursor>0n){ancestors.unshift(cursor);cursor/=2n;}
  const breadcrumbs=await tx.binaryTreeMembership.findMany({where:{binaryTreeId:id,binaryPositionNo:{in:ancestors}},orderBy:{binaryPositionNo:'asc'},include:{qualification:{select:{ballNo:true}}}});
  let blocked:string|null=null;
  if(candidate){try{await assertCurrentPlacement(tx,id,candidate.qualificationId,root.qualificationId);}catch(e){if(!(e instanceof ConflictException))throw e;blocked=(e.getResponse() as {code:string}).code;}}
  const children=await tx.binaryTreeMembership.findMany({where:{binaryTreeId:id,binaryPositionNo:{in:rows.flatMap(r=>[r.binaryPositionNo*2n,r.binaryPositionNo*2n+1n]).filter(n=>n<=maxPosition)}},select:{binaryPositionNo:true}});
  const occupied=new Set(children.map(r=>r.binaryPositionNo.toString()));
  const canonical=candidate?await tx.treeCanonicalPosition.findMany({where:{binaryTreeId:id},select:{positionNo:true}}):[];
  const sequence=candidate?.sponsorRelation?.sponsorSequenceNo;
  return {tree,observedAt:new Date().toISOString(),pending:{items:pending.slice(0,50).map(mapPending),total:pendingTotal,nextCursor:pending.length>50?pending[49].qualificationId:null},
   candidate:candidate?{qualificationId:candidate.qualificationId,ballNo:candidate.ballNo,sponsorBallNo:sponsor?.ballNo,sequence,blocked}:null,
   breadcrumbs:breadcrumbs.map(r=>({ballNo:r.qualification.ballNo})),
   nodes:rows.map(r=>({qualificationId:r.qualificationId,ballNo:r.qualification.ballNo,position:r.binaryPositionNo.toString(),kind:r.qualification.kind,planLevelCode:r.qualification.planLevelCode,
    ...(includeHolderNames?{memberName:r.qualification.currentHolderLegalEntity?.registeredName||r.qualification.currentHolder?.legalName||r.qualification.currentHolder?.preferredName||null}:{}),
    slots:candidate?(['LEFT','RIGHT'] as const).flatMap(side=>{
     const pos=r.binaryPositionNo*2n+(side==='RIGHT'?1n:0n);
     if(pos>maxPosition||occupied.has(pos.toString()))return [];
     let reason=blocked||(tree.status!=='ACTIVE'?'TREE_NOT_OPEN_TO_PLACEMENT':null);
     if(!reason&&canonical.some(c=>BigInt(c.positionNo)===pos)&&!companySponsor)reason='FOUNDING_COMPANY_SPONSOR_REQUIRED';
     return [{side,reason}];
    }):[]}))};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:15000});
 await commands.authorize(p);return result;
}
