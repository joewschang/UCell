export function validTaiwanNationalId(value:string){
 const id=value.trim().toUpperCase();if(!/^[A-Z][12][0-9]{8}$/.test(id))return false;
 const codes=[10,11,12,13,14,15,16,17,34,18,19,20,21,22,35,23,24,25,26,27,28,29,32,30,31,33],code=codes[id.charCodeAt(0)-65];
 const digits=[Math.floor(code/10),code%10,...id.slice(1).split('').map(Number)];return digits.reduce((s,n,i)=>s+n*[1,9,8,7,6,5,4,3,2,1,1][i],0)%10===0;
}
export const validEmail=(value:string)=>/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(value.trim());
