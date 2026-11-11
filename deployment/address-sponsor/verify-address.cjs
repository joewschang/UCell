const assert=require('node:assert/strict');
const {propose,warnings}=require('./address.cjs');
const value={fields:{registeredAddress:'臺北市中正區測試路１０號'}};
for(const [saved,observed,expected] of [['','','臺北市中正區測試路１０號'],['舊地址','',''],['','表單通訊地址','表單通訊地址']]){
  const payload={fields:{communicationAddress:saved}},result={fields:{communicationAddress:observed}};
  propose(payload,result,value);
  assert.equal(result.fields.communicationAddress,expected);
  if(!saved)payload.fields.communicationAddress=expected;
  payload.warnings=['後續頁面提示'];
  assert.equal(warnings(payload).length,2);
  assert.match(warnings(payload)[1],saved||observed?/不同/:/一致/);
  payload.fields.communicationAddress='台北市中正區測試路10號';
  assert.match(warnings(payload)[1],/一致/);
}
const payload={fields:{}},extraction={fields:{}};
propose(payload,extraction,{fields:{registeredAddress:'',birthplace:'台北市'}});
assert.deepEqual(extraction.fields,{});assert.deepEqual(warnings(payload),[]);
console.log('Address proposals and cross-page comparisons passed');
