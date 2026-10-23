const fs=require('fs'),path=require('path'),assert=require('assert/strict');const root=path.resolve(__dirname,'..'),out='C:/UCell/registration-prefill-20261022',ts=require(root+'/backend/node_modules/typescript');
function method(s,name){const f=ts.createSourceFile('file.js',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let found;function visit(n){if(ts.isMethodDeclaration(n)&&n.name?.getText(f)===name)found=n.getText(f);ts.forEachChild(n,visit)}visit(f);assert(found);return found}
function replace(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
let s=fs.readFileSync(root+'/deployment/releases/member-signature-20261022/overlay/modules/member/formal-enrollment.service.js','utf8');const built=fs.readFileSync(root+'/backend/apps/api/dist/modules/member/formal-enrollment.service.js','utf8');
s=replace(s,'    async status(', '    '+method(built,'registrationPrefill')+'\n    async status(');
s=replace(s,'mobile: true, email: true','mobile: true, email: true, genderCode: true, identityDocumentType: true, identityDocumentNumberCiphertext: true, identityDocumentKeyVersion: true');
const old="prefill: { legalName: person.legalName ?? '', gender: 'UNDISCLOSED', birthDate: person.birthDate?.toISOString().slice(0, 10) ?? '', nationalityCode: person.nationalityCode ?? 'TW', phone: person.mobile ?? '', email: person.email ?? '' }";
s=replace(s,old,'prefill: this.registrationPrefill(person)');
const file='/overlay/modules/member/formal-enrollment.service.js';for(const base of [out,root+'/deployment/releases/registration-prefill-20261022']){fs.mkdirSync(path.dirname(base+file),{recursive:true});fs.writeFileSync(base+file,s)}
fs.writeFileSync(out+'/Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:03794bdbd86edb679fae7b6d28e5a031cbfc788fcd7de31ac5c701bf1ee0465b\nCOPY overlay/ /app/apps/api/dist/\n');console.log('Prepared registration prefill overlay');
