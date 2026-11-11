const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.argv[2],index=path.join(root,'index.html');
const html=fs.readFileSync(index,'utf8'),asset=html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
let js=fs.readFileSync(path.join(root,asset),'utf8');
function change(a,b){if(js.split(a).length!==2)throw Error(a);js=js.replace(a,()=>b);}
change('["常見問答管理","/faq","content"]','["標籤管理","/topics/","content"],["常見問答管理","/faq","content"]');
change('label:"內容與客服",paths:["/content",','label:"內容與客服",paths:["/content","/topics/",');
change('GR={"/daily-operations"', 'GR={"/topics/":["SUPER_ADMIN","MEMBERSHIP_OPS","ORDER_OPS"],"/daily-operations"');
change('u.map(([h,m,p])=>e.jsxs(It,{to:m,','u.map(([h,m,p])=>e.jsxs(It,{to:m,reloadDocument:m==="/topics/",');
function paperOrder(rules,products){
 const form=['TIP-363','TIP-999','TIP-580','TIP-696','TIP-777'];
 const rank=new Map();
 for(const product of products){
   const index=form.indexOf(product.sku);
   if(index>=0)for(const rule of product.ruleProfiles??[])rank.set(rule.productRuleProfileId,index);
 }
 return [...rules].sort((a,b)=>(rank.get(a.productRuleProfileId)??form.length)-(rank.get(b.productRuleProfileId)??form.length));
}
change('((ce==null?void 0:ce.selectableProducts)??[]).map(ee=>','('+paperOrder.toString()+')(ce?.selectableProducts??[],O.data?.data??[]).map(ee=>');
const next='/assets/corporate-portal-'+crypto.createHash('sha256').update(js).digest('hex').slice(0,12)+'.js';
fs.writeFileSync(path.join(root,next),js);
if(!html.includes('<script type="module" src="/topics/entry.js"></script>'))throw Error('Unknown old tag entry');
fs.writeFileSync(index,html.replace(asset,next).replace('<script type="module" src="/topics/entry.js"></script>',''));
