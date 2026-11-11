const fs=require('fs'),path=require('path');
const dir=process.argv[2],svc='formal-kyc-document.service.js';
function edit(file,old,updated,count=1){
 const location=path.join(dir,file),js=fs.readFileSync(location,'utf8').replaceAll('\r\n','\n');
 if(js.split(old).length!==count+1)throw Error('Unexpected source '+old.slice(0,80));
 fs.writeFileSync(location,js.split(old).join(updated));
}
edit(svc,'const REQUIRED_WEB', "const link = require('./evidence-link.cjs');\nconst REQUIRED_WEB");
edit(svc,'if (!ALLOWED_MIME.has(mimeType))',"const registrationUpload=adminActorId&&type==='CORPORATE_REGISTRATION';\n        if (!ALLOWED_MIME.has(mimeType)&&!(registrationUpload&&mimeType==='application/pdf'))");
edit(svc,'if (!(0, kyc_image_validation_1.validKycImage)(bytes, mimeType))',"if(registrationUpload)require('../person/evidence.cjs').evidence({mime:mimeType,base64:contentBase64});\n        else if (!(0, kyc_image_validation_1.validKycImage)(bytes, mimeType))");
edit(svc,'const created = await tx.formalApplicationDocument.create','if(registrationUpload)await link.saveLinked(tx,current,mimeType,contentBase64,adminActorId);\n                const created = await tx.formalApplicationDocument.create');
edit(svc,'return rows.map(r => ({ id: r.formalApplicationDocumentId','const proof=await link.registration(this.db,app);\n        return [...(proof?[proof]:[]),...rows.map(r => ({ historicalSignature:link.history(r), id: r.formalApplicationDocumentId');
edit(svc,'reviewedAt: r.reviewedAt?.toISOString() ?? null }));','reviewedAt: r.reviewedAt?.toISOString() ?? null }))];');
edit(svc,"if (!row || !row.storageObjectKey || row.status === 'SUPERSEDED')",`if(!row){
          const proof=await link.content(this.db,documentId);
          if(proof){
            await this.db.$transaction(tx=>this.audit.write(tx,{actorType:'ADMIN',actorId,action:'FORMAL_KYC_DOCUMENT_VIEWED',entityType:'FormalApplicationDocument',entityId:documentId,afterData:{applicationId:proof.applicationId,documentType:'CORPORATE_REGISTRATION',source:'MEMBER_PROFILE'},requestId,correlationId:(0,node_crypto_1.randomUUID)()}));
            return proof;
          }
        }
        if (!row || !row.storageObjectKey || (row.status === 'SUPERSEDED'&&!link.history(row)))`);
const from='async adminContent(documentId, actorId, requestId)';
const file=path.join(dir,svc),s=fs.readFileSync(file,'utf8'),at=s.indexOf(from);
const tail=s.slice(at).replace("if (row.status !== 'PRESENT')","if (row.status !== 'PRESENT'&&!link.history(row))");
fs.writeFileSync(file,s.slice(0,at)+tail);
edit(svc,'!(0, kyc_image_validation_1.validKycImage)(blob.bytes, row.mimeType)',"!(row.documentType==='CORPORATE_REGISTRATION'&&row.mimeType==='application/pdf'?blob.bytes.subarray(0,5).toString()==='%PDF-'&&blob.bytes.subarray(-1024).includes(Buffer.from('%%EOF')):(0, kyc_image_validation_1.validKycImage)(blob.bytes, row.mimeType))",2);
edit('admin-formal-member-application.controller.js',"(0, class_validator_3.IsIn)(['image/jpeg', 'image/png']),","(0, class_validator_3.IsIn)(['image/jpeg', 'image/png','application/pdf']),");
edit(svc,'if(registrationUpload)await link.saveLinked(tx,current,mimeType,contentBase64,adminActorId);',`if(registrationUpload){
                  if(current.status==='APPROVED' && await link.registration(tx,current))
                    throw new common_1.ForbiddenException({code:'FORMAL_DOCUMENT_ALREADY_PRESENT'});
                  await link.saveLinked(tx,current,mimeType,contentBase64,adminActorId);
                }`);
