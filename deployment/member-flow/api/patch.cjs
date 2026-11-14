const fs=require('node:fs');
const file='/app/apps/api/dist/modules/qualification/qualification-placement.service.js';
let text=fs.readFileSync(file,'utf8');
function replace(a,b){
  if(text.split(a).length!==2) throw Error('Unexpected placement lookup: '+a);
  text=text.replace(a,b);
}
replace('qualificationId: true, qualificationNo: true, ballNo: true } })]);','qualificationId: true, qualificationNo: true, ballNo: true, currentHolder: {select:{legalName:true}}, currentHolderLegalEntity: {select:{registeredName:true}} } })]);');
replace('memberNoByPerson = new Map','nameByPerson = new Map(people.map(p=>[p.personId,p.legalName])), memberNoByPerson = new Map');
replace('personId: true, memberNo: true } }), this.db.qualification.findMany','personId: true, memberNo: true, legalName: true } }), this.db.qualification.findMany');
replace('return { ...this.view(x, now, { memberNo:', 'return { pendingMemberName: pending?.currentHolderLegalEntity?.registeredName || pending?.currentHolder?.legalName || nameByPerson.get(x.ownerPersonId) || null, ...this.view(x, now, { memberNo:');
fs.writeFileSync(file,text);

