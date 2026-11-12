import {UnprocessableEntityException} from '@nestjs/common';
import {Prisma} from '@ucell/database';
import {EnrollmentBundleInput} from './enrollment-bundle.dto';

export async function validateExcellencePlan(tx:Prisma.TransactionClient,input:EnrollmentBundleInput) {
  const invalid=()=>new UnprocessableEntityException({
    code:'EXCELLENCE_SELECTION_INVALID',message:'卓越方案需選三組啟航資格，每球各搭配一組重銷（三個月）。'
  });
  if(input.balls.length!==3||input.balls.some(ball=>!ball.repurchase))throw invalid();
  const versions=await tx.packageProfileVersion.findMany({where:{packageProfileVersionId:{in:
    input.balls.flatMap(ball=>[ball.qualification.packageVersionId,ball.repurchase!.packageVersionId])
  }},select:{packageProfileVersionId:true,profile:{select:{stableCode:true}},activeDurationUnit:true,activeDurationValue:true}});
  const selected=new Map(versions.map(version=>[version.packageProfileVersionId,version]));
  for(const ball of input.balls) {
    const entry=selected.get(ball.qualification.packageVersionId),repurchase=selected.get(ball.repurchase!.packageVersionId);
    if(entry?.profile.stableCode!=='STARTER'||repurchase?.profile.stableCode!=='ACTIVE_QUARTER'||
      repurchase.activeDurationUnit!=='MONTH'||repurchase.activeDurationValue!==3)throw invalid();
  }
}
