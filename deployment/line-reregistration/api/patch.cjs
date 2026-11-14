const fs=require('node:fs');
const file=process.argv[2]||'/app/apps/api/dist/modules/auth/member-web-registration.service.js';
let s=fs.readFileSync(file,'utf8');
function once(a,b){if(s.split(a).length!==2)throw Error('Unexpected registration implementation: '+a);s=s.replace(a,()=>b);}
once('if (existingIdentity)','const releasedLine = provider === "LINE" && existingIdentity?.status === "REVOKED";\n            if (existingIdentity && !releasedLine)');
const insert='await tx.identityLink.create({ data: { personId: person.personId, provider, providerSubject: identity.subject, email: identity.email, displayName: identity.displayName } });';
once(insert,'if (releasedLine) {\n                await require("./verified-line-binding").createVerifiedLineBinding(tx, person.personId, identity.subject, existingIdentity, identity.displayName);\n            } else {\n                '+insert+'\n            }');
fs.writeFileSync(file,s);
