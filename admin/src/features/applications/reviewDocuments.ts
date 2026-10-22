export const documentLabels:Record<string,string>={IDENTITY_FRONT:'身分證明文件正面',IDENTITY_BACK:'身分證明文件反面',BANKBOOK_COVER:'存摺封面',SIGNED_APPLICATION_AGREEMENT:'會員簽名／已簽署申請書',CORPORATE_REGISTRATION:'公司登記證明',REPRESENTATIVE_IDENTITY_FRONT:'代表人證件正面',REPRESENTATIVE_IDENTITY_BACK:'代表人證件反面',CORPORATE_BANK_PROOF:'公司銀行證明',TAX_REGISTRATION:'稅籍登記證明',OTHER:'其他文件'};
export const documentLabel=(type:string)=>documentLabels[type]??'其他文件';
export function currentDocuments(rows:any[]){const result=new Map<string,any>();for(const row of [...rows].sort((a,b)=>(Date.parse(b.uploadedAt??'')||0)-(Date.parse(a.uploadedAt??'')||0))){if(row.status==='SUPERSEDED'||result.has(row.type))continue;result.set(row.type,row);}return [...result.values()];}
const normalized=(v:string)=>v.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'').toUpperCase();
export function ocrMismatch(text:string|undefined,name:string,value:unknown):boolean{
 if(text===undefined||!value)return false;
 let values=[String(value)];
 if(name==='gender')values=[value==='MALE'?'男':value==='FEMALE'?'女':String(value)];
 if(name==='birthDate'){const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);if(m){const y=+m[1],mo=+m[2],d=+m[3];values=[`${y}年${mo}月${d}日`,`${y-1911}年${mo}月${d}日`,`${y}${m[2]}${m[3]}`,`${y-1911}${m[2]}${m[3]}`];}}
 return !values.some(value=>normalized(text).includes(normalized(value)));
}
