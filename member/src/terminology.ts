import type {AwardStatus} from './api';

export const availabilityText = {
  fieldMissing: '尚未提供',
  readModelMissing: '功能資料尚未接入',
  empty: '目前沒有資料',
  configurationPending: '設定待核准',
  credentialPending: '正式驗證待執行',
  requestFailed: '暫時無法載入',
  unauthorized: '沒有權限查看此資料',
} as const;

export const awardStatusLabels: Record<AwardStatus, string> = {
  PENDING: '結算中',
  CALCULATED: '已計算',
  PENDING45D: '45日等待期',
  EFFECTIVE: '已生效',
  PAYABLE: '可支付',
  PAID: '已支付',
  REVERSED: '已沖回',
  CLAWBACK: '追扣／抵扣調整',
};

export const formatNullableNumber = (value: number | null | undefined) =>
  value == null ? availabilityText.fieldMissing : value.toLocaleString('zh-TW');

export const formatNullableMoney = (value: number | null | undefined) =>
  value == null ? availabilityText.fieldMissing : `NT$ ${value.toLocaleString('zh-TW')}`;

export const qualificationActiveLabel = (active: boolean) =>
  active ? '資格狀態：有效' : '資格狀態：未有效';

const rankLabels: Record<string,string> = {
  MEMBER: '會員',
  ELITE: '菁英',
  LEADER: '領袖',
};

export const qualificationRankLabel = (rank: string) => rankLabels[rank] ?? rank;
