export const placementReasons:Record<string,string>={
 BINARY_LEFT_SUBTREE_REQUIRED:'第 1、3 位推薦球必須安置於推薦球的左子樹。請返回推薦球，從左側往下選擇。',
 SPONSOR_SUBTREE_REQUIRED:'請在這顆推薦球下方選擇安置位置。',
 FORMAL_MEMBERSHIP_REQUIRED:'正式會員資格尚未核准，或資格已停用，請聯絡公司確認。',
 QUALIFYING_ORDER_NOT_PAID:'資格套組尚未完成付款確認，請先確認付款狀態。',
 PLACEMENT_NOT_PENDING:'此球目前無法安置，可能已完成或正在退貨審核；請重新整理。',
 QUALIFICATION_ALREADY_PLACED:'這顆球已完成安置，請重新整理待辦。',
 PLACEMENT_CONFLICT:'位置或安置資料已變動，請重新整理後再次選擇。',
 BINARY_SLOT_OCCUPIED:'這個位置已被使用，請重新整理並選擇其他位置。',
 PLACEMENT_AUTHORITY_DENIED:'您目前不是推薦球的持有人，請聯絡公司確認安置權限。',
 SPONSOR_CONFIRMATION_MISSING:'尚未完成推薦球確認，請聯絡公司補正推薦資料。',
 TREE_NOT_OPEN_TO_PLACEMENT:'這棵樹目前暫停新增安置，請聯絡公司。',
 FOUNDING_COMPANY_SPONSOR_REQUIRED:'此位置僅限指定公司球推薦，請選擇其他位置。',
 BINARY_TREE_SCOPE_MISMATCH:'待安置球與指定位置不屬於同一棵樹。',
 BINARY_PARENT_NOT_ELIGIBLE:'父球尚未生效，請選擇已生效的球。',
 TREE_BALL_NOT_FOUND:'找不到這個已安置球號，請返回推薦球重新選擇。',
 UNPLACED_TREE_BALL_REQUIRED:'這顆球已安置或不屬於目前樹，請重新整理。',
 PLACEMENT_REFERENCE_INVALID:'球號格式不正確，請重新選擇待安置球。',
};
export const placementStatus:Record<string,string>={PLACEMENT_PENDING:'待安置',PLACEMENT_OVERDUE:'已逾期',PLACED:'已完成'};
export function placementDate(value:string|null|undefined){return value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'尚未提供';}
