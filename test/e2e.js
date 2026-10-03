'use strict';
// 브라우저 2개로 방 생성→참가→정령 선택→게임 진행을 자동으로 확인하는 E2E 스모크 테스트.
// 사용법: 서버 실행 후 `node test/e2e.js [URL] [턴수]` (playwright 필요)
const { chromium } = require('playwright');

const URL = process.argv[2] || 'http://localhost:3000';
const TURNS = Number(process.argv[3] || 3);
const SHOTS = process.env.SHOTS || '';

async function autoPlay(page, label) {
  // 현재 프롬프트에 무작위로 응답 (카드 선택 창 포함)
  const modalOpen = await page.locator('#modal:not(.hidden) .card.selectable').count();
  if (modalOpen) {
    const confirm = page.locator('#btn-confirm-cards');
    if (await confirm.count()) {
      const cards = page.locator('#modal .card.selectable:not(.selected)');
      const n = await cards.count();
      if (n && Math.random() < 0.8) await cards.nth(Math.floor(Math.random() * n)).click();
      if (await confirm.isEnabled()) { await confirm.click(); return true; }
    }
  }
  const confirm = page.locator('#btn-confirm-cards');
  if (await page.locator('#modal:not(.hidden)').count() && await confirm.count() && await confirm.isEnabled()) { await confirm.click(); return true; }
  const lands = page.locator('#map polygon.land.selectable');
  const ln = await lands.count();
  if (ln) {
    const box = await lands.nth(Math.floor(Math.random() * ln)).getAttribute('data-land');
    await page.locator(`#prompt button[data-land="${box}"]`).click();
    return true;
  }
  const opts = page.locator('#prompt button[data-i]');
  const on = await opts.count();
  if (on) {
    const good = page.locator('#prompt button[data-i]:not(.opt-done)');
    const gn = await good.count();
    if (gn && Math.random() < 0.8) await good.nth(Math.floor(Math.random() * gn)).click();
    else await opts.nth(on - 1).click();
    return true;
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const errors = [];
  const mk = async (name) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
    await page.goto(URL);
    await page.waitForSelector('#conn-status:has-text("연결되었습니다")');
    await page.fill('#in-name', name);
    return page;
  };
  const a = await mk('철수');
  const b = await mk('영희');
  await a.click('#btn-create');
  await a.waitForSelector('#screen-room:not(.hidden)');
  const code = (await a.textContent('#room-code')).trim();
  console.log('방 코드:', code);
  await b.fill('#in-code', code);
  await b.click('#btn-join');
  await b.waitForSelector('#screen-room:not(.hidden)');
  await a.click('.spirit-card[data-spirit="lightning"]');
  await b.click('.spirit-card[data-spirit="river"]');
  await a.waitForFunction(() => !document.querySelector('#btn-start').disabled);
  if (SHOTS) await a.screenshot({ path: `${SHOTS}/lobby.png` });
  await a.click('#btn-start');
  await a.waitForSelector('#screen-game:not(.hidden)');
  await b.waitForSelector('#screen-game:not(.hidden)');
  console.log('게임 시작됨');
  if (SHOTS) await a.screenshot({ path: `${SHOTS}/game-start.png` });

  let steps = 0;
  const deadline = Date.now() + 120000;
  for (;;) {
    const turn = await a.evaluate(() => (window.__turn = document.querySelector('#topbar .tb-box .k')?.textContent || ''));
    const over = await a.locator('.result').count();
    if (over || parseInt(turn, 10) > TURNS || Date.now() > deadline) break;
    const did = (await autoPlay(a, 'A')) | (await autoPlay(b, 'B'));
    if (did) steps++;
    if (SHOTS && steps === 6) await a.screenshot({ path: `${SHOTS}/game-mid.png` });
    await a.waitForTimeout(did ? 60 : 200);
  }
  const turnText = await a.textContent('#topbar .tb-box .k');
  console.log(`응답 횟수 ${steps}, 상태: ${turnText}`);
  if (SHOTS) await a.screenshot({ path: `${SHOTS}/game-later.png` });
  if (SHOTS) await b.screenshot({ path: `${SHOTS}/game-later-b.png` });
  await browser.close();
  if (errors.length) { console.error('브라우저 오류:\n' + errors.join('\n')); process.exit(1); }
  if (steps < 10) { console.error('진행이 너무 적습니다'); process.exit(1); }
  console.log('E2E OK');
})().catch((e) => { console.error(e); process.exit(1); });
