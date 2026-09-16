import {ErrorBox} from './ui';
export function QueryFeedback({query,empty=false}:{query:{isPending:boolean;error:unknown;refetch:()=>unknown};empty?:boolean}){
 if(query.error)return <div role="alert"><ErrorBox error={query.error}/><button onClick={()=>void query.refetch()}>重新載入</button></div>;
 if(query.isPending)return <p role="status">資料載入中…</p>;
 return empty?<p role="status">目前沒有符合條件的資料</p>:null;
}
