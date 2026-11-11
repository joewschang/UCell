const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
async function main(){
  const db=new PGlite();
  try {
    await db.exec(`
      CREATE SCHEMA membership; CREATE SCHEMA identity; CREATE SCHEMA organization;
      CREATE TABLE organization.binary_tree_membership(qualification_id int,effective_from timestamptz,recorded_at timestamptz);
      INSERT INTO organization.binary_tree_membership VALUES(2,now(),now()),(5,now(),now());
      CREATE TABLE membership.qualification(qualification_id int,ball_no text,created_at timestamptz,qualification_no int,current_holder_person_id int,current_holder_legal_entity_id int,current_company_principal_id int);
      CREATE TABLE identity.person(person_id int,legal_name text,preferred_name text,mobile text);
      CREATE TABLE identity.legal_entity(legal_entity_id int,registered_name text);
      CREATE TABLE membership.company_principal(company_principal_id int,display_name text);
      CREATE TABLE identity.legal_entity_representative(legal_entity_id int,person_id int,effective_from timestamptz,effective_to timestamptz);
      INSERT INTO identity.person VALUES(1,'林測試','小林','+886 912-000-111'),(2,'王代表',NULL,'0987-000-222'),(3,'歷任',NULL,'0900000000');
      INSERT INTO identity.legal_entity VALUES(2,'測試企業');
      INSERT INTO identity.legal_entity_representative VALUES(2,2,now()-interval '1 day',NULL),(2,3,now()-interval '3 days',now()-interval '2 days');
      INSERT INTO membership.qualification SELECT n,'BALL-'||n,'2020-01-01',n,1,NULL,NULL FROM generate_series(12,1,-1) n;
      INSERT INTO membership.qualification VALUES (13,'ORG-1','2021-01-01',13,NULL,2,NULL);
    `);
    const noop=()=>()=>{};
    const modules={exports:{}};
    vm.runInNewContext(fs.readFileSync(require.resolve('./tree-directory.cjs'),'utf8'),{exports:modules.exports,require:()=>({Roles:noop,Get:noop,Query:noop,BadRequestException:Error})});
    class Controller {sponsorTree(){}}
    modules.exports.register(Controller);
    const instance=new Controller();
    instance.service={prisma:{$queryRaw:async(parts,...values)=>{
      const sql=parts.reduce((a,s,i)=>a+(i?'$'+i:'')+s,'');
      return (await db.query(sql,values)).rows;
    }}};
    const geo=(q)=>modules.exports.findRoots(instance.service.prisma,{q},true);
    assert.deepEqual(Array.from((await geo('')).data,r=>r.ballNo),['BALL-2','BALL-5']);
    assert.equal((await geo('0912000111')).data.length,2);
    const query=(q,page)=>instance.treeRoots({q,page});
    const page1=await query('');assert.equal(page1.data[0].ballNo,'BALL-1');assert.equal(page1.data.length,10);assert(page1.meta.hasNext);
    const page2=await query('',2);assert.deepEqual(Array.from(page2.data,r=>r.ballNo),['BALL-11','BALL-12','ORG-1']);assert(!page2.meta.hasNext);
    for(const term of ['林測試','小林','0912-000-111','+886912000111','ball-1'])assert.equal((await query(term)).data[0].ballNo,'BALL-1');
    for(const term of ['測試企業','王代表','0987000222'])assert.equal((await query(term)).data[0].name,'測試企業');
    for(const term of ['歷任','0900000000','%'])assert.equal((await query(term)).data.length,0);
    await assert.rejects(query('',0));console.log('PASS directory SQL, order, pagination, local/international mobiles, current corporate representative');
  }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
