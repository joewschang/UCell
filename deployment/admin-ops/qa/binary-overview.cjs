const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, webkit} = require('playwright-core');
const {open, newPageAt, finish} = require('./sponsor-overview.cjs');

function measure(section) {
  const ctx = document.createElement('canvas').getContext('2d', {willReadFrequently:true});
  const color = value => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data);
  };
  const blend = (top, bottom) => bottom.map((n,i) => n + (top[i] - n) * top[3] / 255);
  function background(el) {
    const stack = [];
    for (let ancestor = el; ancestor; ancestor = ancestor.parentElement) {
      stack.unshift(color(getComputedStyle(ancestor).backgroundColor));
    }
    return stack.reduce((lower, upper) => blend(upper, lower), [255, 255, 255]);
  }
  function luminance(rgb) {
    const weights = [.2126, .7152, .0722];
    return rgb.slice(0,3).reduce((sum,channel,i) => {
      const s = channel / 255;
      return sum + weights[i] * (s <= .04045 ? s/12.92 : ((s+.055)/1.055)**2.4);
    }, 0);
  }
  const selectors = [
    ['text', ':scope > header h2,.bm-note,.bm-legend span,.bm-zoom button,.bm-ball strong,.bm-ball span', 'color'],
    ['edge', '.bm-lines path', 'stroke'],
    ['icon', '.bm-ball svg > *,.bm-legend svg > *', 'fill']
  ];
  const minimum = {};
  for (const [kind, selector, property] of selectors) {
    const samples = [...section.querySelectorAll(selector)].filter(el=>el.getClientRects().length>0).map(el => {
      const bg = background(el);
      const fg = blend(color(getComputedStyle(el)[property]), bg);
      const [a,b] = [luminance(bg),luminance(fg)].sort((x,y)=>y-x);
      return (a+.05)/(b+.05);
    });
    minimum[kind] = samples.length ? Number(Math.min(...samples).toFixed(3)) : 0;
  }
  return {minimum, canvasLuminance:luminance(background(section.querySelector('.bm-viewport'))),
    nodeLuminance:luminance(background(section.querySelector('.bm-ball')))};
}

async function verifyAtWidth(browser, width, resultsDir, engine) {
  const ui = await open(browser, {width,theme:'light'});
  const {page} = ui;
  try {
    await newPageAt(page, '/organization/binary');
    const map = page.getByRole('region', {name:'二元樹全貌'});
    const node = map.getByRole('button', {name:/QA-01.*查看球 360/});
    const settings = page.getByLabel('顯示模式');
    await node.waitFor();
    assert.equal(await page.locator('h1').innerText(), '二元樹');
    assert.equal((await page.locator('a[href="/organization/binary"]').first().textContent()).trim(), '二元樹');
    assert.equal(await page.getByLabel('組織類型').locator('option[value="BINARY"]').textContent(), '二元樹');
    assert.equal(await map.locator('.bm-ball.bm-off').count(), 4);
    assert.equal(await map.locator('.bm-lines path').count(), 8);

    const measurements = {};
    for (const theme of ['light', 'dark']) {
      await settings.selectOption(theme.toUpperCase());
      await page.waitForFunction(t=>document.documentElement.dataset.theme===t, theme);
      const data = await map.evaluate(measure);
      measurements[theme] = data;
      for (const [kind,ratio] of Object.entries(data.minimum)) {
        assert(ratio >= (kind==='text' ? 4.5 : 3), `${width} ${theme} ${kind} contrast ${ratio}`);
      }
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      if (resultsDir) await map.screenshot({path:path.join(resultsDir,`binary-${engine}-${width}-${theme}.png`)});
      const reset = map.getByTitle('還原為 100%');
      await map.getByRole('button',{name:'放大',exact:true}).click();
      assert.equal(await reset.textContent(), '140%');
      await map.getByRole('button',{name:'顯示全樹'}).click();
      const viewport = map.locator('.bm-viewport');
      assert(await viewport.evaluate(el=>el.scrollWidth<=el.clientWidth+2), 'Fit entire tree');
      await reset.click();
      await viewport.focus();
      await page.keyboard.press('Tab');
      assert(await node.evaluate(el=>el===document.activeElement && getComputedStyle(el).outlineStyle!=='none'));
      await node.click();
      const drawer = page.getByRole('dialog',{name:/球 360.*QA-01/});
      await drawer.getByRole('button',{name:'關閉'}).click();
    }
    for (const surface of ['canvasLuminance','nodeLuminance']) {
      assert(measurements.light[surface] > measurements.dark[surface], 'Theme must change '+surface);
    }
    await settings.selectOption('SYSTEM');
    for (const scheme of ['dark','light']) {
      await page.emulateMedia({colorScheme:scheme});
      await page.waitForFunction(s=>document.documentElement.dataset.theme===s, scheme);
      assert.deepEqual(await map.evaluate(measure), measurements[scheme]);
    }
    const tree = map.locator('select');
    await tree.selectOption('empty');
    await map.getByText('目前沒有已安置的球。').waitFor();
    await tree.selectOption('binary-subject');
    await node.waitFor();
    return {width,measurements};
  } finally {await finish(ui);}
}

(async()=>{
  const engine = process.env.ENGINE || 'chromium';
  const browser = engine==='webkit' ? await webkit.launch() : await chromium.launch({executablePath:process.env.CHROME});
  const out = process.env.QA_RESULTS_DIR;
  if (out) fs.mkdirSync(out,{recursive:true});
  try {
    const screens = [];
    for (const width of [1366,390]) screens.push(await verifyAtWidth(browser,width,out,engine));
    const evidence = {mode:process.env.SITE_DIR?'candidate':'live',engine,screens};
    if (out) fs.writeFileSync(path.join(out,`binary-${evidence.mode}-${engine}.json`), JSON.stringify(evidence,null,2)+'\n');
    console.log('PASS',JSON.stringify(evidence));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
