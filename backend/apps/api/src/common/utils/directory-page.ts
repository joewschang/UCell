import {BadRequestException} from '@nestjs/common';

export type DirectoryPage = {page:number; take:number; skip:number};

export function directoryPage(rawPage:string|undefined, rawTake:string|undefined):DirectoryPage|undefined {
  if(rawPage===undefined)return undefined;
  const page=Number(rawPage),take=Number(rawTake??50);
  const skip=(page-1)*take;
  if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(take)||take<1||take>100||
    !Number.isSafeInteger(skip)||skip>2147483647||typeof rawPage!=='string'||(rawTake!==undefined&&typeof rawTake!=='string')){
    throw new BadRequestException({code:'INVALID_DIRECTORY_PAGE',message:'頁碼需為正整數，每頁可查詢 1 至 100 筆。'});
  }
  return {page,take,skip};
}

export function directoryResult<T>(rows:T[],window?:DirectoryPage) {
  if(!window)return {data:rows};
  return {data:rows.slice(0,window.take),meta:{page:window.page,take:window.take,hasNext:rows.length>window.take}};
}
