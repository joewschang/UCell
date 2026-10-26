import {validTaiwanNationalId} from '../../../../member/src/enrollmentValidation';
export const documentLabels:Record<string,string>={IDENTITY_FRONT:'身分證明文件正面',IDENTITY_BACK:'身分證明文件反面',BANKBOOK_COVER:'存摺封面',SIGNED_APPLICATION_AGREEMENT:'會員簽名／已簽署申請書',CORPORATE_REGISTRATION:'公司登記證明',REPRESENTATIVE_IDENTITY_FRONT:'代表人證件正面',REPRESENTATIVE_IDENTITY_BACK:'代表人證件反面',CORPORATE_BANK_PROOF:'公司銀行證明',TAX_REGISTRATION:'稅籍登記證明',OTHER:'其他文件'};
export const documentLabel=(type:string)=>documentLabels[type]??'其他文件';
export function currentDocuments(rows:any[]){const result=new Map<string,any>();for(const row of [...rows].sort((a,b)=>(Date.parse(b.uploadedAt??'')||0)-(Date.parse(a.uploadedAt??'')||0))){if(row.status==='SUPERSEDED'||result.has(row.type))continue;result.set(row.type,row);}return [...result.values()];}
const normalized=(v:string)=>v.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'').toUpperCase();
export function nationalIdGenderCheck(documentType:unknown,number:unknown,gender:unknown):'MATCH'|'MISMATCH'|'UNDISCLOSED'|'NOT_APPLICABLE'|'INVALID_ID'{
 if(gender==='UNDISCLOSED')return 'UNDISCLOSED';
 if(documentType!=='NATIONAL_ID'||!['MALE','FEMALE'].includes(String(gender)))return 'NOT_APPLICABLE';
 if(typeof number!=='string'||!validTaiwanNationalId(number))return 'INVALID_ID';
 return number.trim()[1]===(gender==='MALE'?'1':'2')?'MATCH':'MISMATCH';
}
export function ocrMismatch(text:string|undefined,name:string,value:unknown):boolean{
 if(text===undefined||!value||name==='gender'&&!['MALE','FEMALE'].includes(String(value)))return false;
 let values=[String(value)];
 if(name==='gender')values=[value==='MALE'?'男':value==='FEMALE'?'女':String(value)];
 if(name==='birthDate'){
  const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if(m){
   const year=+m[1],month=+m[2],day=+m[3],rocYear=year-1911;
   const source=text.normalize('NFKC').replace(/\s/g,'');
   // Compare numeric components; OCR never rewrites the stored Gregorian date.
   for(const date of source.matchAll(/(?:^|[^\d])(民國)?(\d{1,4})[年/.-](\d{1,2})[月/.-](\d{1,2})(?:日)?(?!\d)/g)){
    const foundYear=+date[2],gregorian=date[1]||date[2].length<=3?foundYear+1911:foundYear;
    if(foundYear>0&&gregorian===year&&+date[3]===month&&+date[4]===day)return false;
   }
   const compact=[`${year}${m[2]}${m[3]}`,...(rocYear>0?[`${rocYear}${m[2]}${m[3]}`,`${String(rocYear).padStart(3,'0')}${m[2]}${m[3]}`]:[])];
   return !compact.some(date=>new RegExp(`(?:^|[^\\d])${date}(?!\\d)`).test(source));
  }
 }
 return !values.some(value=>normalized(text).includes(normalized(value)));
}
