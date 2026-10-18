/** Sum stored decimals exactly; invalid input remains visibly invalid. */
export function sumStoredDecimals(values:unknown[]):string|null{
 const parts=values.map(value=>typeof value==='string'?/^(-?)(\d+)(?:\.(\d+))?$/.exec(value):null);
 if(parts.some(part=>!part))return null;
 const scale=Math.max(0,...parts.map(part=>part![3]?.length??0));
 const total=parts.reduce((sum,part)=>sum+(part![1]==='-'?-1n:1n)*BigInt(part![2]+(part![3]??'').padEnd(scale,'0')),0n);
 const digits=(total<0n?-total:total).toString().padStart(scale+1,'0');
 return (total<0n?'-':'')+(scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits);
}

/** Display the stored decimal without binary floating-point conversion or rounding. */
export function formatStoredDecimal(value:unknown):string{
 if(typeof value!=='string')return '金額格式異常';
 const match=/^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
 if(!match)return '金額格式異常';
 const integer=match[2].replace(/^0+(?=\d)/,'').replace(/\B(?=(\d{3})+(?!\d))/g,',');
 const fraction=(match[3]??'').padEnd(2,'0');
 return `${match[1]}${integer}.${fraction}`;
}
