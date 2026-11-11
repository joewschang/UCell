const normalize=value=>String(value??'').normalize('NFKC').replace(/\s/g,'').replace(/臺/g,'台');
function recognizedAddress(fields){
  return typeof fields?.registeredAddress==='string'?fields.registeredAddress.trim().slice(0,500):'';
}
function compare(address,current){
  if(!current?.trim())return '通訊地址尚未填寫，請確認收件地址。';
  return normalize(address)===normalize(current)?'與通訊地址一致，請確認收件地址。':'與通訊地址不同，請核對；已填的地址會保留。';
}
function propose(payload,extraction,value){
  const address=recognizedAddress(value.fields);
  if(!address)return;
  payload.ocrResidence=address;
  if(!payload.fields?.communicationAddress&&!extraction.fields.communicationAddress)extraction.fields.communicationAddress=address;
}
function warnings(payload){
  const list=payload.warnings??[];
  if(!payload.ocrResidence)return list;
  return [...list,'證件背面戶籍地址：'+payload.ocrResidence+'。'+compare(payload.ocrResidence,payload.fields?.communicationAddress)];
}
module.exports={propose,warnings,recognizedAddress};
