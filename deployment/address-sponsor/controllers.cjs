const {Controller,Get,Post,Param,Body,UseGuards,Header,BadRequestException} = require('@nestjs/common');
const {PrismaService} = require('@ucell/database');
const {SponsorResolver} = require('./sponsor-resolver.service');
const {Roles} = require('../auth/roles.decorator');
const {MemberAuthenticationGuard} = require('../auth/member-authentication.guard');
const {decodeFile} = require('../document-intake/intake-policy');
const {recognizeDocumentImage} = require('../../common/ai/document-ocr');

function holderController(prefix, protect) {
  class Holder {
    constructor(db, resolver) { this.db=db; this.resolver=resolver; }
    async lookup(code) {
      const ball=await this.resolver.resolveWithin(this.db,{code});
      if(ball.isCompany || ball.kind==='COMPANY_ALIAS') return {name:ball.displayLabel || '公司球'};
      if(ball.sponsorOwnerLegalEntityId) {
        const entity=await this.db.legalEntity.findUnique({where:{legalEntityId:ball.sponsorOwnerLegalEntityId},select:{registeredName:true}});
        return {name:entity?.registeredName || null};
      }
      const person=await this.db.person.findUnique({where:{personId:ball.sponsorOwnerPersonId},select:{legalName:true}});
      return {name:person?.legalName || null};
    }
  }
  Reflect.defineMetadata('design:paramtypes',[PrismaService,SponsorResolver],Holder);
  Controller(prefix+'/sponsor-holder')(Holder);
  protect(Holder);
  const method=Object.getOwnPropertyDescriptor(Holder.prototype,'lookup');
  Param('code')(Holder.prototype,'lookup',0);
  Header('Cache-Control','private, no-store')(Holder.prototype,'lookup',method);
  Get(':code')(Holder.prototype,'lookup',method);
  return Holder;
}
class PaperAddress {
  async read(body) {
    if(!body || !['image/png','image/jpeg'].includes(body.mime)) throw new BadRequestException('請選擇 JPG 或 PNG 圖片');
    const bytes=decodeFile(body.content,body.mime);
    const {value}=await recognizeDocumentImage(bytes,body.mime);
    return {address:typeof value.fields.registeredAddress==='string'?value.fields.registeredAddress.trim().slice(0,500):''};
  }
}
Controller('admin/paper-order-workbench')(PaperAddress);
Roles('SUPER_ADMIN','MEMBERSHIP_OPS','ORDER_OPS')(PaperAddress);
const read=Object.getOwnPropertyDescriptor(PaperAddress.prototype,'read');
Body()(PaperAddress.prototype,'read',0);
Header('Cache-Control','private, no-store')(PaperAddress.prototype,'read',read);
Post('read-address')(PaperAddress.prototype,'read',read);
module.exports=[
  holderController('admin',Roles('SUPER_ADMIN','MEMBERSHIP_OPS','ORDER_OPS','COMPLIANCE_AUDIT','ORG_OPS','BONUS_OPS')),
  holderController('member',UseGuards(MemberAuthenticationGuard)),PaperAddress
];
