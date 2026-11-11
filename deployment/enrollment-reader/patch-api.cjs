'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2];
function replace(file,from,to){const p=path.join(root,file),s=fs.readFileSync(p,'utf8');if(s.split(from).length!==2)throw Error(file+' mismatched');fs.writeFileSync(p,s.replace(from,()=>to));}
replace('kyc-upload-transport.js',"methods.includes('POST') && (","methods.includes('POST') && (route.url==='/api/v1/member/formal-enrollment/read-document' || ");
replace('formal-kyc-document.service.js','name: payload.legalName, snapshotHash:',"name: payload.legalName || payload.legalEntityName, snapshotHash:");
replace('formal-kyc-document.service.js','content: contract.contentText','content: contract.contentText, previewContent: require("./agreement.cjs").agreement(contract.contentText,payload)');
replace('enrollment-documents.controller.js','.text(contract.content, { lineGap: 3 })','.text(contract.previewContent ?? contract.content, { lineGap: 3 })');
replace('enrollment-documents.controller.js','const fields = {};','const extraction=(0,intake_policy_1.safeExtraction)(result.value); const fields = {};');
replace('enrollment-documents.controller.js','const value = result.value.fields[key];',"const value = key==='bankName' ? result.value.fields.bankName : extraction.fields[key];");
replace('enrollment-documents.controller.js','return { fields };','return { fields, requiresHumanReview:true };');
