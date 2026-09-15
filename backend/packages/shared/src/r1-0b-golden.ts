export const R10B={
  referral:{STARTER:0.15,ELITE:0.20,LEADER:0.25},
  equalization:{
    STARTER:{2:0.10,3:0.10,4:0.10},
    ELITE:{2:0.20,3:0.10,4:0.10,5:0.05,6:0.05},
    LEADER:{2:0.20,3:0.15,4:0.10,5:0.10,6:0.10,7:0.05}
  },
  pools:{referral:0.42,binary:0.36,matching:0.15,global:0.05,welfare:0.02},
  binaryRate:0.12,
  matching:{1:0.15,2:0.10,3:0.05,4:0.05,5:0.05},
  rpvDepth:(directs:number)=>directs<=0?5:(directs===1?8:12),
  epv:(purchase:number)=>Math.max(0,purchase-2000)*0.60
} as const;
export function k(pool:number,theory:number){return theory<=0?1:Math.min(1,pool/theory)}
