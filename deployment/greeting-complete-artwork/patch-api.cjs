const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.argv[2]||'/app/apps/api/dist/modules/daily-greetings';
const file=path.join(root,'greeting-publication.service.js'),source=fs.readFileSync(file,'utf8');
const old='normalizeGreetingUpload)(input.contentBase64)';
assert.equal(source.split(old).length,2,'Unexpected live draft service; refuse overwrite');
fs.writeFileSync(file,source.replace(old,'normalizeGreetingUpload)(input.contentBase64, input.imageMode)'));
const controller=path.join(root,'greeting-publication.controller.js'),code=fs.readFileSync(controller,'utf8');
assert(code.includes('class GreetingDraftDto')&&!code.includes('imageMode'),'Unexpected DTO');
assert(code.includes('4194304'),'Preserve existing 3 MiB DTO bound');
fs.appendFileSync(controller,`
// Explicit complete-artwork field only; all original guards and handlers remain.
require('class-validator').IsOptional()(GreetingDraftDto.prototype,'imageMode');
require('class-validator').IsIn(['background','artwork'])(GreetingDraftDto.prototype,'imageMode');
require('@nestjs/swagger').ApiPropertyOptional({enum:['background','artwork'],default:'background'})(GreetingDraftDto.prototype,'imageMode');
Reflect.defineMetadata('design:type',String,GreetingDraftDto.prototype,'imageMode');
`);
console.log('ARTWORK_LIVE_SERVICE_DTO_PATCH_PASS');
