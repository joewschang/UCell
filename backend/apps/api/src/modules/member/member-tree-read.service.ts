import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { binaryParent, PrismaService } from '@ucell/database';
import { parseAsOfContext } from '@ucell/shared';
import { readTreeNodeSnapshot } from '../binary-tree/tree-node-snapshot';
import { MemberService } from './member.service';

export function memberSafeTreeNode(row:{ballNo:string|null;binaryPositionNo:string|bigint;side:string|null}){
 return {ballNo:row.ballNo??'UNAVAILABLE',binaryPositionNo:String(row.binaryPositionNo),side:row.side==='LEFT'||row.side==='RIGHT'?row.side:null,nodeKind:'AnonymousBallNode' as const};
}

export function isDescendantOrSelf(position:bigint,root:bigint){
 for(let cursor:bigint|null=position;cursor!==null;cursor=binaryParent(cursor))if(cursor===root)return true;
 return false;
}

/** A bounded server projection.  It never returns a Company bootstrap node, UUID, owner state or finance field. */
@Injectable()
export class MemberTreeReadService {
 constructor(private readonly db:PrismaService,private readonly members:MemberService){}
 async children(personId:string,input:{ballNo:string;parentBallNo?:string;after?:string;snapshotToken?:string;timezone:string;asOf:string;periodStart:string;periodEnd:string;knowledgeCutoff:string}){
  const time=this.time(input);
  const selected=await this.db.qualification.findUnique({where:{ballNo:input.ballNo},include:{binaryTreeMembership:true}});
  if(!selected||!selected.binaryTreeMembership)throw new NotFoundException({code:'BALL_TREE_NOT_FOUND'});
  await this.members.context(personId,selected.qualificationId);
  if(selected.binaryTreeMembership.binaryPositionNo<=3n)throw new NotFoundException({code:'TREE_NODE_NOT_AVAILABLE'});
  const parent=input.parentBallNo
   ?await this.db.qualification.findUnique({where:{ballNo:input.parentBallNo},include:{binaryTreeMembership:true}})
   :selected;
  if(!parent?.binaryTreeMembership||parent.binaryTreeMembership.binaryTreeId!==selected.binaryTreeMembership.binaryTreeId)throw new NotFoundException({code:'TREE_PARENT_NOT_FOUND'});
  if(parent.binaryTreeMembership.binaryPositionNo<=3n)throw new NotFoundException({code:'TREE_NODE_NOT_AVAILABLE'});
  // Bound traversal to the authenticated member's immutable position subtree.
  // A guessed ball number therefore cannot enumerate unrelated tree branches.
  if(!isDescendantOrSelf(parent.binaryTreeMembership.binaryPositionNo,selected.binaryTreeMembership.binaryPositionNo))throw new NotFoundException({code:'TREE_NODE_NOT_AVAILABLE'});
  const result=await readTreeNodeSnapshot(this.db,{personId,sessionId:'member-tree',provider:'MEMBER',subject:personId,role:'MEMBER'},selected.binaryTreeMembership.binaryTreeId,time,input.after,input.snapshotToken,parent.qualificationId);
  if(result.status!=='AVAILABLE')return {status:result.status,snapshotToken:result.snapshotToken??null,snapshotExpiresAt:(result as any).snapshotExpiresAt??null,items:[],nextCursor:null};
  const upstreamPosition=binaryParent(parent.binaryTreeMembership.binaryPositionNo);
  return {status:'AVAILABLE',snapshotToken:result.snapshotToken,snapshotExpiresAt:result.snapshotExpiresAt,
   parentBallNo:parent.ballNo,hiddenBootstrapBoundary:upstreamPosition!==null&&upstreamPosition<=3n,
   items:result.items.filter((row:any)=>BigInt(row.binaryPositionNo)>3n).map(memberSafeTreeNode),nextCursor:result.nextCursor};
 }
 private time(input:Record<string,unknown>){try{const time=parseAsOfContext(input),now=new Date().toISOString();if(time.asOf>now||time.knowledgeCutoff>now)throw new Error();return time;}catch{throw new ConflictException({code:'INVALID_AS_OF_CONTEXT'});}}
}
