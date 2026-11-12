'use strict';
// Run with a test member/admin access token in the matching environment variable.
// Optional TEST_APPLICATION_ID is only for an application the current identity can read.
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const expected = 'DIRECT-PLACEMENT-20261112';
const expectedHash = '5933d26cb37f38233386f64265d2e875dce949f9dd5b3f244a08fb62982e9d4e';
const host='https://api.ucell.life/api/v1';
async function read(path, token) {
  const response=await fetch(host+path,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
  assert.equal(response.status,200,'GET '+path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/ig,'[test case]'));
  const json=await response.json();return json.data;
}
(async()=>{
  let checked=0;
  for(const [audience,token] of [['member',process.env.UCELL_MEMBER_READ_TOKEN],['admin',process.env.UCELL_ADMIN_READ_TOKEN]]){
    if(!token)continue;
    const url=audience==='member'?'/member/contracts/formal-required':'/admin/formal-member-applications/contracts/required';
    const rows=await read(url,token);
    assert(Array.isArray(rows));assert.equal(rows[0]?.version,expected,'first option shown to applicant');
    assert.equal(rows.filter(row=>row.version===expected).length,1);
    assert(!rows.some(row=>row.version==='INDEPENDENT-20261029'));
    assert.equal(rows[0].contentHash,expectedHash);
    if(audience==='member')assert.equal(createHash('sha256').update(rows[0].content).digest('hex'),expectedHash);
    console.log(audience,'active agreement version and hash verified');checked++;
    const app=process.env.TEST_APPLICATION_ID;
    if(!app)continue;
    assert.match(app,/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i);
    const status=await read('/'+audience+'/formal-applications/'+app+'/contract-renewal',token);
    assert.equal(typeof status.requiresRefresh,'boolean');
    assert(!(status.requiresRefresh&&status.preservedSignature),'inconsistent renewal decision');
    if(status.requiresRefresh){assert.equal(status.current?.version,expected);assert.equal(status.current?.contentHash,expectedHash);}
    const expectation=process.env.TEST_EXPECT_SIGNATURE;
    if(expectation==='preserved'){
      assert(status.preservedSignature && !status.requiresRefresh,'expected the previously signed snapshot to remain usable');
      if(audience==='member'){
        const evidence=await read('/member/formal-applications/'+app+'/documents',token);
        assert(evidence.signingContext?.contract?.id,'missing original signing context');
        assert.equal(evidence.signingContext.contract.version,'INDEPENDENT-20261029','expected original signed agreement');
      }
    }
    if(expectation==='historical' && audience==='admin'){
      const evidence=await read('/admin/formal-member-applications/'+app+'/documents',token);
      assert(evidence.some(row=>row.type==='SIGNED_APPLICATION_AGREEMENT'&&row.historicalSignature),'expected the superseded signature to remain in review history');
    }
    console.log(audience,'application renewal state',{requiresRefresh:status.requiresRefresh,preservedSignature:status.preservedSignature});
  }
  assert(checked>0,'Provide UCELL_MEMBER_READ_TOKEN or UCELL_ADMIN_READ_TOKEN.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
