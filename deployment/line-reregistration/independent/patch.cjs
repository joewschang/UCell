const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2]||'/app/apps/api/dist/modules/auth';
function patch(name,changes){
 const file=path.join(root,name);let src=fs.readFileSync(file,'utf8');
 for(const [a,b] of changes){if(src.split(a).length!==2)throw Error(name+': '+a);src=src.replace(a,()=>b);}
 fs.writeFileSync(file,src);
}
const email="if (profile.email && await tx.person.findFirst";
const mobile="where: { mobile: { in: (0, taiwan_mobile_1.mobileSpellings)(profile.mobile) } }";
const create="await tx.person.create({ data: { legalName: '', ...profile, membershipState: 'NETWORK_MEMBER', mobileVerifiedAt, emailVerifiedAt, status: 'EFFECTIVE' } })";
patch('member-web-registration.service.js',[
 [email,`// Only an authenticated LINE subject explicitly released from a voided person
            // can reuse that person's contact details. Other accounts still reserve them.
            const formerLink = provider === 'LINE' && !paperPerson
                ? await tx.identityLink.findUnique({where:{provider_providerSubject:{provider,providerSubject:identity.subject}},include:{person:{select:{status:true,memberNo:true}}}})
                : null;
            const former = formerLink?.status === 'REVOKED' && formerLink.person.status === 'VOIDED' ? formerLink : null;
            const otherPerson = former ? {personId:{not:former.personId}} : {};
            const sameNumber = former && profile.mobile && (0,taiwan_mobile_1.mobileSpellings)(profile.mobile).some(value=>'TW'+value===former.person.memberNo);
            `+email],
 ["where: { email: { equals: profile.email, mode: 'insensitive' }, ...(paperPerson", "where: { ...otherPerson, email: { equals: profile.email, mode: 'insensitive' }, ...(paperPerson"],
 [mobile,"where: { ...otherPerson, mobile: { in: (0, taiwan_mobile_1.mobileSpellings)(profile.mobile) } }"],
 [create,create.replace('...profile,','...profile, ...(sameNumber?{mobile:null}:{}),')],
 ['if (releasedLine) {',`// The insert allocates a new permanent member number. Attach the verified
            // contact in the same transaction after the number has been assigned.
            if (sameNumber) await tx.person.update({where:{personId:person.personId},data:{mobile:profile.mobile}});
            if (releasedLine) {`]
]);
patch('member-web-auth.service.js',[
 ["where: { email: { equals: value, mode: 'insensitive' } }","where: { status:{not:'VOIDED'}, email: { equals: value, mode: 'insensitive' } }"],
 ["where: { OR: [{ mobile: { in: [mobile, local] } }, { memberNo: value }] }","where: { status:{not:'VOIDED'}, OR: [{ mobile: { in: [mobile, local] } }, { memberNo: value }] }"]
]);
