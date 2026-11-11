const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
async function main(){
  const root=process.argv[2],html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const entry=html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
  const source=fs.readFileSync(path.join(root,entry),'utf8');
  const png=fs.readFileSync(path.join(__dirname,'../../member/tests/fixtures/daily-greeting-2026-11-11.png'));
  const browser=await chromium.launch({executablePath:process.env.CHROME});try {
    for(const [role,theme,width] of [['SUPER_ADMIN','dark',390],['COMPLIANCE_AUDIT','light',1280],['MEMBERSHIP_OPS','light',390]]){
      const page=await browser.newPage({viewport:{width,height:850},colorScheme:theme});
      page.setDefaultTimeout(6000);
      const errors=[],writes=[],requests=[];
      page.on('pageerror',e=>errors.push(e.message));
      let rows=[];
      const ball={id:'00000000-0000-4000-8000-000000000001',name:'林測試',ballNo:'BALL-1'};
      const code=source; await page.addInitScript(()=>sessionStorage.setItem('ucell_admin_token','local-browser-fixture'));
      await page.route('**/*',async route=>{
        const url=new URL(route.request().url()),p=url.pathname;
        if(p.includes('/api/v1/')){
          const api=p.split('/api/v1/')[1],headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
          if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
          requests.push(api+'?'+url.searchParams);
          if(api.endsWith('/preview'))return route.fulfill({contentType:'image/png',body:png,headers});
          let data=[],meta={};
          if(api.endsWith('/auth/admin/me')||api==='auth/admin/me'){data={role,subject:'Fixture'};}else if(api.endsWith('/tree-roots')){
            const pageNo=Number(url.searchParams.get('page'));data=pageNo===1?[ball]:[{...ball,ballNo:'BALL-11'}];
            if(url.searchParams.get('q')==='不存在')data=[];
            meta={page:pageNo,hasNext:pageNo===1};
          }else if(api.includes('admin/daily-greetings')){
            if(route.request().method()==='POST'){
              assert(route.request().headers()['idempotency-key']);writes.push(api);
              if(api.endsWith('/publish')){assert.equal(route.request().postDataJSON().approvalReference,'核對完成');rows[0].status='PUBLISHED';}
              else {const body=route.request().postDataJSON();assert.equal(body.contentBase64,png.toString('base64'));rows=[{id:'doc',title:body.title,message:body.message,greeting_date:body.date,status:'DRAFT',publish_at:'2020-01-01'}];}
            }
            data=rows;
          }
          return route.fulfill({headers,json:{data,meta}});
        }
        if(p===entry)return route.fulfill({contentType:'text/javascript',body:code});
        const file=path.join(root,p);
        if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
        if(/\.(?:js|css|png|svg|ico|webp)$/.test(p))return route.abort();
        return route.fulfill({contentType:'text/html',body:html});
      });
      if(role==='SUPER_ADMIN'){
        for(const [route,mode] of [['/organization','sponsor-tree'],['/organization/binary','binary-tree']]){
          await page.goto('https://admin.test'+route);
          const picker=page.getByRole('region',{name:'選擇根球'});
          await picker.getByText('BALL-1',{exact:true}).waitFor();
          assert(requests.some(url=>url.includes('tree-roots?page=1')));
          await picker.getByRole('button',{name:'下一頁'}).click();await picker.getByText('BALL-11',{exact:true}).waitFor();
          await picker.getByRole('searchbox').fill('不存在');await picker.getByText(/找不到符合的球/).waitFor();
          for(const q of ['林測試','0912000111','BALL-1']){
            await picker.getByRole('searchbox').fill(q);await picker.getByText('BALL-1',{exact:true}).waitFor();
            assert(requests.some(url=>decodeURIComponent(url).includes('q='+q)));
          }
          await picker.getByRole('button',{name:/林測試/}).click();
          await page.getByText(/組織已載入/).waitFor();
          assert(requests.some(url=>url.includes(mode+'/'+ball.id)));
        }
      }
      await page.goto('https://admin.test/content/greetings');
      if(role==='MEMBERSHIP_OPS'){assert.equal(await page.getByLabel('問候標題').count(),0);assert.equal(await page.getByRole('link',{name:'每日問候圖上傳'}).count(),0);}
      else{
        const group=page.locator('nav details').filter({has:page.locator('summary',{hasText:'內容與客服'})});
        await group.getByRole('link',{name:'每日問候圖上傳'}).waitFor();
        await page.getByRole('heading',{name:'問候圖紀錄'}).waitFor();
        assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
        if(role==='SUPER_ADMIN'){
          await page.getByLabel('問候標題').fill('測試問候');await page.getByLabel('問候文字').fill('早安');
          await page.locator('input[type=file]').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:png});
          await page.getByRole('button',{name:'上傳草稿'}).click();await page.getByText('測試問候',{exact:true}).waitFor();
          assert.equal(await page.getByRole('button',{name:'核准發布',exact:true}).count(),0);
          await page.getByRole('button',{name:'預覽',exact:true}).click();await page.getByAltText(/發布預覽/).waitFor();
          assert(await page.getByRole('button',{name:'核准發布',exact:true}).isDisabled());
          await page.getByLabel('核准依據').fill('核對完成');await page.getByRole('button',{name:'核准發布',exact:true}).click();
          await page.getByText('已核准發布。',{exact:true}).waitFor();assert.equal(writes.length,2);
        } else assert.equal(await page.getByRole('button',{name:'上傳草稿'}).count(),0);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
      }
      assert.deepEqual(errors,[]);await page.close();
    }
    console.log('PASS both tree modes, browse and search, correct root, greeting navigation, upload/preview/approval, role visibility and themes');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
