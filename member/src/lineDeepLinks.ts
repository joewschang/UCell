export const lineRichMenuRoutes=Object.freeze({
  HOME:'/', ORGANIZATION:'/organization', EARNINGS:'/bonuses', SHOP:'/shop', ORDERS:'/orders', SUPPORT:'/me',
} as const);
export type LineRichMenuAction=keyof typeof lineRichMenuRoutes;
/** Only server-owned internal route values may be used as LINE Rich Menu targets. */
export function lineRichMenuTarget(action:unknown){
  return typeof action==='string'&&action in lineRichMenuRoutes
    ? lineRichMenuRoutes[action as LineRichMenuAction] : lineRichMenuRoutes.HOME;
}
