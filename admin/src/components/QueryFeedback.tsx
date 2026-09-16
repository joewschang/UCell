import {ErrorState,LoadingState,EmptyState} from '@ucell/design-system';
export function QueryFeedback({query,empty=false}:{query:{isPending:boolean;error:unknown;refetch:()=>unknown};empty?:boolean}){
 if(query.error)return <ErrorState message={query.error instanceof Error?query.error.message:String(query.error)} retry={()=>void query.refetch()}/>;
 if(query.isPending)return <LoadingState label="資料載入中…"/>;
 return empty?<EmptyState title="目前沒有符合條件的資料"/>:null;
}
