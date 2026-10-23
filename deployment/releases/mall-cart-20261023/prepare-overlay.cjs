const fs=require('fs'),path=require('path');
const [base,built,out]=process.argv.slice(2);if(!base||!built||!out)throw Error('base built out required');
function once(s,from,to){if(s.split(from).length!==2)throw Error('Patch anchor mismatch: '+from);return s.replace(from,to);}
let s=fs.readFileSync(path.join(base,'order.service.js'),'utf8');
s=once(s,'exports.OrderService = void 0;', 'exports.OrderService = void 0;\nconst checkout_snapshot_1 = require("./checkout-snapshot");');
s=once(s,'linePurpose: dto.linePurpose }, key, requestId, personId, true)', 'linePurpose: dto.linePurpose, checkout: dto.checkout }, key, requestId, personId, true)');
s=once(s,'                const order = await tx.order.create({ data: { purchaserPersonId: personId,', '                const checkout = await checkout_snapshot_1.resolveCheckoutSnapshot(tx, personId, dto.checkout, gross);\n                if (checkout) for (const line of lines) line.ruleProfileSnapshot = {...line.ruleProfileSnapshot, checkout};\n                const order = await tx.order.create({ data: { purchaserPersonId: personId,');
s=once(s,'            const sourceReferralTokenHash = dto.sourceReferralToken', '            if (member && dto.checkout) { const checkout = await checkout_snapshot_1.resolveCheckoutSnapshot(tx, actorId, dto.checkout, gross); for (const line of lines) line.ruleProfileSnapshot = {...line.ruleProfileSnapshot, checkout}; }\n            const sourceReferralTokenHash = dto.sourceReferralToken');
fs.mkdirSync(path.join(out,'order'),{recursive:true});fs.writeFileSync(path.join(out,'order/order.service.js'),s);fs.copyFileSync(path.join(built,'order/checkout-snapshot.js'),path.join(out,'order/checkout-snapshot.js'));
let c=fs.readFileSync(path.join(base,'member.controller.js'),'utf8'),n=fs.readFileSync(path.join(built,'member/member.controller.js'),'utf8');
const block=n.slice(n.indexOf('class MemberCheckoutDto {'),n.indexOf('class MemberCreateOrderDto {'));
if(!block.includes('expectedTotal'))throw Error('checkout DTO missing');
c=once(c,'class MemberCreateOrderDto {',block+'class MemberCreateOrderDto {');
const deco=n.match(/__decorate\(\[\s*\(0, class_validator_1.IsOptional\)\(\),\s*\(0, class_validator_1.ValidateNested\)\(\),\s*\(0, class_transformer_1.Type\)\(\(\) => MemberCheckoutDto\),[\s\S]*?MemberCreateOrderDto.prototype, "checkout", void 0\);/)[0];
c=once(c,'exports.MemberCreateOrderDto = MemberCreateOrderDto;', 'exports.MemberCreateOrderDto = MemberCreateOrderDto;\n'+deco);
fs.mkdirSync(path.join(out,'member'),{recursive:true});fs.writeFileSync(path.join(out,'member/member.controller.js'),c);
console.log('SCOPED_LIVE_BASE_PATCH_READY');
