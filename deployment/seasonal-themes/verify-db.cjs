// Exercise persistence without touching production member or LINE identities.
const {PGlite}=require('@electric-sql/pglite'),{state,change}=require('./season.cjs'),assert=require('node:assert/strict');
(async()=>{const pg=new PGlite(),a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',bid='00000000-0000-4000-8000-000000000003';
let linked=false,offline=false,current='old';
global.fetch=async(url,init)=>{if(offline)throw Error('unavailable');const op=init.method;if(op==='GET'&&url.endsWith('/richmenu'))return current?Response.json({richMenuId:current}):Response.json({},{status:404});if(op==='POST')current=url.split('/').at(-1);if(op==='DELETE')current=null;return Response.json({})};
function wrap(tx){return {$transaction:async cb=>pg.transaction(q=>cb(wrap(q))),$queryRawUnsafe:async(s,...v)=>(await tx.query(s,v)).rows,$executeRawUnsafe:async(s,...v)=>(await tx.query(s,v)).affectedRows,identityLink:{findMany:async({where})=>linked&&where.personId===a?[{identityLinkId:bid,providerSubject:'Utest'}]:[]}}}
const db=wrap(pg);try{await pg.exec("create schema identity; create table identity.member_season_preference(person_id uuid primary key, theme text);create table identity.member_season_menus(theme text primary key,menu_id text); create table identity.member_season_binding(identity_link_id uuid primary key,person_id uuid,previous_menu_id text,applied text); insert into identity.member_season_menus values ('lunar','red'),('christmas','green'),('newyear','blue')");
 assert.equal((await change(db,a,'christmas')).lineState,'unlinked');assert.equal((await state(db,b)).theme,'classic');
 linked=true;assert.equal((await state(db,a)).needsSync,true);offline=true;assert.equal((await change(db,a)).lineState,'pending');offline=false;assert.equal((await change(db,a)).lineState,'synced');assert.equal(current,'green');
 assert.equal((await change(db,a,'newyear')).theme,'newyear');assert.equal(current,'blue');
 await change(db,a,'lunar');assert.equal(current,'red');await change(db,a,'classic');assert.equal(current,'old');assert.equal((await state(db,a)).lineState,'default');console.log('PASS: account isolation, unlinked preference, binding, offline retry, three menus and original restoration');
 }finally{await pg.close()}})().catch(e=>{console.error(e);process.exitCode=1});
