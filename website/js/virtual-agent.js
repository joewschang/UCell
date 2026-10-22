(() => {
 if(document.querySelector('.virtual-service'))return;
 const panel=document.createElement('details');
 panel.className='virtual-service';
 panel.innerHTML=`<summary aria-label="開啟或收合 UCell 虛擬客服"><img src="/assets/virtual-agent/avatar.webp" width="44" height="44" alt=""><span>服務與協助</span></summary><div class="virtual-service-body"><button type="button" class="virtual-service-close" aria-label="關閉客服選單">×</button><div class="virtual-service-title"><img src="/assets/virtual-agent/avatar.webp" width="56" height="56" alt=""><div><small>AI 虛擬助理</small><h2>UCell 智慧秘書</h2></div></div><p>您好，讓我協助您找到需要的服務。</p><nav aria-label="客服服務入口"><a href="/faq.html">搜尋常見問題 <span>→</span></a><a href="https://member.ucell.life/ai-assistant">會員 AI 查詢 <small>需登入</small></a><a href="/contact.html">聯絡與服務指南 <span>→</span></a><a href="https://lin.ee/pqS11xX" target="_blank" rel="noopener noreferrer">聯繫 LINE 官方客服 ↗</a></nav><p class="virtual-service-note">此處提供服務導引；個人資料請登入會員中心查詢。</p></div>`;
 document.body.append(panel);
 const close=()=>{panel.open=false;panel.querySelector('summary').focus();};
 panel.querySelector('button').addEventListener('click',close);
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.open){e.preventDefault();close();}});
 document.addEventListener('pointerdown',e=>{if(panel.open&&!panel.contains(e.target))panel.open=false;});
})();
