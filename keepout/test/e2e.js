'use strict';
// 킵 더 히어로즈 아웃 E2E: 브라우저 2명 + AI 1명이 한 게임을 끝까지 진행 (playwright 필요)
// 사용법: node keepout/test/e2e.js http://localhost:3300
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:3300';
const SHOTS = process.env.SHOTS || '';

async function step(page) {
  return page.evaluate(() => {
    if (!window.app || !app.state || app.state.result) return 'idle';
    const pr = app.prompt;
    if (!pr) return 'wait';
    const ok = pr.options.filter((o) => !o.disabled);
    let v;
    if (pr.kind === 'turn') {
      const card = ok.find((o) => o.group === 'card');
      v = card && Math.random() < 0.9 ? card.value : 'end';
    } else if (pr.kind === 'icon') v = (ok.find((o) => o.value !== 'skip') || ok[0]).value;
    else v = ok[Math.floor(Math.random() * ok.length)].value;
    answer(v);
    return 'answered';
  });
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const mk = async () => {
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (r) => (r.request().url().startsWith(BASE) || r.request().url().startsWith('ws') ? r.continue() : r.abort()));
    await page.addInitScript(() => localStorage.setItem('keepout-guided', '1'));
    await page.goto(BASE);
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
  await a.click('.clan-opt[data-clan="skeletons"]');
  await b.click('.clan-opt[data-clan="lizards"]');
  await a.click('#btn-add-bot');
  await a.waitForTimeout(300);
  await a.click('#btn-start');
  await a.waitForSelector('#game:not(.hidden)');
  let n = 0;
  let shot = false;
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    const done = await a.evaluate(() => !!(app.state && app.state.result));
    if (done) break;
    for (const p of [a, b]) if ((await step(p)) === 'answered') n++;
    if (!shot && SHOTS && n > 40 && (await a.evaluate(() => app.state.heroes.length >= 3))) { await a.screenshot({ path: `${SHOTS}/ko-mid.png` }); shot = true; }
    await a.waitForTimeout(40);
  }
  const res = await a.evaluate(() => app.state.result && `${app.state.result.win ? '승리' : '패배'} — ${app.state.result.reason}`);
  await a.waitForSelector('#result:not(.hidden)', { timeout: 5000 });
  if (SHOTS) await a.screenshot({ path: `${SHOTS}/ko-result.png` });
  console.log('응답', n, '결과:', res);
  if (errors.length) { console.error('페이지 오류:', errors); process.exit(1); }
  if (!res) { console.error('게임이 끝나지 않았습니다'); process.exit(1); }
  console.log('킵 더 히어로즈 아웃 E2E OK');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
