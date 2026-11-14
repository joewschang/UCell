const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2]||'/app/apps/api/dist/modules/auth';
const scope=require('./email-scope.cjs');
const live="status:{notIn:['VOIDED','CLOSED']}, ..."+JSON.stringify(scope);
function update(file,before,after){
 const target=path.join(root,file+'.js');
 const src=fs.readFileSync(target,'utf8');
 if(src.split(before).length!==2)throw Error('Unexpected email lookup in '+file);
 const result=src.replace(before,()=>after);
 new Function(result);
 fs.writeFileSync(target,result);
}
const email="email: { equals: profile.email, mode: 'insensitive' }";
update('member-web-registration.service','...otherPerson, '+email,live+', '+email);
update('network-registration.service',email+', personId:',live+', '+email+', personId:');
update('member-web-auth.service',"status:{not:'VOIDED'}, email: { equals: value",live+", email: { equals: value");

update('member-web-auth.service', "email: { equals: normalized, mode: 'insensitive' }, status: 'EFFECTIVE'", "email: { equals: normalized, mode: 'insensitive' }, status: 'EFFECTIVE', ..."+JSON.stringify(scope));
