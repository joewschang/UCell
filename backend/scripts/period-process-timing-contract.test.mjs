import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const spec=JSON.parse(readFileSync(new URL('../openapi.generated.json',import.meta.url),'utf8'));
const schemas=spec.components.schemas;
function resolve(value){
 if(value?.$ref){assert.ok(value.$ref.startsWith('#/components/schemas/'));return schemas[value.$ref.slice('#/components/schemas/'.length)];}
 if(value?.allOf?.length===1)return resolve(value.allOf[0]);
 return value;
}
function response(path){return resolve(spec.paths[path].get.responses['200'].content['application/json'].schema);}
function timing(value){
 const schema=resolve(value);
 assert.deepEqual(Object.keys(schema.properties).sort(),['basis','elapsedSeconds','enteredAt','status']);
 assert.deepEqual(schema.properties.status.enum,['RECORDED','UNAVAILABLE']);
 assert.deepEqual(schema.properties.basis.enum,['DURABLE_PROCESS_TRANSITION']);
 assert.equal(schema.properties.enteredAt.type,'string');assert.equal(schema.properties.enteredAt.format,'date-time');assert.equal(schema.properties.enteredAt.nullable,true);
 assert.equal(schema.properties.elapsedSeconds.type,'integer');assert.equal(schema.properties.elapsedSeconds.minimum,0);assert.equal(schema.properties.elapsedSeconds.nullable,true);
 assert.deepEqual([...schema.required].sort(),Object.keys(schema.properties).sort());
}
test('Compensation response documents actual process timing separately from period-end age',()=>{
 const period=resolve(response('/api/v1/admin/compensation-period-control').properties.data),job=resolve(period.properties.jobs.items);
 assert.ok(job.required.includes('processTiming'));timing(job.properties.processTiming);
 assert.match(period.properties.elapsedSeconds.description,/since period end/);
 assert.match(period.properties.elapsedSeconds.description,/not actual current-stage/);
});
test('Operations paged response documents nullable recognition timing and explicit bounded coverage',()=>{
 const page=resolve(response('/api/v1/admin/operations/control/workflow-health').properties.data),item=resolve(page.properties.items.items);
 assert.deepEqual(page.properties.coverage.enum,['CURRENT_PAGE_ONLY']);
 assert.equal(item.properties.processTiming.nullable,true);timing(item.properties.processTiming);
 assert.match(item.properties.elapsedSinceEligibleHours.description,/not actual stage entry/);
 assert.equal(page.properties.nextCursor.nullable,true);
 assert.deepEqual(item.properties.scope.enum,['PERIOD_JOB','RECOGNITION']);
});
test('both protected timing read operations retain admin authentication',()=>{
 for(const path of ['/api/v1/admin/compensation-period-control','/api/v1/admin/operations/control/workflow-health']){
  assert.ok(spec.paths[path].get.security.some(row=>'adminBearer' in row));
 }
});
