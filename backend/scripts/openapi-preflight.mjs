import fs from 'node:fs';

const candidates=[
  'openapi.generated.json',
  'apps/api/openapi.generated.json'
];
const file=candidates.find(fs.existsSync);
if(!file){
  console.error('OPENAPI_PREFLIGHT_FAIL: generated spec not found');
  process.exit(1);
}
const doc=JSON.parse(fs.readFileSync(file,'utf8'));
const failures=[];
if(!doc.openapi) failures.push('openapi version missing');
if(!doc.paths?.['/api/v1/health']) failures.push('/api/v1/health missing');
if(!Object.keys(doc.paths??{}).some(x=>x.includes('/admin/payouts'))) failures.push('payout endpoints missing');
if(!Object.keys(doc.paths??{}).some(x=>x.includes('/admin/settlement-adjustments'))) failures.push('adjustment endpoints missing');
if(!doc.components?.securitySchemes?.memberBearer)failures.push('Member opaque session security scheme missing');
const subscriptionList=doc.paths?.['/api/v1/admin/subscriptions']?.get;
const subscriptionParameter=name=>subscriptionList?.parameters?.find(parameter=>parameter.in==='query'&&parameter.name===name);
const ballNoParameter=subscriptionParameter('ballNo');
if(!subscriptionList)failures.push('Admin subscription list operation missing');
if(!ballNoParameter||ballNoParameter.required||ballNoParameter.schema?.maxLength!==59||ballNoParameter.schema?.pattern!=='^[A-Z][A-Z0-9_-]{0,39}(?:X\\d{6}|\\d{6,19})$')failures.push('Admin subscription Ball Number query contract missing or invalid');
const legacyQualificationId=subscriptionParameter('qualificationId');
if(!legacyQualificationId||legacyQualificationId.required||legacyQualificationId.schema?.format!=='uuid')failures.push('Admin subscription legacy Qualification query compatibility missing');
const memberRoutes={me:'get',qualifications:'get','context/qualification':'post',dashboard:'get','organization/sponsor':'get','organization/binary':'get',referrals:'get',performance:'get',bonuses:'get','bonuses/ledger':'get','repurchase/status':'get',products:'get',orders:'get','orders/{id}':'get',notifications:'get','notifications/{id}/read':'patch',profile:'patch'};
for(const [route,method] of Object.entries(memberRoutes)){
 const operation=doc.paths?.['/api/v1/member/'+route]?.[method];
 if(!operation){failures.push('Member operation missing: '+route);continue;}
 if(!operation.security?.some(security=>Object.hasOwn(security,'memberBearer')))failures.push('Member auth missing: '+route);
 if(!operation.responses?.[method==='post'?201:200]?.content?.['application/json']?.schema?.properties?.data)failures.push('Member enveloped response schema missing: '+route);
 for(const status of [401,403,404,409,422])if(!operation.responses?.[status])failures.push('Member error response missing: '+route+'/'+status);
}
for(const [route,method] of [['orders','post'],['profile','patch'],['notifications/{id}/read','patch']]){
 const operation=doc.paths?.['/api/v1/member/'+route]?.[method];
 if(!operation?.parameters?.some(parameter=>parameter.in==='header'&&parameter.name.toLowerCase()==='idempotency-key'&&parameter.required))failures.push('Mutation idempotency header missing: '+route);
 if(!operation?.requestBody)failures.push('Mutation DTO missing: '+route);
}
const orderInput=doc.components?.schemas?.MemberCreateOrderDto;
const approvedOrderFields=['qualificationId','items','packageVersionId','targetQualificationId','selections','sponsorCode','retailReferralCode'];
const orderFields=Object.keys(orderInput?.properties??{});
if(!orderInput||orderInput.additionalProperties!==false||approvedOrderFields.some(field=>!orderFields.includes(field))||orderFields.some(field=>!approvedOrderFields.includes(field)))failures.push('Member order input must contain exactly the approved retail/package checkout fields');
if(orderInput?.properties?.sponsorCode?.pattern!=='^[A-Z][A-Z0-9_-]{0,39}(?:X\\d{6,}|\\d{6,})$')failures.push('Member qualification checkout Sponsor Ball candidate contract missing or invalid');
if(orderInput?.properties?.retailReferralCode?.pattern!=='^[A-Z][A-Z0-9_-]{0,39}(?:X\\d{6,}|\\d{6,})$')failures.push('Member retail checkout referral Ball candidate contract missing or invalid');
const clientControlledMonetaryFields=['price','unitPrice','amount','lineAmount','grossAmount','discountAmount','netAmount','pv','bv','rpv','epv','bonus','carry'];
for(const schemaName of ['MemberCreateOrderDto','CreateOrderItemDto','MemberPackageSelectionDto']){
 const fields=Object.keys(doc.components?.schemas?.[schemaName]?.properties??{});
 if(fields.some(field=>clientControlledMonetaryFields.includes(field)))failures.push(`Member order input exposes client monetary field: ${schemaName}`);
}

if(failures.length){
  console.error('OPENAPI_PREFLIGHT_FAIL');
  failures.forEach(x=>console.error('-',x));
  process.exit(1);
}
console.log('OPENAPI_PREFLIGHT_PASS');
