import { BadRequestException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';

type DirectoryInput = { page: string; take?: string; status?: string; q?: string; sourceChannel?: string };

function positiveInteger(value: string, name: string) {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1) {
    throw new BadRequestException({code:'INVALID_DIRECTORY_PAGE', message:name + '必須是正整數。'});
  }
  return number;
}

function contains(value: string) {
  return { contains:value.replace(/[\\%_]/g, '\\$&'), mode:'insensitive' as const };
}

function matchTerm(term: string): Prisma.FormalMemberApplicationWhereInput {
  const text=contains(term);
  const or: Prisma.FormalMemberApplicationWhereInput[] = [
    {person:{legalName:text}}, {person:{memberNo:text}},
    {legalEntity:{registeredName:text}}, {legalEntity:{memberNo:text}},
  ];
  const number=term.replace(/^TW/i,'').replace(/[()\s-]/g,'').replace(/^\+?8869/,'09');
  if (/^\d+$/.test(number)) {
    or.push({person:{mobile:contains(number)}});
    if (number.startsWith('09')) or.push({person:{mobile:contains('886'+number.slice(1))}});
  }
  return {OR:or};
}

export async function formalReviewDirectory(db: PrismaService, input: DirectoryInput) {
  const page=positiveInteger(input.page, '頁碼');
  const pageSize=Math.min(100,positiveInteger(input.take ?? '25','每頁筆數'));
  const skip=(page-1)*pageSize;
  const query=(input.q ?? '').normalize('NFKC').trim();
  if (skip>2147483647 || query.length>120) throw new BadRequestException({code:'INVALID_DIRECTORY_QUERY',message:'請確認頁碼，搜尋文字上限為 120 字。'});
  const terms=query.split(/\s+/).filter(Boolean);
  // All matching and paging use the membership directory. Application snapshots, documents and identifiers stay out of this query.
  const rows=await db.formalMemberApplication.findMany({
    where:{
      ...(input.status ? {status:input.status} : {}),
      ...(input.sourceChannel==='ADMIN_PAPER' ? {sourceChannel:'ADMIN_PAPER' as const} : {}),
      OR:[{status:{not:'WITHDRAWN'}},{decisionReasonCode:null},{NOT:{decisionReasonCode:{startsWith:'ADMIN_PAPER_DELETED:'}}}],
      AND:terms.map(matchTerm),
    },
    orderBy:[{updatedAt:'desc'},{formalMemberApplicationId:'asc'}],skip,take:pageSize+1,
    select:{
      formalMemberApplicationId:true,applicantType:true,sourceChannel:true,status:true,updatedAt:true,decisionReasonCode:true,
      person:{select:{legalName:true,memberNo:true,mobile:true,membershipState:true}},
      legalEntity:{select:{registeredName:true,memberNo:true,membershipState:true}},
    },
  });
  return {
    data:rows.slice(0,pageSize).map(row=>{
      const corp=row.applicantType==='LEGAL_ENTITY';
      const phone=(row.person.mobile??'').replace(/[\s()-]/g,'').replace(/^\+?8869/,'09');
      return {
        id:row.formalMemberApplicationId,personName:corp ? row.legalEntity?.registeredName || '法人名稱尚未寫入主檔' : row.person.legalName || '尚未填寫姓名',
        representativeName:corp ? row.person.legalName : null,
        displayMemberNo:(corp && row.legalEntity?.memberNo) || (/^09\d{8}$/.test(phone) ? 'TW'+phone : row.person.memberNo),
        membershipState:corp ? row.legalEntity?.membershipState ?? null : row.person.membershipState,
        applicantType:row.applicantType,sourceChannel:row.sourceChannel,status:row.status,updatedAt:row.updatedAt.toISOString(),
        reconfirmation:row.decisionReasonCode==='PAPER_CONFIRM_PENDING' ? '待補件－重新確認資料、合約與簽名' :
          row.status==='SUBMITTED' && row.decisionReasonCode==='PAPER_CONFIRM_SUBMITTED' ? '補件已送出，待複審' : null,
      };
    }),
    meta:{page,pageSize,hasNext:rows.length>pageSize},
  };
}
