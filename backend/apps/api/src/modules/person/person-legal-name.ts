import { PiiCryptoService } from '../../common/security/pii-crypto.service';
/** Read-only projection; never substitute a nickname or persist unapproved identity data. */
export async function projectPersonLegalNames(db:any, rows:any[], pii=new PiiCryptoService()) {
 const missing=rows.filter(row=>!row.legalName?.trim());
 const applications=missing.length?await db.formalMemberApplication.findMany({
  where:{personId:{in:missing.map(row=>row.personId)},applicantType:'INDIVIDUAL',status:{in:['DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_MORE_INFO','APPROVED']}},
  orderBy:[{updatedAt:'desc'},{formalMemberApplicationId:'asc'}],
  select:{personId:true,status:true,snapshots:{orderBy:{version:'desc'},take:1,select:{payloadCiphertext:true,keyVersion:true}}}
 }):[];
 const latest=new Map<string,any>();for(const app of applications)if(!latest.has(app.personId))latest.set(app.personId,app);
 return rows.map(row=>{
  if(row.legalName?.trim())return {...row,legalNameSource:'PROFILE',legalNameApplicationStatus:null};
  const app=latest.get(row.personId),snapshot=app?.snapshots[0];
  if(snapshot){try{const payload=pii.decrypt<{legalName?:unknown}>(snapshot.payloadCiphertext,snapshot.keyVersion);const name=typeof payload.legalName==='string'?payload.legalName.trim():'';
   if(name)return {...row,legalName:name,legalNameSource:'APPLICATION',legalNameApplicationStatus:app.status};
  }catch{return {...row,legalName:'',legalNameSource:'UNAVAILABLE',legalNameApplicationStatus:null};}}
  return {...row,legalName:'',legalNameSource:'MISSING',legalNameApplicationStatus:null};
 });
}
