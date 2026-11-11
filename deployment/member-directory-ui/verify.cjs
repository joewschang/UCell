const fs=require('fs'), path=require('path'), assert=require('assert/strict');
const {chromium}=require('playwright-core');
const root=process.argv[2],html=fs.readFileSync(path.join(root,'index.html'),'utf8');

const company={memberType:'LEGAL_ENTITY',legalEntityId:'ent1',directoryId:'corp:ent1',legalName:'測試股份有限公司',registrationNo:'12345675',memberNo:'TW900',registeredAddress:'測試區',status:'ACTIVE'};
const person={memberType:'INDIVIDUAL',personId:'p1',directoryId:'p1',legalName:'測試代表',mobile:'0912000000',email:'member@example.test',status:'EFFECTIVE',memberNo:'TW111'};
const other={...person,personId:'p2',legalName:'第二代表'};
const rows=[{...company,representatives:[person]},person,{...company,legalEntityId:'ent2',directoryId:'corp:ent2',legalName:'無代表公司',representatives:[]},{...company,legalEntityId:'ent3',directoryId:'corp:ent3',legalName:'多代表公司',representatives:[person,other]}];
async function scenario(browser,width,theme){
  const page=await browser.newPage({viewport:{width,height:850},colorScheme:theme});
  page.setDefaultTimeout(6500);
  const errors=[],calls=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>sessionStorage.setItem('ucell_admin_token','fixture'));
  await page.route('**/*',async route=>{
    const p=new URL(route.request().url()).pathname;
    if(!p.startsWith('/api/')){
      const file=path.join(root,p);
      if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
      if(/\.(png|svg|webp|ico)$/.test(p))return route.abort();
      return route.fulfill({contentType:'text/html',body:html});
    }
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
    calls.push(p);let data,meta={};
    if(p.endsWith('/auth/admin/me'))data={role:'SUPER_ADMIN',subject:'test'};
    else if(p.endsWith('/directory'))data=rows;
    else if(p.includes('/proof/'))return route.fulfill({contentType:'application/pdf',body:'%PDF-test',headers});
    else if(p.includes('/member-type/')){
      if(route.request().method()==='POST'){
        const body=route.request().postDataJSON();assert.equal(route.request().headers()['idempotency-key'],body.requestId);writes.push(body);
        data={id:body.nextType==='LEGAL_ENTITY'?'ent1':'p1',saved:true};
      }else{
        const corporate=p.includes('/LEGAL_ENTITY/');
        data={type:corporate?'LEGAL_ENTITY':'INDIVIDUAL',id:corporate?'ent1':'p1',name:corporate?company.legalName:person.legalName,memberNo:'TW111',representative:person.legalName,personalIdLast4:'5678',registrationNo:corporate?'12345675':null,evidence:corporate?{id:'proof'}:null,version:'v1',balls:2};
      }
    }else if(p.endsWith('/qualifications')){
      const corp=p.includes('/entities/');data=[{qualificationId:corp?'cq':'pq',qualificationNo:'123',ballNo:corp?'CORP-01':'PERSON-01',status:'EFFECTIVE',activeFlag:true}];meta={total:1};
    }else if(p.includes('/retail-referrers/'))data=[];
    else if(p.endsWith('/account-security'))data={identityLinks:[],timeline:[],deliveries:[]};
    else if(p.endsWith('/persons/p1')||p.endsWith('/persons/p2'))data=p.endsWith('/p1')?person:other;
    else data={};
    return route.fulfill({headers,json:{data,meta}});
  });
  await page.goto('https://admin.test/people');
  const row=name=>page.getByRole('row').filter({hasText:name});
  const view=page.locator('dialog[open]');
  await row(company.legalName).getByRole('button',{name:/查看.*會員 360/}).click();
  await view.getByText('法人資料',{exact:true}).waitFor();
  await view.getByText('CORP-01',{exact:false}).first().waitFor();
  await view.getByRole('heading',{name:'帳號安全'}).waitFor();
  assert(calls.some(p=>p.endsWith('/persons/entities/ent1/qualifications')));
  assert(!calls.some(p=>p.endsWith('/persons/p1/qualifications')));
  assert(calls.some(p=>p.endsWith('/retail-referrers/p1')));
  await view.getByRole('button',{name:'關閉',exact:true}).click();
  await row('無代表公司').getByRole('button',{name:/會員 360/}).click();
  await view.getByText(/尚未登錄經營代表人/).waitFor();
  await view.getByText('CORP-01',{exact:false}).first().waitFor();
  assert.equal(await view.getByRole('heading',{name:'帳號安全'}).count(),0);
  await view.getByRole('button',{name:'關閉',exact:true}).click();
  await row('多代表公司').getByRole('button',{name:/會員 360/}).click();
  await view.getByRole('combobox').selectOption('p2');
  await view.getByRole('heading',{name:'經營代表人帳號 · 第二代表'}).waitFor();
  await view.getByRole('button',{name:'關閉',exact:true}).click();
  const nat=page.getByRole('row').filter({hasText:'自然人'}).filter({hasText:person.legalName});
  await nat.getByRole('button',{name:/查看.*會員 360/}).click();
  await view.getByText('PERSON-01',{exact:false}).first().waitFor();
  await view.getByRole('button',{name:'關閉',exact:true}).click();
  await nat.getByRole('button',{name:'會員身分維護'}).click();
  await view.getByLabel('公司登記名稱').fill('測試股份有限公司');await view.getByLabel('公司統一編號').fill('12345675');
  await view.locator('input[type=file]').setInputFiles({name:'proof.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-fixture')});
  await view.getByLabel('異動原因').fill('測試更正建檔');
  const colors=await view.locator('input[maxlength="150"]').evaluate(el=>[getComputedStyle(el).color,getComputedStyle(el).backgroundColor]);
  function lum(rgb){return rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((t,v,i)=>t+v*[.2126,.7152,.0722][i],0)}
  const contrast=colors.map(lum).sort((a,b)=>b-a);assert((contrast[0]+.05)/(contrast[1]+.05)>=4.5,colors);
  assert(await view.evaluate(el=>el.scrollWidth<=el.clientWidth+2));
  if(process.env.UX_SCREENSHOTS)await view.screenshot({path:path.join(process.env.UX_SCREENSHOTS,theme+'-identity.png')});
  await view.getByRole('button',{name:'檢查異動內容'}).click();
  await view.getByRole('button',{name:'確認儲存'}).click();
  await view.getByRole('button',{name:'下載已登錄營登'}).waitFor();
  assert.equal(writes.length,1);assert.equal(writes[0].nextType,'LEGAL_ENTITY');assert.equal(writes[0].file.mime,'application/pdf');
  await view.getByLabel('異動項目').selectOption('INDIVIDUAL');
  await view.getByLabel('異動原因').fill('回復原身分');
  await view.getByRole('button',{name:'檢查異動內容'}).click();await view.getByRole('button',{name:'確認儲存'}).click();
  await view.getByLabel('公司登記名稱').waitFor();
  assert.equal(writes.length,2);assert.equal(writes[1].nextType,'INDIVIDUAL');
  await view.getByRole('button',{name:'關閉',exact:true}).click();
  assert.equal(page.url(),'https://admin.test/people');
  assert(!calls.some(p=>/undefined|null/.test(p)));assert.deepEqual(errors,[]);
  await page.close();console.log('PASS',theme,width);
}
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME});try{await Promise.all([scenario(browser,390,'dark'),scenario(browser,1366,'light')])}finally{await browser.close()}})().catch(err=>{console.error(err);process.exitCode=1});
