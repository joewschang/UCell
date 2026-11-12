export const mallCategories = ['會員資格套組', '重銷方案套組', '主商品', '促銷商品套組'] as const;
export type MallCategory = typeof mallCategories[number];

// Existing shared links used the localized category name as their query parameter.
const legacyRepurchaseCategory = decodeURIComponent('%E9%87%8D%E8%B3%BC%E6%96%B9%E6%A1%88%E5%A5%97%E7%B5%84');

export function mallCategoryFromLink(value: string | null): MallCategory | undefined {
  if (value === 'repurchase' || value === legacyRepurchaseCategory) return '重銷方案套組';
  return mallCategories.find(category => category === value);
}
