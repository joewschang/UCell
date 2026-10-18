import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseKycScanTags} from '../src/modules/member/kyc-scan-result';
import {FormalKycDocumentService} from '../src/modules/member/formal-kyc-document.service';
const bytes=readFileSync(join(__dirname,'fixtures/kyc-valid-1x1.png'));
const xml=(status:string)=>'<Tags><TagSet><Tag><Key>Malware scanning scan result</Key><Value>'+status+'</Value></Tag><Tag><Key>Malware scanning scan time UTC</Key><Value>2026-10-01T01:01:00Z</Value></Tag></TagSet></Tags>';
describe('Defender scan result synchronization',()=>{
 it.each([['No threats found','CLEAN'],['Malicious','INFECTED'],['Error','FAILED'],['Not scanned','FAILED']])('maps %s to %s', (value,status)=>expect(parseKycScanTags(xml(value))?.status).toBe(status));
 it('accepts actual Azure capitalization and UTC timestamp format',()=>{expect(parseKycScanTags(xml('No threats found').replaceAll('Malware scanning','Malware Scanning').replace('2026-10-01T01:01:00Z','2026-10-01 01:01:00Z'))).toEqual({status:'CLEAN',scannedAt:new Date('2026-10-01T01:01:00Z')});});
 it('ignores missing, unknown and duplicate evidence',()=>{expect(parseKycScanTags('<Tags/>')).toBeNull();expect(parseKycScanTags(xml('OK'))).toBeNull();expect(parseKycScanTags(xml('No threats found')+xml('Malicious'))).toBeNull();});
 function fixture(){const row={formalApplicationDocumentId:'DOC',formalMemberApplicationId:'APP',status:'PRESENT',malwareScanStatus:'PENDING',storageObjectKey:'PRIVATE',uploadedAt:new Date('2026-10-01'),contentSha256:createHash('sha256').update(bytes).digest('hex'),sizeBytes:bytes.length,mimeType:'image/png'};
 const tx:any={formalApplicationDocument:{updateMany:jest.fn(async()=>({count:1}))}};const db:any={$transaction:async(f:any)=>f(tx),formalApplicationDocument:{findUnique:async()=>row}};const storage:any={scanResult:jest.fn(async()=>({status:'CLEAN',scannedAt:new Date('2026-10-01T01:01:00Z')})),get:jest.fn(async()=>({bytes}))};const audit:any={write:jest.fn()};return{row,tx,storage,audit,service:new FormalKycDocumentService(db,storage,audit)};}
 it('does not require or invoke scanning for a valid image',async()=>{const h=fixture();expect((await h.service.adminContent('DOC','ADMIN','REQ')).bytes).toEqual(bytes);expect(h.storage.scanResult).not.toHaveBeenCalled();expect(h.tx.formalApplicationDocument.updateMany).not.toHaveBeenCalled();});
 it('still rejects altered file content',async()=>{const h=fixture();h.storage.get.mockResolvedValue({bytes:Buffer.from('changed')});await expect(h.service.adminContent('DOC','ADMIN','REQ')).rejects.toThrow();});
});
