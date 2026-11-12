import {BadRequestException} from '@nestjs/common';
import {Prisma, PrismaService} from '@ucell/database';
import type {DirectoryPage} from '../../common/utils/directory-page';

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function qualificationFilter(query?:string,status?:Prisma.QualificationWhereInput['status']):Prisma.QualificationWhereInput {
  if(query!==undefined&&typeof query!=='string')throw new BadRequestException('搜尋條件格式錯誤');
  const q=query?.trim();
  if(!q)return {status};
  const phone=q.replace(/[\s()-]/g,'');
  const phones=[...new Set([q,phone,phone.replace(/^\+?886/,'0'),phone.replace(/^09/,'+8869')])];
  return {status,OR:[
    ...(uuidPattern.test(q)?[{qualificationId:q}]:[]),
    {ballNo:{contains:q,mode:'insensitive'}},
    {currentHolder:{memberNo:{contains:q,mode:'insensitive'}}},
    {currentHolder:{legalName:{contains:q,mode:'insensitive'}}},
    {currentHolder:{preferredName:{contains:q,mode:'insensitive'}}},
    ...phones.filter(Boolean).map(value=>({currentHolder:{mobile:{contains:value}}})),
    {currentHolder:{email:{contains:q,mode:'insensitive'}}},
    {currentHolderLegalEntity:{memberNo:{contains:q,mode:'insensitive'}}},
    {currentHolderLegalEntity:{registeredName:{contains:q,mode:'insensitive'}}},
    {currentHolderLegalEntity:{registrationNo:{contains:q,mode:'insensitive'}}}
  ]};
}

// The picker renders a name and public identifiers. Detailed member data stays in its own view.
export function qualificationRows(db:PrismaService,window:DirectoryPage,where:Prisma.QualificationWhereInput,id?:string) {
  if(id!==undefined&&!uuidPattern.test(id))throw new BadRequestException('請選擇有效的球位');
  return db.qualification.findMany({where:{...where,qualificationId:id},skip:window.skip,take:window.take+1,
    orderBy:[{createdAt:'desc'},{qualificationId:'desc'}],
    select:{qualificationId:true,ballNo:true,kind:true,status:true,planLevelCode:true,activeFlag:true,currentCompanyPrincipalId:true,
      currentHolder:{select:{memberNo:true,legalName:true,preferredName:true}},
      currentHolderLegalEntity:{select:{memberNo:true,registeredName:true}}}
  });
}
