const roles={SUPER_ADMIN:'系統管理員',MEMBERSHIP_OPS:'會員營運',ORDER_OPS:'訂單營運',FINANCE:'財務',COMPLIANCE_AUDIT:'法遵稽核',CUSTOMER_SERVICE:'客服'};
export function staffPage(React,jsx){
 return function StaffAccounts(){
 const [rows,setRows]=React.useState([]),[edit,select]=React.useState(null),[message,notify]=React.useState(''),[busy,working]=React.useState(false);
 async function request(body){
  const response=await fetch('https://api.ucell.life/api/v1/auth/admin/staff-accounts',{method:body?'POST':'GET',cache:'no-store',headers:{Authorization:'Bearer '+sessionStorage.getItem('ucell_admin_token'),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const result=await response.json();if(!response.ok)throw Error(response.status===403?'需要系統管理員權限。':typeof result.message==='string'?result.message:'讀取或儲存失敗。');return result.data;
 }
 async function load(){try{setRows(await request())}catch(err){notify(err.message)}}
 React.useEffect(()=>{load()},[]);
 async function submit(event){
  event.preventDefault();if(busy)return;
  const fields=Object.fromEntries(new FormData(event.currentTarget));working(true);notify('');
  try{await request({...fields,...edit});select(null);notify('後台授權已更新。');await load()}catch(err){notify(err.message)}finally{working(false)}
 }
 const field=(label,name,props={})=>jsx('label',{children:[label,jsx('input',{name,required:true,...props})]});
 return jsx('section',{className:'card',children:[jsx('h1',{children:'後台登入帳號'}),jsx('p',{children:'管理 Microsoft Entra 登入授權。停用授權會登出該授權的後台工作階段。'}),message&&jsx('p',{role:'status',children:message}),
 edit?jsx('form',{key:edit.action+edit.id,onSubmit:submit,children:[
 jsx('h2',{children:edit.action==='create'?'新增後台登入帳號':(edit.action==='resume'?'恢復授權':'停用授權')+' · '+edit.display}),
 edit.action==='create'&&field('管理員姓名','name',{maxLength:80}),edit.action==='create'&&field('Microsoft Entra 使用者識別碼（OID）','subject',{placeholder:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}),
 edit.action==='create'&&jsx('label',{children:['角色',jsx('select',{name:'role',required:true,defaultValue:'',children:[jsx('option',{value:'',children:'請選擇角色'}),...Object.entries(roles).map(([value,label])=>jsx('option',{value,children:label},value))]})]}),
 field('異動原因','reason',{minLength:2,maxLength:240}),jsx('button',{disabled:busy,children:'確認儲存'}),jsx('button',{type:'button',disabled:busy,onClick:()=>select(null),children:'取消'})
 ]}):jsx('button',{onClick:()=>select({action:'create'}),children:'新增後台登入帳號'}),
 ...rows.map(g=>jsx('article',{className:'card',children:[jsx('strong',{children:g.name}),jsx('p',{children:[roles[g.role]||g.role,g.provider,{ACTIVE:'啟用',REVOKED:'已撤銷',SUSPENDED:'已停用'}[g.status]].join(' · ')}),!edit&&!g.self&&g.status!=='REVOKED'&&jsx('button',{onClick:()=>select({id:g.id,action:g.status==='ACTIVE'?'suspend':'resume',display:g.name}),children:g.status==='ACTIVE'?'停用授權':'恢復授權'})]},g.id))]});
 };
}
