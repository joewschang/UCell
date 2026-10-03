// Execute in the authorized Stage runtime, with its existing secret reference.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const canonical=value=>JSON.stringify(sort(value));
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])]));return value;}
async function main(){
 const token=process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN??process.env.LINE_CHANNEL_ACCESS_TOKEN;
 if(!token)throw new Error('TOKEN_NOT_CONFIGURED');
 const definition=JSON.parse(fs.readFileSync(path.join(__dirname,'default-v1.json'),'utf8'));
 const png=fs.readFileSync(path.join(__dirname,'default-v1.png'));
 if(png.length>1000000)throw new Error('ARTWORK_TOO_LARGE');
 async function call(route,{method='GET',data,image=false}={}){
  const response=await fetch(`https://${image?'api-data':'api'}.line.me/v2/bot${route}`,{method,headers:{Authorization:`Bearer ${token}`,...(data?{'Content-Type':image?'image/png':'application/json'}:{})},body:data?(image?data:JSON.stringify(data)):undefined,signal:AbortSignal.timeout(15000)});
  if(!response.ok){await response.body?.cancel();throw new Error(`LINE_HTTP_${response.status}`);}
  return image&&method==='GET'?Buffer.from(await response.arrayBuffer()):response.json();
 }
 const info=await call('/info');if(info.basicId!=='@258vmvsa')throw new Error('OA_MISMATCH');
 const menus=(await call('/richmenu/list')).richmenus;
 let menu=menus.find(m=>m.name===definition.name),created=false;
 if(menu){for(const field of ['size','selected','chatBarText','areas'])if(canonical(menu[field])!==canonical(definition[field]))throw new Error('EXISTING_DEFINITION_MISMATCH');}
 else{menu=await call('/richmenu',{method:'POST',data:definition});created=true;}
 const id=menu.richMenuId;
 let uploaded=false;
 try{const existing=await call(`/richmenu/${id}/content`,{image:true});if(!existing.equals(png))throw new Error('EXISTING_ARTWORK_MISMATCH');}
 catch(error){if(error.message!=='LINE_HTTP_404')throw error;await call(`/richmenu/${id}/content`,{method:'POST',data:png,image:true});uploaded=true;}
 const image=await call(`/richmenu/${id}/content`,{image:true});if(!image.equals(png))throw new Error('ARTWORK_READBACK_MISMATCH');
 await call(`/user/all/richmenu/${id}`,{method:'POST'});
 const current=await call('/user/all/richmenu');if(current.richMenuId!==id)throw new Error('DEFAULT_READBACK_MISMATCH');
 console.log(JSON.stringify({event:'LINE_DEFAULT_MENU_PROVISIONED',basicId:info.basicId,defaultRichMenuId:id,created,uploaded,imageSha256:crypto.createHash('sha256').update(image).digest('hex'),areas:definition.areas.map(a=>({label:a.action.label,type:a.action.type})),verified:true}));
}
main().catch(()=>{console.error('LINE_DEFAULT_PROVISION_FAILED: inspect metadata-only audit; credentials and response bodies are not logged.');process.exitCode=1;});
