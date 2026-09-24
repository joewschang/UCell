export const lineNotificationTemplates=Object.freeze({
 BINDING:'UCELL_LINE_BINDING_V1',ORDER:'UCELL_ORDER_V1',SHIPMENT:'UCELL_SHIPMENT_V1',RETURN:'UCELL_RETURN_V1',SETTLEMENT:'UCELL_SETTLEMENT_V1',PAYOUT:'UCELL_PAYOUT_V1',ACTIVE_EXPIRY:'UCELL_ACTIVE_EXPIRY_V1',LINE_REBIND:'UCELL_LINE_REBIND_V1',BANK_ACCOUNT_CHANGE:'UCELL_BANK_CHANGE_V1',ANNOUNCEMENT:'UCELL_ANNOUNCEMENT_V1',
} as const);
export type LineNotificationTemplateType=keyof typeof lineNotificationTemplates;
export function lineNotificationTemplate(type:string){return Object.prototype.hasOwnProperty.call(lineNotificationTemplates,type)?lineNotificationTemplates[type as LineNotificationTemplateType]:undefined;}