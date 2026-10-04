'use strict';
// 히어로 챔피언스 E2E: 브라우저 2명 + AI 동료 1명이 한 게임을 끝까지 진행 (playwright 필요)
// 사용법: node champions/test/e2e.js http://localhost:3200
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:3200';

async function step(page) {
  return page.evaluate(() => {
    if (!window.app || !app.state || app.state.result) return 'idle';
    const pr = app.prompt;
    if (!pr) return 'wait';
    if (pr.type === 'cards') { answer(pr.pay ? (pr.suggest || []) : (pr.suggest || [])); return 'cards'; }
    const ok = pr.options.filter((o) => !o.disabled && o.value !== 'cancel');
    let v;
    if (pr.kind === 'turn') {
      const me = app.state.ps[app.you];
      if (me.form === 'alter' && !me.flipped && me.hp > me.maxHp / 2) v = 'flip';
      else {
        const card = ok.find((o) => o.group === 'card' && Math.random() < 0.6);
        const pref = ['ability', 'attack', 'thwart', 'recover'].find((x) => ok.some((o) => o.value === x));
        const other = ok.find((o) => o.group === 'ally' || o.group === 'tech');
        v = (card || (pref && { value: pref }) || other || { value: 'end' }).value;
      }
    } else v = (ok[Math.floor(Math.random() * ok.length)] || pr.options[0]).value;
    answer(v);
    return 'answered';
  });
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const mk = async () => {
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (r) => (r.request().url().startsWith(BASE) || r.request().url().startsWith('ws') ? r.continue() : r.abort()));
    await page.goto(BASE);
    await page.evaluate(() => localStorage.setItem('champ-guided', '1'));
    await page.reload();
    return page;
  };
  const a = await mk();
  const b = await mk();
  await a.fill('#in-name', '호스트');
  await a.click('#btn-create');
  await a.waitForSelector('#room:not(.hidden)');
  const code = (await a.textContent('#room-code')).trim();
  await b.fill('#in-name', '친구');
  await b.fill('#in-code', code);
  await b.click('#btn-join');
  await b.waitForSelector('#room:not(.hidden)');
  await a.click('#btn-add-bot');
  await a.waitForTimeout(300);
  await a.click('.diff-opt[data-diff="practice"]');
  await a.waitForTimeout(200);
  await a.click('.hero-opt[data-hero="titan"]');
  await b.click('.hero-opt[data-hero="fox"]');
  await a.waitForTimeout(300);
  await a.click('#btn-start');
  await a.waitForSelector('#game:not(.hidden)');
  console.log('방 코드', code, '게임 시작');
  let n = 0;
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    const done = await a.evaluate(() => !!(app.state && app.state.result));
    if (done) break;
    for (const p of [a, b]) if ((await step(p)) !== 'wait') n++;
    await a.waitForTimeout(60);
  }
  const res = await a.evaluate(() => app.state.result && `${app.state.result.win ? '승리' : '패배'} — ${app.state.result.reason}`);
  await a.waitForSelector('#result:not(.hidden)', { timeout: 5000 });
  console.log('응답', n, '결과:', res);
  if (errors.length) { console.error('페이지 오류:', errors); process.exit(1); }
  if (!res) { console.error('게임이 끝나지 않았습니다'); process.exit(1); }
  console.log('히어로 챔피언스 E2E OK');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
