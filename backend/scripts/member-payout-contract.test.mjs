import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const api=JSON.parse(readFileSync(new URL('../openapi.generated.json',import.meta.url)));
test('payout history is an authenticated typed Member envelope with explicit query context',()=>{
 const operation=api.paths['/api/v1/member/payouts'].get;assert.equal(operation.operationId,'memberPayoutResults');assert.deepEqual(operation.security,[{memberBearer:[]}]);
 const q=operation.parameters.find(p=>p.name==='qualificationId');assert.equal(q.required,true);assert.equal(q.schema.format,'uuid');for(const status of ['400','401','403','422'])assert.ok(operation.responses[status]);
 const body=operation.responses['200'].content['application/json'].schema;assert.deepEqual(body.required,['data','meta']);assert.equal(body.properties.data.$ref,'#/components/schemas/MemberPayoutView');
});
test('payment amounts remain exact strings and payment-result DTO contains no private bank or identity fields',()=>{
 const row=api.components.schemas.MemberPaymentResultView;for(const name of ['paidAmount','netAmount','grossAmount','recoveryOffset']){assert.equal(row.properties[name].type,'string');assert.ok(row.required.includes(name));}
 for(const name of ['personId','qualificationId','payoutBatchId','payoutLineId','payoutPaymentResultId','paymentReference','recordedByActor','bankAccount'])assert.ok(!row.properties[name]);
 assert.deepEqual(row.properties.status.enum,['PAID','FAILED']);assert.ok(row.properties.batchStatus.enum.includes('VOIDED'));
 const page=api.components.schemas.MemberPayoutView;assert.equal(page.properties.nextOffset.nullable,true);assert.equal(page.properties.items.items.$ref,'#/components/schemas/MemberPaymentResultView');
});
