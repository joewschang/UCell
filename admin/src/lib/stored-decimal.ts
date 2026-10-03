/** Display the stored decimal without binary floating-point conversion or rounding. */
export function formatStoredDecimal(value:unknown):string{
 if(typeof value!=='string')return '金額格式異常';
 const match=/^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
 if(!match)return '金額格式異常';
 const integer=match[2].replace(/^0+(?=\d)/,'').replace(/\B(?=(\d{3})+(?!\d))/g,',');
 const fraction=(match[3]??'').padEnd(2,'0');
 return `${match[1]}${integer}.${fraction}`;
}
