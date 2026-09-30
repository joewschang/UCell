const labels:Record<string,string>={
 SUPER_ADMIN:'系統管理員',MEMBERSHIP_OPS:'會員營運',ORDER_OPS:'訂單營運',FINANCE:'財務',
 COMPLIANCE_AUDIT:'法遵稽核',CUSTOMER_SERVICE:'客服',QUALIFICATION_PLACEMENT_OVERRIDE:'資格安置管理',
 PACKAGE_CONFIG_MANAGE:'方案設定管理',PACKAGE_CONFIG_APPROVE:'方案設定核准',
};
export function adminRoleLabel(role:string|undefined){return role?labels[role]??'角色待確認':'未驗證';}
