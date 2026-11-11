'use strict';
const fs=require('node:fs'),path=require('node:path');
async function migrate(db){
 await db.$transaction(async tx=>{
 await tx.$queryRawUnsafe('SELECT true FROM (SELECT pg_advisory_xact_lock(261111940)) s');
 const [state]=await tx.$queryRawUnsafe("SELECT to_regclass('identity.member_type_release_v1') IS NOT NULL AS ready");
 if(state.ready)return;
 await tx.$executeRawUnsafe('DO $tables$ BEGIN '+fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8')+' END $tables$');
 for(const [fn,party,id] of [['prevent_member_no_mutation','INDIVIDUAL','person_id'],['prevent_legal_entity_member_no_mutation','LEGAL_ENTITY','legal_entity_id']]){
 const [row]=await tx.$queryRawUnsafe('SELECT pg_get_functiondef($1::regprocedure) AS src','identity.'+fn+'()');
 if(row.src.includes('identity.member_type_number_change'))continue;
 const guard="BEGIN\n IF NEW.member_no IS DISTINCT FROM OLD.member_no AND EXISTS(SELECT 1 FROM identity.member_type_number_change n WHERE n.xid=txid_current() AND n.party='"+party+"' AND n.subject=OLD."+id+" AND n.old_no=OLD.member_no AND n.new_no=NEW.member_no) THEN RETURN NEW; END IF;";
 if(!/\bBEGIN\b/.test(row.src))throw Error('Unexpected immutable-number function');
 await tx.$executeRawUnsafe(row.src.replace(/\bBEGIN\b/,guard));
 }
 await tx.$executeRawUnsafe("CREATE UNIQUE INDEX IF NOT EXISTS payout_line_economic_owner ON ledger.payout_line(payout_batch_id,recipient_qualification_id,(coalesce(detail_json->>'typeOwner','')))");
 await tx.$executeRawUnsafe('ALTER TABLE ledger.payout_line DROP CONSTRAINT IF EXISTS uq_payout_line');
 await tx.$executeRawUnsafe('CREATE TABLE identity.member_type_release_v1 (installed_at timestamptz DEFAULT now())');
 },{timeout:60000});
}
module.exports={migrate};
