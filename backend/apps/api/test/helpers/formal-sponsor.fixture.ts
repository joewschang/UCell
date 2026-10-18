import {createHash} from 'node:crypto';
import {PiiCryptoService} from '../../src/common/security/pii-crypto.service';
import {createEffectiveMemberSponsorFixture} from './member-sponsor.fixture';
export async function attachFormalSponsor(db:any,id:string){
 const f=await createEffectiveMemberSponsorFixture(db),pii=new PiiCryptoService();
 const old=await db.formalMemberApplicationSnapshot.findFirst({where:{formalMemberApplicationId:id},orderBy:{version:'desc'}});
 const payload={...(old?pii.decrypt<any>(old.payloadCiphertext,old.keyVersion):{}),sponsorBallNo:f.qualification.ballNo};
 const encrypted=pii.encrypt(payload),hash=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 await db.formalMemberApplicationSnapshot.create({data:{formalMemberApplicationId:id,version:(old?.version??0)+1,payloadCiphertext:encrypted.ciphertext,keyVersion:encrypted.keyVersion,payloadHash:hash}});
 await db.formalMemberApplication.update({where:{formalMemberApplicationId:id},data:{currentSnapshotHash:hash}});return f;
}
