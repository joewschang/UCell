const fs=require('node:fs'), path=require('node:path');
const root=process.argv[2];
function replace(file,from,to){
  const target=path.join(root,file+'.js'),source=fs.readFileSync(target,'utf8');
  if(source.split(from).length!==2) throw Error('Unexpected build: '+file+' '+from);
  fs.writeFileSync(target,source.replace(from,()=>to));
}
replace('common/ai/document-ocr','phone,email,communicationAddress,','phone,email,registeredAddress,communicationAddress,');
replace('common/ai/document-ocr','All fields strings.','All fields strings. On the reverse of a Taiwan identity card transcribe only the complete visible residence (住址) into registeredAddress, preserving every printed component, joining wrapped lines. If incomplete or unreadable leave it blank and warn. Do not put birthplace (出生地), issuing office, or the residence in communicationAddress. Only put an explicitly supplied correspondence address in communicationAddress.');
replace('modules/member/admin-document-ocr.controller','return { ...extraction, text:',"return { ...extraction, registeredAddress: typeof result.value.fields.registeredAddress==='string'?result.value.fields.registeredAddress.trim().slice(0,500):'', text:");
replace('modules/member/enrollment-documents.controller',"key==='bankName' ?","body.type==='IDENTITY_BACK' && key==='communicationAddress' ? result.value.fields.registeredAddress : key==='bankName' ?");
replace('modules/document-intake/document-intake.service','if (!Object.values(extraction.fields)',"require('./address.cjs').propose(r.payload,extraction,result.value); if (!Object.values(extraction.fields)");
replace('modules/document-intake/document-intake.service','warnings: p.warnings ?? [], assets:',"warnings: require('./address.cjs').warnings(p), assets:");
replace('modules/qualification/qualification.module','controllers: [',"controllers: [...require('./address-sponsor.cjs'),");
replace('modules/member/kyc-upload-transport',"route.url==='/api/v1/member/formal-enrollment/read-document'", "route.url==='/api/v1/admin/paper-order-workbench/read-address' || route.url==='/api/v1/member/formal-enrollment/read-document'");
