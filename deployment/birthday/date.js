const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'});
function taipeiDay(now=new Date()){return fmt.format(now)}
function isBirthday(birth,day){
 if(!birth)return false;
 const md=String(birth).slice(5,10);
 return md===day.slice(5)||
 md==='02-29'&&day.endsWith('-02-28')&&new Date(Number(day.slice(0,4)),1,29).getMonth()===2;
}
export {taipeiDay,isBirthday};
