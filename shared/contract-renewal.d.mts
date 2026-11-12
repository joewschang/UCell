import type * as React from 'react';

export interface ContractRenewalState {
  requiresRefresh:boolean;
  canRefresh:boolean;
  preservedSignature:boolean;
  snapshotHash:string;
  version:number;
  current:{id:string;version:string;title:string;content?:string;contentHash:string}|null;
}

export interface ContractRenewalCommand {
  expectedSnapshotHash:string;
  contractVersionId:string;
  contentHash:string;
  confirmed:true;
}

export function createContractRenewal(react:typeof React):React.ComponentType<{
  state?:ContractRenewalState|null;
  admin?:boolean;
  disabled?:boolean;
  save:(command:ContractRenewalCommand,key:string)=>Promise<unknown>;
  reload:()=>void|Promise<void>;
}>;
