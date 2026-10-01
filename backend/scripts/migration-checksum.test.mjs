import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {migrationChecksumMatches} from './migration-checksum.mjs';
const evidence=JSON.parse(readFileSync(new URL('./stage-migration-eol-evidence.json',import.meta.url),'utf8'));
for(const row of evidence.rows)test(row.migration+' accepts recovered EOL only and rejects SQL drift',()=>{
 const text=readFileSync(new URL(`../packages/database/prisma/migrations/${row.migration}/migration.sql`,import.meta.url),'utf8');
 assert.equal(migrationChecksumMatches(row.migration,text,row.legacyChecksum),true);
 assert.equal(migrationChecksumMatches(row.migration,text+'\nSELECT 1;',row.legacyChecksum),false);
 assert.equal(migrationChecksumMatches('different-migration',text,row.legacyChecksum),false);
 assert.equal(migrationChecksumMatches(row.migration,text,'0'.repeat(64)),false);
});
