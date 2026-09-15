import fs from 'node:fs';
const schema=fs.readFileSync('packages/database/prisma/schema.prisma','utf8');
const app=fs.readFileSync('apps/api/src/app.module.ts','utf8');
for(const x of ['AdjustmentModule','AuthModule','SettlementModule','PayoutModule']) if(!app.includes(x)) throw new Error(`missing ${x}`);
const block=schema.slice(schema.indexOf('enum BonusAwardType'),schema.indexOf('enum BonusAwardLifecycleStatus'));
for(const x of ['RPV','EPV','GLOBAL']) if(!block.includes(x)) throw new Error(`missing award type ${x}`);
if(!schema.includes('outstandingAmount')) throw new Error('partial recovery balance missing');
console.log('STATIC_VALIDATE_PASS');
