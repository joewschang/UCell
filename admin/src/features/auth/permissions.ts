export type AdminRole='SUPER_ADMIN'|'MEMBERSHIP_OPS'|'ORDER_OPS'|'FINANCE'|'COMPLIANCE_AUDIT'|'CUSTOMER_SERVICE';

export const pageRoles:Record<string,AdminRole[]>={
  '/':['SUPER_ADMIN','MEMBERSHIP_OPS','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT','CUSTOMER_SERVICE'],
  '/people':['SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT'],
  '/applications':['SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT'],
  '/applications/new':['SUPER_ADMIN','MEMBERSHIP_OPS'],
  '/qualifications':['SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT'],
  '/products':['SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT'],
  '/orders':['SUPER_ADMIN','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT'],
  '/organization':['SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT'],
  '/subscriptions':['SUPER_ADMIN','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT'],
  '/bonuses':['SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT'],
  '/returns':['SUPER_ADMIN','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT'],
  '/workflows':['SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT'],
  '/payouts':['SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT'],
  '/documents':['SUPER_ADMIN','MEMBERSHIP_OPS','ORDER_OPS','COMPLIANCE_AUDIT'],
  '/audit':['SUPER_ADMIN','COMPLIANCE_AUDIT'],
  '/reports':['SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT'],
  '/uat':['SUPER_ADMIN','COMPLIANCE_AUDIT'],
  '/system':['SUPER_ADMIN','COMPLIANCE_AUDIT'],
};
export const canOpen=(role:AdminRole|undefined,path:string)=>!!role && (pageRoles[path]?.includes(role) ?? false);
