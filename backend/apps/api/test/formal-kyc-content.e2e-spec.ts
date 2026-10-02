import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {validKycImage} from '../src/modules/member/kyc-image-validation';
import {FormalKycDocumentService} from '../src/modules/member/formal-kyc-document.service';

const png=readFileSync(join(__dirname,'fixtures/kyc-valid-1x1.png'));
const jpeg=readFileSync(join(__dirname,'fixtures/kyc-valid-1x1.jpg'));
function harness(){
  const application={formalMemberApplicationId:'app',personId:'person',applicantType:'INDIVIDUAL',sourceChannel:'MEMBER_WEB',status:'DRAFT'};
  const record={formalApplicationDocumentId:'document',formalMemberApplicationId:'app',documentType:'IDENTITY_FRONT',status:'PRESENT',malwareScanStatus:'CLEAN',storageObjectKey:'private-test-object',mimeType:'image/png',sizeBytes:png.length,contentSha256:createHash('sha256').update(png).digest('hex')};
  const tx:any={formalMemberApplication:{findFirst:jest.fn(async()=>application)},formalApplicationDocument:{updateMany:jest.fn(),create:jest.fn(async({data}:any)=>({formalApplicationDocumentId:'new-document',...data}))}};
  const db:any={formalMemberApplication:{findFirst:jest.fn(async()=>application)},formalApplicationDocument:{findUnique:jest.fn(async()=>record)},$transaction:jest.fn(async(work:any)=>work(tx))};
  const storage={put:jest.fn(),get:jest.fn(async()=>({bytes:png,mimeType:'text/html'}))};
  const audit={write:jest.fn()};
  return {application,record,tx,db,storage,audit,service:new FormalKycDocumentService(db,storage as any,audit as any)};
}
describe('Private KYC content validation and scan fail-closed boundaries',()=>{
  it.each([[png,'image/png'],[jpeg,'image/jpeg']] as const)('accepts the actual %s fixture under its MIME without treating validation as malware scanning',(bytes,mime)=>{
    expect(validKycImage(bytes,mime)).toBe(true);
  });
  it.each([['spoofed HTML',Buffer.from('<html><script>unsafe()</script></html>')],['signature only',png.subarray(0,8)],['truncated',png.subarray(0,png.length-1)],['appended content',Buffer.concat([png,Buffer.from('<html>')])]])('rejects malformed PNG: %s',(_label,bytes)=>{
    expect(validKycImage(bytes,'image/png')).toBe(false);
  });
  it('rejects PNG corruption and MIME mismatches',()=>{
    const damaged=Buffer.from(png);damaged[damaged.length-5]^=1;
    expect(validKycImage(damaged,'image/png')).toBe(false);
    expect(validKycImage(png,'image/jpeg')).toBe(false);
    expect(validKycImage(jpeg,'image/png')).toBe(false);
    expect(validKycImage(jpeg.subarray(0,jpeg.length-2),'image/jpeg')).toBe(false);
    expect(validKycImage(Buffer.concat([jpeg,Buffer.from('<html>')]),'image/jpeg')).toBe(false);
  });
  it('never writes MIME-spoofed or noncanonical base64 content to storage or DB',async()=>{
    const h=harness();
    await expect(h.service.upload('person','app','IDENTITY_FRONT','image/png',Buffer.from('<script>unsafe()</script>').toString('base64'),'request')).rejects.toMatchObject({response:{code:'FORMAL_KYC_DOCUMENT_CONTENT_INVALID'}});
    await expect(h.service.upload('person','app','IDENTITY_FRONT','image/png','not-base64!','request')).rejects.toMatchObject({response:{code:'FORMAL_KYC_DOCUMENT_ENCODING_INVALID'}});
    expect(h.storage.put).not.toHaveBeenCalled();expect(h.db.$transaction).not.toHaveBeenCalled();
  });
  it('stores validated images as PENDING and excludes bytes/private keys from response and audit',async()=>{
    const h=harness(),result=await h.service.upload('person','app','IDENTITY_FRONT','image/png',png.toString('base64'),'request');
    expect(result.scanStatus).toBe('PENDING');
    expect(h.tx.formalApplicationDocument.create).toHaveBeenCalledWith({data:expect.objectContaining({malwareScanStatus:'PENDING',contentSha256:createHash('sha256').update(png).digest('hex')})});
    const publicEvidence=JSON.stringify([result,h.audit.write.mock.calls]);
    expect(publicEvidence).not.toContain(png.toString('base64'));
    expect(publicEvidence).not.toContain('formal/app/');
  });
  it('rechecks draft state in the metadata transaction after the object upload',async()=>{
    const h=harness();h.tx.formalMemberApplication.findFirst.mockResolvedValueOnce({...h.application,status:'UNDER_REVIEW'});
    await expect(h.service.upload('person','app','IDENTITY_FRONT','image/png',png.toString('base64'),'request')).rejects.toMatchObject({response:{code:'FORMAL_APPLICATION_LOCKED'}});
    expect(h.tx.formalApplicationDocument.create).not.toHaveBeenCalled();
    expect(h.tx.formalApplicationDocument.updateMany).not.toHaveBeenCalled();
  });
  it.each(['PENDING','FAILED','INFECTED'])('does not stream a document whose malware scan is %s',async status=>{
    const h=harness();h.record.malwareScanStatus=status;
    await expect(h.service.adminContent('document','admin','request')).rejects.toMatchObject({response:{code:'FORMAL_KYC_SCAN_CLEAN_REQUIRED'}});
    expect(h.storage.get).not.toHaveBeenCalled();
  });
  it('rejects bytes changed in object storage before returning any content',async()=>{
    const h=harness();h.storage.get.mockResolvedValueOnce({bytes:Buffer.from('changed'),mimeType:'image/png'});
    await expect(h.service.adminContent('document','admin','request')).rejects.toMatchObject({response:{code:'FORMAL_KYC_DOCUMENT_INTEGRITY_FAILED'}});
    expect(h.audit.write).not.toHaveBeenCalled();
  });
  it('audits clean reads and serves the verified MIME instead of arbitrary storage content-type',async()=>{
    const h=harness(),content=await h.service.adminContent('document','admin','request');
    expect(content).toEqual({bytes:png,mimeType:'image/png'});
    expect(h.audit.write).toHaveBeenCalledWith(h.tx,expect.objectContaining({action:'FORMAL_KYC_DOCUMENT_VIEWED',actorId:'admin'}));
  });
});
