import {Children,isValidElement,type ReactNode,type ReactElement} from 'react';
import {AdminDataGrid,type GridColumn} from './AdminDataGrid';
import {UCellButton} from '@ucell/design-system';
/** Presentation adapter: preserves rendered Core cells/actions; no domain calculations. */
function text(node:ReactNode):string{return Children.toArray(node).map(n=>isValidElement(n)?text((n.props as any).children):String(n)).join(' ')}
export function AdminTable({children}:{children:ReactNode}){
 const sections=Children.toArray(children).filter(isValidElement) as ReactElement<any>[];
 const header=sections.find(n=>n.type==='thead');const body=sections.find(n=>n.type==='tbody');
 const headerRow=Children.toArray(header?.props.children).find(isValidElement) as ReactElement<any>|undefined;
 const labels=Children.toArray(headerRow?.props.children).filter(isValidElement).map(n=>text((n as ReactElement<any>).props.children));
 const rows=(Children.toArray(body?.props.children).filter(isValidElement) as ReactElement<any>[]).map((row,index)=>({id:String(row.key??index),row,cells:Children.toArray(row.props.children).filter(isValidElement) as ReactElement<any>[]}));
 const columns:GridColumn<typeof rows[number]>[]=labels.map((label,i)=>({key:String(i),label,value:(r:typeof rows[number])=>text(r.cells[i]?.props.children),render:(r:typeof rows[number])=><span className={r.cells[i]?.props.className}>{r.cells[i]?.props.children}</span>}));
 if(rows.some(r=>r.row.props.onClick))columns.push({key:'detail',label:'詳情',value:()=>'',render:r=>r.row.props.onClick?<UCellButton onClick={e=>{e.stopPropagation();r.row.props.onClick(e)}}>查看</UCellButton>:null});
 return <AdminDataGrid rows={rows} rowId={r=>r.id} columns={columns} rowProps={r=>({onClick:r.row.props.onClick,className:r.row.props.className})} label={'資料清單：'+labels.join('／')} searchable/>;
}
