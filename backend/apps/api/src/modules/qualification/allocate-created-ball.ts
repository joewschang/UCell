import {UnprocessableEntityException} from '@nestjs/common';
import {Prisma} from '@ucell/database';

/** Allocate an immutable identity in the creation transaction, without placing or activating it. */
export async function allocateCreatedBall(tx:Prisma.TransactionClient,qualificationId:string,sponsorQualificationId?:string){
 let treeId:string|undefined;
 if(sponsorQualificationId){
  const sponsor=await tx.binaryTreeMembership.findUnique({where:{qualificationId:sponsorQualificationId}});
  if(!sponsor)throw new UnprocessableEntityException({code:'BALL_NUMBER_TREE_REQUIRED',message:'推薦資格尚未歸屬組織樹，請洽公司確認後重試。'});
  treeId=sponsor.binaryTreeId;
 }else{
  // Paper checkout has no selected sponsor yet. A unique open tree is unambiguous.
  const trees=await tx.binaryTree.findMany({where:{status:'ACTIVE'},select:{binaryTreeId:true},take:2});
  if(trees.length!==1)throw new UnprocessableEntityException({code:'BALL_NUMBER_TREE_REQUIRED',message:'無法確認資格球所屬組織樹，請先指定有效推薦資格。'});
  treeId=trees[0].binaryTreeId;
 }
 const tree=await tx.binaryTree.findUnique({where:{binaryTreeId:treeId}});
 if(tree?.status!=='ACTIVE')throw new UnprocessableEntityException({code:'BALL_NUMBER_TREE_REQUIRED',message:'推薦資格所屬組織樹尚未開放，請洽公司確認。'});
 const [allocated]=await tx.$queryRaw<Array<{ballNo:string}>>`SELECT organization.allocate_ball_no(${treeId}::uuid,${qualificationId}::uuid) AS "ballNo"`;
 await tx.qualification.update({where:{qualificationId},data:{ballNo:allocated.ballNo}});
 return allocated.ballNo;
}
