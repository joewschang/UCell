const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2]||'/app/apps/api/dist/modules/auth';
function edit(file,fn){
 const dest=path.join(root,file+'.js');let src=fs.readFileSync(dest,'utf8');
 fn((a,b)=>{if(src.split(a).length!==2)throw Error(file+': '+a);src=src.replace(a,()=>b);},()=>src);
 new Function(src);fs.writeFileSync(dest,src);
}
const helper='require("./registration-mobile.cjs")',current='...'+helper+'.currentMembers, ';
edit('member-web-registration.service',(replace,source)=>{
 const text=source(),a=text.indexOf('const formerLink ='),b=text.indexOf('if (profile.email',a);
 if(a<0||b<a||!text.slice(a,b).includes('const sameNumber ='))throw Error('Unexpected member number logic');
 replace(text.slice(a,b),'const sameNumber = !paperPerson && await '+helper+'.numberReserved(tx,profile.mobile);\n            ');
 replace('...otherPerson, mobile:',current+'mobile:');
 replace("mobile: { in: phones }, status: { not: 'VOIDED' }","mobile: { in: phones }, "+current.slice(0,-2));
});
edit('network-registration.service',replace=>{
 replace('where: { mobile: { in: (0, taiwan_mobile_1.mobileSpellings)(profile.mobile) }','where: { '+current+'mobile: { in: (0, taiwan_mobile_1.mobileSpellings)(profile.mobile) }');
 replace('const updated = await tx.person.update','const reserved = await '+helper+'.numberReserved(tx,profile.mobile,personId);\n                const updated = await tx.person.update');
 replace("...profile, membershipState: 'NETWORK_MEMBER'","...profile, ...(reserved?{mobile:null}:{}), membershipState: 'NETWORK_MEMBER'");
 replace('await tx.personMembershipStateEvent.create','if(reserved) await tx.person.update({where:{personId},data:{mobile:profile.mobile}});\n                await tx.personMembershipStateEvent.create');
});
edit('member-web-auth.service',replace=>{
 replace("status:{not:'VOIDED'}, OR: [{ mobile:",current+'OR: [{ mobile:');
});
