export const requiredDocuments=['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'] as const;
export type RequiredDocument=typeof requiredDocuments[number];
export const documentNames:Record<RequiredDocument,string>={IDENTITY_FRONT:'身分證明文件正面',IDENTITY_BACK:'身分證明文件反面',BANKBOOK_COVER:'銀行存摺封面'};
export function checkDocumentText(type:RequiredDocument,text:string,identityType='NATIONAL_ID'){
 const t=text.normalize('NFKC').replace(/\s/g,'').toUpperCase();
 const missing:string[]=[];
 if(type==='BANKBOOK_COVER'){
  if(!/銀行|信用合作社|農會|漁會|郵政|郵局|BANK|POST/.test(t))missing.push('銀行或金融機構名稱');
  if(!/帳號|賬號|帳戶|賬戶|戶名|存款|ACCOUNT|存摺|存簿/.test(t))missing.push('帳號／戶名欄位');
  if(!/\d{7,18}/.test(t.replace(/[-－]/g,'')))missing.push('完整銀行帳號');
 }else if(identityType!=='NATIONAL_ID'){
  if(!/居留|護照|PASSPORT|RESIDENT|身分|IDENTITY/.test(t))missing.push('證件名稱');
  if(!/[A-Z0-9]{6,}/.test(t))missing.push('證件號碼');
 }else if(type==='IDENTITY_FRONT'){
  if(!/[A-Z][12]\d{8}/.test(t))missing.push('完整身分證字號');
  if(!/姓名|NAME/.test(t))missing.push('姓名欄位');
  if(!/出生|生日|BIRTH/.test(t))missing.push('出生日期欄位');
 }else{
  if(!/住址|戶籍|ADDRESS/.test(t))missing.push('住址欄位');
  if(!/父|母|配偶|役別|出生地/.test(t))missing.push('父母、配偶或役別等背面欄位');
 }
 return {ok:missing.length===0,missing};
}
