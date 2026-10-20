document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('[data-faq]');
  if (!root) return;
  const input = root.querySelector('#faq-search');
  const items = [...root.querySelectorAll('[data-faq-item]')];
  const buttons = [...root.querySelectorAll('[data-faq-category]')];
  const normalize = text => text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  let category = 'all';
  const apply = () => {
    const words = normalize(input.value).split(' ').filter(Boolean);
    let count = 0;
    items.forEach(item => {
      const text = normalize(item.textContent + ' ' + item.dataset.keywords);
      item.hidden = !(category === 'all' || item.dataset.category === category) || !words.every(word => text.includes(word));
      if (!item.hidden) count++;
    });
    root.querySelectorAll('[data-faq-group]').forEach(group => {
      group.hidden = !items.some(item => item.dataset.category === group.dataset.faqGroup && !item.hidden);
    });
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.faqCategory === category)));
    root.querySelector('[data-faq-status]').textContent = `找到 ${count} 個問題，共 ${items.length} 個`;
    root.querySelector('[data-faq-empty]').hidden = count !== 0;
  };
  const reset = () => { input.value = ''; category = 'all'; apply(); };
  buttons.forEach(button => button.addEventListener('click', () => { category = button.dataset.faqCategory; apply(); }));
  input.addEventListener('input', apply);
  root.querySelectorAll('[data-faq-clear],[data-faq-reset]').forEach(button => button.addEventListener('click', () => { reset(); input.focus(); }));
  const revealHash = () => {
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
    const item = items.find(item => item.id === id);
    if (!item) return;
    reset();
    item.open = true;
    item.scrollIntoView({block:'start'});
    item.querySelector('summary').focus({preventScroll:true});
  };
  // Hash navigation works for incoming links and browser Back/Forward.
  window.addEventListener('hashchange', revealHash);
  root.querySelectorAll('.faq-permalink').forEach(link => link.addEventListener('click', () => {
    if (window.location.hash === link.getAttribute('href')) revealHash();
  }));
  root.querySelector('[data-faq-tools]').hidden = false;
  apply();
  revealHash();
});
