const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
const service = path.join(root, 'person.service.js');
let code = fs.readFileSync(service, 'utf8').replace(/\r\n/g, '\n');
function edit(before, after) {
  if (code.split(before).length !== 2) throw Error('Unexpected person portfolio: ' + before);
  code = code.replace(before, () => after);
}
edit('async qualifications(personId, take = 20, skip = 0)', 'async qualifications(personId, take = 20, skip = 0, entity = false)');
edit('const person = await tx.person.findUnique({ where: { personId }, select: { personId: true } });',
     'const person = entity ? await tx.legalEntity.findUnique({where:{legalEntityId:personId},select:{legalEntityId:true}}) : await tx.person.findUnique({ where: { personId }, select: { personId: true } });');
edit('const where = { currentHolderPersonId: personId };','const where = entity ? {currentHolderLegalEntityId:personId} : {currentHolderPersonId:personId};');
fs.writeFileSync(service, code);
fs.appendFileSync(path.join(root,'person.controller.js'), `
{
  const {Get,Param,Query}=require('@nestjs/common');
  const proto=exports.PersonController.prototype;
  proto.entityPortfolio=function(id,take,skip){return this.service.qualifications(id,Number(take??20),Number(skip??0),true)};
  Param('id')(proto,'entityPortfolio',0);
  Query('take')(proto,'entityPortfolio',1);
  Query('skip')(proto,'entityPortfolio',2);
  Get('entities/:id/qualifications')(proto,'entityPortfolio',Object.getOwnPropertyDescriptor(proto,'entityPortfolio'));
}
`);
