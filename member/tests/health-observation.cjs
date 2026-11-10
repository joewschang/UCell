const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'../..');
const resources=[{id:'game',title:'四站',kind:'遊戲',href:'?play=1',tags:['腿力']},{id:'guide',title:'椅子',kind:'內容',href:'?read=guide',tags:['腿力']},{id:'sku:TIP-580',title:'測試商品',kind:'商品',href:'/shop?sku=TIP-580',tags:['腿力']}];
let open=true,done=false,finished=0,received=[];
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname.startsWith('/api/v1/')){
 let payload='';for await(const c of req)payload+=c;
 received.push(payload);
 let data={open,resources,tags:['腿力'],weeks:done?['2026-11-09']:[],version:1,stats:{started:1,finished:0}};
 if(u.pathname.endsWith('/finish')){finished++;done=true;data={completed:true};}
 if(req.method==='POST'&&u.pathname.endsWith('admin/health-game')){open=JSON.parse(payload).open;data={saved:true};}
 res.setHeader('content-type','application/json');res.end(JSON.stringify({data}));return;
 }
 const admin=u.pathname.startsWith('/admin/');
 const file=path.join(base,admin?'admin':'member','public/health',path.basename(u.pathname)||'index.html');
 const f=u.pathname.endsWith('/')?path.join(path.dirname(file),'index.html'):file;
 res.setHeader('content-type',({'js':'application/javascript','css':'text/css','svg':'image/svg+xml','html':'text/html'})[f.split('.').pop()]||'text/plain');
 if(!fs.existsSync(f)){res.statusCode=404;res.end();return;}res.end(fs.readFileSync(f));
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const host='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});try{
 const p=await browser.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(5000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{sessionStorage.setItem('ucell_member_token','fixture');sessionStorage.setItem('ucell_admin_token','fixture');});
 await p.goto(host+'/health/');await p.getByRole('button',{name:'大字'}).click();await p.getByRole('button',{name:/開始四站/}).click();
 const next=p.getByRole('button',{name:/確認，下一站/});assert(await next.isDisabled());
 await p.getByText('兩手指剛好相碰',{exact:true}).click();await next.click();
 await p.getByRole('button',{name:'開始計時'}).click();await p.getByRole('button',{name:'停止計時'}).click();await p.getByText('自行完成五次',{exact:true}).click();await next.click();
 await p.getByText('後腦可輕鬆靠牆',{exact:true}).click();assert(await next.isDisabled());await p.getByText('比先前實測矮',{exact:true}).click();await next.click();
 await p.getByRole('button',{name:/我是停經後/}).click();await p.getByLabel('足歲').fill('65');await p.getByLabel('體重（公斤）').fill('60');
 const preview=await p.getByText(/OSTAi -1 ·/).innerText();await p.getByText('完成觀察，查看紀錄').click();await p.getByText(preview,{exact:true}).waitFor();assert.equal(finished,1);
 const dl=p.waitForEvent('download');await p.getByText('下載我的完成卡').click();assert((await dl).suggestedFilename().endsWith('.png'));
 const invitation=await p.getByText('用 LINE 邀請家人').getAttribute('href');assert(!invitation.includes('65')&&!invitation.includes('OSTAi'));
 await p.getByText('#腿力',{exact:true}).click();await p.getByRole('link',{name:/商品 · 測試商品/}).waitFor();
 await p.goto(host+'/admin/health/');await p.getByPlaceholder(/平衡練習/).fill('居家');await p.getByRole('button',{name:'加入',exact:true}).click();await p.getByText('開放會員與訪客參加').uncheck();await p.getByText('儲存並套用設定').click();await p.getByText('設定已儲存。').waitFor();
 await p.goto(host+'/health/');await p.getByText('健康任務暫停中').waitFor();
 assert(!received.some(x=>x.includes('OSTAi')||x.includes('"age"')));assert.deepEqual(errors,[]);console.log('PASS mobile four stations, timing, score consistency, completion, share PNG, related products, admin save and pause');
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;server.close();});
