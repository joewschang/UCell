const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
async function run(){
  const root=process.argv[2],html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const browser=await chromium.launch({executablePath:process.env.CHROME});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},colorScheme:'dark'});
    page.setDefaultTimeout(6000);await page.addInitScript(()=>sessionStorage.setItem('ucell_admin_token','fixture'));
    const errors=[],lists=[],summaries=[];
    page.on('pageerror',err=>errors.push(err.message));
    const ball={id:'q1',name:'林測試',ballNo:'TW0912000000-01'};
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url()),p=url.pathname;
      if(!p.startsWith('/api/')){
        const file=path.join(root,p);
        if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
        if(/\.(png|svg|js|webp|ico)$/.test(p))return route.abort();
        return route.fulfill({body:html,contentType:'text/html'});
      }
      const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
      if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
      const params=Object.fromEntries(url.searchParams);
      let data=[],meta={};
      if(p.endsWith('/auth/admin/me'))data={role:'ORG_GEO_VIEW',provider:'ENTRA',subject:'fixture'};
      if(p.endsWith('/geo/roots')){
        lists.push(params);
        data=params.q==='無此會員'?[]:params.page==='2'?[{...ball,ballNo:'TW0912000000-02'}]:[ball];
        meta={hasNext:params.page==='1'};
      }
      if(p.endsWith('/geo/summary')){
        summaries.push(params);
        data={rootBallNo:params.rootBallNo,time:{asOf:params.asOf},status:'UNAVAILABLE',summary:null,distribution:[],branchComparison:[],carry:null};
      }
      return route.fulfill({headers,json:{data,meta}});
    });
    await page.goto('https://admin.test/organization/geo');
    const picker=page.getByRole('region',{name:'選擇根球'});
    await picker.getByText(ball.ballNo,{exact:true}).waitFor();
    assert.deepEqual(lists[0],{page:'1'});assert.equal(summaries.length,0);
    await picker.getByRole('button',{name:'下一頁'}).click();
    await picker.getByText('TW0912000000-02',{exact:true}).waitFor();
    for(const q of ['林測試','0912000000',ball.ballNo]){
      await picker.getByRole('searchbox').fill(q);
      await page.waitForResponse(resp=>new URL(resp.url()).searchParams.get('q')===q);
      await picker.getByText(ball.ballNo,{exact:true}).waitFor();assert.equal(lists.at(-1).page,'1');
    }
    await page.locator('.geo-filters label').filter({hasText:'分區'}).locator('select').selectOption('LEFT');
    await picker.getByRole('button',{name:/林測試/}).click();
    await page.getByText('已選根球：林測試 · '+ball.ballNo).waitFor();
    await page.waitForFunction(()=>document.querySelector('.geo-page').innerText.includes('截至'));
    assert.equal(summaries.at(-1).rootBallNo,ball.ballNo);assert.equal(summaries.at(-1).side,'LEFT');
    await picker.getByRole('searchbox').fill('無此會員');await picker.getByText(/找不到符合的球/).waitFor();
    await picker.getByRole('searchbox').fill('');await picker.getByText(ball.ballNo,{exact:true}).waitFor();
    await page.goto('https://admin.test/organization/geo?rootBallNo='+ball.ballNo);
    await page.getByRole('button',{name:'查詢',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.geo-page').innerText.includes('截至'));
    assert.equal(summaries.at(-1).rootBallNo,ball.ballNo);assert.deepEqual(errors,[]);
    console.log('PASS initial list, pagination, all search modes, empty and clear, selected root and filters, existing root link');
  }finally{await browser.close();}
}
run().catch(err=>{console.error(err);process.exitCode=1});
