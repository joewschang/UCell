import type * as React from 'react';
export function createReviewPayoutMethod(react: typeof React): React.ComponentType<{
  detail: {id:string;status:string;payoutMethod?:string;payoutMethodVersion?:number};
  canEdit:boolean;blocked:boolean;setBusy:(busy:boolean)=>void;
  save:(path:string,body:unknown)=>Promise<unknown>;reload:()=>Promise<unknown>;
}>;
