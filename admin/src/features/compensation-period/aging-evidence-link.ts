export function agingEvidenceLink(category:string,thresholdHours:number):{href:string;label:string}|null{
 const scopes:Record<string,string>={PAYABLE_NOT_BATCHED:'PAYABLE',PAYOUT_EXPORTED_UNRESOLVED:'PAYOUT',BANK_TRANSFER_FAILED:'PAYOUT',RECOVERY_OUTSTANDING:'RECOVERY'};
 if(scopes[category])return {href:`/operations-control?scope=${scopes[category]}#financial-source-health`,label:'查看來源佇列與受控處理入口'};
 if(category==='ERP_BRIDGE_ATTENTION'&&Number.isInteger(thresholdHours)&&thresholdHours>=1&&thresholdHours<=8760)return {href:`/operations-control?stream=FULFILLMENT&thresholdHours=${thresholdHours}`,label:'查看履約 ERP 證據與待辦'};
 return null;
}
