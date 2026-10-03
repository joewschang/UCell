const codes=['NEW_STAR','EXCELLENCE','GLORY','DIAMOND','CROWN'];
/** Display only the highest recorded achievement for the exact currently owned Ball. */
export function ballRankPresentation(growth:unknown,ownedQualificationNos:string[]):Record<string,string>{
 const value=growth as {asOf?:string;dimensions?:{globalRank?:{achieved?:unknown[]}}};
 const asOf=Date.parse(value?.asOf??''),rows=value?.dimensions?.globalRank?.achieved;
 if(!Number.isFinite(asOf)||!Array.isArray(rows))throw new Error('聘階紀錄格式異常');
 const owned=new Set(ownedQualificationNos),result:Record<string,string>={};
 for(const item of rows){const row=item as {qualificationNo?:string;rankCode?:string;achievedAt?:string};
  if(!row||typeof row.qualificationNo!=='string')throw new Error('聘階紀錄格式異常');
  if(!owned.has(row.qualificationNo))continue;
  const index=codes.indexOf(row.rankCode??''),at=Date.parse(row.achievedAt??'');
  if(index<0||!Number.isFinite(at))throw new Error('聘階紀錄格式異常');
  if(at>asOf)continue;
  if(index>codes.indexOf(result[row.qualificationNo]))result[row.qualificationNo]=codes[index];
 }
 return result;
}
