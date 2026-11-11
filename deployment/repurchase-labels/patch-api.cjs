const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
function replace(relative,search,replacement){
 const file=path.join(root,relative),before=fs.readFileSync(file,'utf8');
 if(before.split(search).length!==2)throw Error('Unexpected source: '+relative);
 fs.writeFileSync(file,before.replace(search,replacement));
}
const anchor='const body = (0, json_safe_1.toJsonSafe)(raw);';
replace('common/interceptors/envelope.interceptor.js',anchor,anchor+"\n            require('../utils/repurchase-display').formatRepurchaseNames(body);");
replace('modules/subscription/subscription.controller.js','季/半年/年預付重銷方案','重銷（三個月）、重銷（六個月）、重銷（十二個月）方案');
