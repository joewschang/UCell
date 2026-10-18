export function fourMenu(liffId,environment){
 if(!/^[0-9]+-[A-Za-z0-9]+$/.test(liffId)||!['STAGE','PRODUCTION'].includes(environment))throw Error('Explicit environment and real LIFF ID required');
 const items=[['會員中心','/'],['活動報名','/events'],['線上商城','/shop'],['常見問答','/faq']];
 return {size:{width:2500,height:1686},selected:true,name:`UCell ${environment} Four Services Home 20261004`,chatBarText:'UCell 服務選單',areas:items.map(([label,path],i)=>({bounds:{x:i%2*1250,y:Math.floor(i/2)*843,width:1250,height:843},action:{type:'uri',label,uri:`https://liff.line.me/${liffId}${path}`}}))};
}
