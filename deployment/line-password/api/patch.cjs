const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2]||'/app/apps/api/dist/modules/auth';
function patch(file,edits){
 const p=path.join(root,file+'.js');let src=fs.readFileSync(p,'utf8');
 for(const [a,b] of edits){if(src.split(a).length!==2)throw Error(file+': '+a);src=src.replace(a,()=>b);}
 new Function(src);fs.writeFileSync(p,src);
}
const descriptor='(0, swagger_1.ApiProperty)({ minLength: 6, maxLength: 256 }),';
patch('member-web-registration.controller',[[descriptor,'(0, class_validator_1.ValidateIf)(dto => !dto.lineIdToken || dto.password !== undefined),\n    '+descriptor.replace('ApiProperty)','ApiPropertyOptional)')]]);
const create='await tx.memberPasswordCredential.create({ data: { personId: person.personId, passwordHash: this.passwordHash(input.password) } });';
patch('member-web-registration.service',[[create,'if (provider !== "LINE" || input.password !== undefined) '+create]]);
const methods='return { google: links.some';
patch('member-web-auth.service',[[methods,'const hasPassword=Boolean(await this.db.memberPasswordCredential.findUnique({where:{personId},select:{personId:true}}));\n        return { hasPassword, google: links.some']]);
const insert='methods(req) { return this.service.loginMethods(req.user.personId); }';
const marker='exports.MemberIdentityLinkController = MemberIdentityLinkController;';
patch('member-identity-link.controller',[
 [insert,insert+`
    async initialPassword(req,body) {
      const personId=req.user.personId;
      if(typeof body?.password!=='string')throw new common_1.BadRequestException({code:'PASSWORD_POLICY'});
      const methods=await this.service.loginMethods(personId);
      if(!methods.line)throw new common_1.ForbiddenException({code:'LINE_BINDING_REQUIRED'});
      if(methods.hasPassword)throw new common_1.ConflictException({code:'PASSWORD_ALREADY_SET'});
      const passwordHash=await this.service.hashPassword(body.password);
      try {
        await this.service.db.memberPasswordCredential.create({data:{personId,passwordHash}});
      } catch(error) {
        if(error.code==='P2002')throw new common_1.ConflictException({code:'PASSWORD_ALREADY_SET'});
        throw error;
      }
      return {hasPassword:true};
    }`],
 [marker,marker+`
__decorate([(0,common_1.Post)('password/initial'),
 __param(0,(0,common_1.Req)()), __param(1,(0,common_1.Body)()),
 __metadata("design:paramtypes",[Object,Object])
],MemberIdentityLinkController.prototype,"initialPassword",null);`]
]);
