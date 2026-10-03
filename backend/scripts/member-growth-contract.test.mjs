import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const spec=JSON.parse(readFileSync(new URL('../openapi.generated.json',import.meta.url),'utf8'));
const schemas=spec.components.schemas;
function resolve(value){if(value?.$ref)return schemas[value.$ref.split('/').at(-1)];if(value?.allOf?.length===1)return resolve(value.allOf[0]);return value;}
const response=resolve(spec.paths['/api/v1/member/my-growth'].get.responses['200'].content['application/json'].schema);
const growth=resolve(response.properties.data),dimensions=resolve(growth.properties.dimensions);
test('Growth documents the envelope and all seven concrete owner-scoped dimensions',()=>{
 assert.deepEqual(response.required,['data','meta']);assert.deepEqual(Object.keys(dimensions.properties).sort(),['qualification','active','globalRank','organization','repurchase','learning','events'].sort());
 const visited=new Set();function visit(value){const schema=resolve(value);assert.ok(schema);if(visited.has(schema))return;visited.add(schema);if(schema.type==='object'){assert.ok(schema.properties,'No generic undocumented objects');assert.deepEqual([...schema.required].sort(),Object.keys(schema.properties).sort());for(const field of Object.values(schema.properties))visit(field);}if(schema.type==='array')visit(schema.items);}
 visit(growth);assert.equal(growth.properties.asOf.format,'date-time');
 const qualification=resolve(resolve(dimensions.properties.qualification).properties.items.items);assert.equal(qualification.properties.qualificationNo.type,'string');assert.equal(qualification.properties.planLevelCode.nullable,true);assert.equal(qualification.properties.ballNo.nullable,true);
});
test('Recognition exposes stored statuses, bounded detail and nullable time without private IDs or numeric money',()=>{
 const recognition=resolve(resolve(dimensions.properties.repurchase).properties.recognition),counts=resolve(recognition.properties.counts),item=resolve(recognition.properties.items.items);
 assert.deepEqual(Object.keys(counts.properties).sort(),['SCHEDULED','DUE','RECOGNIZED','CANCELLED','REVERSED'].sort());for(const field of Object.values(counts.properties)){assert.equal(field.type,'integer');assert.equal(field.minimum,0);assert.match(field.description,/not independent economic recertification/);}
 assert.deepEqual(recognition.properties.itemLimit.enum,[100]);assert.equal(item.properties.recognizedAt.nullable,true);assert.equal(item.properties.recognizedAt.format,'date-time');assert.deepEqual(item.properties.recordConsistency.enum,['RECORDED','UNAVAILABLE']);
 for(const key of ['scheduledAmount','scheduledRpv']){assert.equal(item.properties[key].type,'string');assert.ok(item.properties[key].pattern);}
 assert.equal(Object.keys(item.properties).some(x=>/Id$/.test(x)),false);
 const rank=resolve(resolve(dimensions.properties.globalRank).properties.nextAchievement);assert.deepEqual(rank.properties.basis.enum,['ORIGINAL_CLOSED_PERIOD']);
});
