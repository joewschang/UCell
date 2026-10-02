import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export const profileMigration='20260928100000_binary_tree_bootstrap_profile';
export function profileUpgradeSql(){
 let sql=readFileSync(new URL(`../packages/database/prisma/migrations/${profileMigration}/migration.sql`,import.meta.url),'utf8');
 const start=sql.indexOf('UPDATE organization.binary_tree\n')>=0?'UPDATE organization.binary_tree\n':'UPDATE organization.binary_tree\r\n';
 assert.ok(sql.includes(start));assert.ok(sql.includes('    bootstrap_profile_version = 1,'));
 // The legacy version is immutable identity, not the new profile registry's integer version.
 sql=sql.replace(/    bootstrap_profile_version = 1,\r?\n/,'');
 sql=sql.replace(start,()=>`ALTER TABLE organization.binary_tree DISABLE TRIGGER tree_lifecycle_guard;\n${start}`);
 sql=sql.replace('WHERE bootstrap_profile_id IS NULL;',()=>`WHERE bootstrap_profile_id IS NULL;\nSET CONSTRAINTS ALL IMMEDIATE;\nALTER TABLE organization.binary_tree ENABLE TRIGGER tree_lifecycle_guard;`);
 return `BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE organization.binary_tree IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE profile_upgrade_before ON COMMIT DROP AS SELECT binary_tree_id,to_jsonb(t) AS original FROM organization.binary_tree t;
${sql}
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM profile_upgrade_before b FULL JOIN organization.binary_tree t USING(binary_tree_id)
 WHERE b.binary_tree_id IS NULL OR t.binary_tree_id IS NULL OR b.original IS DISTINCT FROM
 (to_jsonb(t)-ARRAY['bootstrap_profile_id','bootstrap_profile_code','bootstrap_company_ball_count','bootstrap_profile_snapshot'])) THEN
 RAISE EXCEPTION 'PROFILE_UPGRADE_CHANGED_HISTORICAL_TREE'; END IF;
 IF EXISTS(SELECT 1 FROM organization.binary_tree WHERE bootstrap_profile_code<>'LEGACY_THREE_COMPANY_BALLS' OR bootstrap_company_ball_count<>3)
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='organization.binary_tree'::regclass AND tgname='tree_lifecycle_guard' AND tgenabled='O') THEN
 RAISE EXCEPTION 'PROFILE_UPGRADE_POSTCONDITION_FAILED'; END IF;
END $$;
COMMIT;`;
}
