'use strict';
const blank='未提供';
function value(v){return typeof v==='string'&&v.trim()?v.trim().replace(/[\r\n\t]+/g,' '):blank;}
function agreement(text,p){
 const corp=p.applicantType==='LEGAL_ENTITY'||!!p.legalEntityName;
 const name=corp?p.representativeLegalName:p.legalName;
 const identity=corp?p.representativeIdentityDocumentNumber:p.identityDocumentNumber;
 const gender={MALE:'男',FEMALE:'女',UNDISCLOSED:'未揭露'}[p.gender]??p.gender;
 const row=(label,v)=>label+'　'+value(v);
 const fields=[['申請類別',corp?'法人':'自然人'],[corp?'代表人姓名':'申請人姓名',name],
 ['出生日期',p.birthDate],['性別',gender],['證件號碼',identity],['聯絡電話',p.phone],['電子信箱',p.email],['通訊地址',p.communicationAddress]];
 if(corp)fields.push(['法人名稱',p.legalEntityName],['統一編號',p.legalEntityRegistrationNo],['登記地址',p.legalEntityRegisteredAddress]);
 if(p.spouseName)fields.push(['配偶姓名',p.spouseName],['配偶證件號碼',p.spouseIdentityDocumentNumber]);
 const bank=[['銀行代碼',p.bankCode],['戶名',p.accountHolder],['帳號',p.bankAccount]];
 const section=(title,rows)=>'\n\n【'+title+'】\n'+rows.map(([k,v])=>row(k,v)).join('\n')+'\n\n';
 let body=text.replace(/\r\n?/g,'\n');
 // Replace only the known printed entry lines. Keep the following instruction and all agreement clauses.
 const form=/傳銷商類別\/Nature of Distributorship:[\s\S]{0,3200}?營利事業統一編號\/Business License No\.:\s*/;
 const account=/銀行名 Bank Name:\s*分行代號 Branch Code:\s*戶名 Account Name:\s*帳號 Account No\.:\s*/;
 const withForm=form.test(body),withAccount=account.test(body);
 const applicant=section('申請資料',fields);
 const originalFields='\n英文姓名（同護照）　未提供\n戶籍地址　未提供\n通訊地址：郵政信箱恕不接受（P.O. Box Address Not Accepted）。\n直銷商編號（公司填寫）　待公司填寫\n';
 if(withForm)body=body.replace(form,()=>applicant+originalFields);
 else body=applicant+body;
 if(withAccount)body=body.replace(account,()=>section('獎金匯款帳戶',bank));
 else body=section('獎金匯款帳戶',bank)+body;
 return body.replace(/申請日期\/Application Date:西元\s*年yy\s*月mm\s*日dd/g,'申請日期／Application Date：待確認').replace(/[□▢]{2,}/g,'（未填）').replace(/[\u3000 \t]{2,}/g,' ').replace(/ *\n */g,'\n').replace(/\n{4,}/g,'\n\n').trim();
}
module.exports={agreement};
