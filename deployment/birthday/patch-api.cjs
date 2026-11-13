const fs=require('node:fs'),root='/app/apps/api/dist',season=root+'/season/season.cjs';
let s=fs.readFileSync(season,'utf8');const old="const theme=prefs[0]?.theme||'classic',active=await links(db,id);";
if(s.split(old).length!==2)throw Error('Unexpected seasonal resolver');
s=s.replace(old,`const {birthdaySQL,eligible,dateFrom}=require('../birthday/service.cjs');
 const birthday=await db.$queryRawUnsafe("select 1 as ok from identity.person p cross join "+dateFrom+" where p.person_id=$1::uuid and "+eligible+" and ("+birthdaySQL+")",id);
 const saved=prefs[0]?.theme||'classic',theme=birthday.length?'birthday':saved,active=await links(db,id);`);
// The established picker expects the saved selectable theme; its reconciliation still uses the effective choice.
s=s.replace('return {theme,lineState:', 'return {theme:saved,effectiveTheme:theme,lineState:').replace('const choice=(await state(tx,id)).theme;', 'const choice=(await state(tx,id)).effectiveTheme;');
if(!s.includes('const choice=(await state(tx,id)).effectiveTheme;')||!s.includes('return {theme:saved'))throw Error('Unexpected menu reconciliation');
fs.writeFileSync(season,s);
fs.appendFileSync(root+'/main.js',"\nrequire('./birthday/service.cjs').start();\n");
