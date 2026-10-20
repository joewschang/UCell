import {UnprocessableEntityException} from '@nestjs/common';
export function normalizeLocalAccount(value:string){
 const normalized=value.trim().toLowerCase();
 if(!/^[a-z][a-z0-9_]{3,31}$/.test(normalized))throw new UnprocessableEntityException({code:'LOCAL_ACCOUNT_INVALID'});
 return normalized;
}
