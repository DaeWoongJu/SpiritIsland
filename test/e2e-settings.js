'use strict';
// E2E: 방 설정(확장판·맵·난이도) 변경 + 한 사람이 정령 2개 조종
// 사용법: 서버 실행 후 `node test/e2e-settings.js [URL]` (playwright 필요)
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:3000';
const SHOTS = process.env.SHOTS || '';

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load')) errors.push(m.text()); });
  await page.addInitScript(() => { localStorage.setItem('si-guided', '1'); localStorage.setItem('si-3d', '0'); });
  await page.route((u) => !u.href.startsWith(URL), (r) => r.abort());
  await page.goto(URL);
  await page.waitForSelector('#conn-status.ok');
  await page.fill('#in-name', '혼자서');
  await page.click('#btn-create');
  await page.waitForSelector('#room-settings .set-group');
  // 설정: 어려움 + 프로이센 3레벨 + 세로 배치 + 추가 보드
  await page.click('[data-preset="hard"]');
  await page.waitForSelector('[data-preset="hard"].on');
  await page.selectOption('#set-adv', 'prussia');
  await page.waitForSelector('#set-level');
  await page.$eval('#set-level', (el) => { el.value = '3'; el.dispatchEvent(new Event('change')); });
  await page.waitForFunction(() => document.querySelectorAll('.adv-levels li.on').length === 3);
  await page.selectOption('#set-layout', 'coast');
  await page.check('#set-extra');
  await page.waitForFunction(() => document.querySelector('#set-extra').checked);
  // 확장판 하나 끄기 → 해당 정령 사라짐
  const before = await page.locator('.spirit-card').count();
  await page.uncheck('[data-exp="ni"]');
  await page.waitForFunction((b) => document.querySelectorAll('.spirit-card').length < b, before);
  // 정령 2개 고르기
  await page.click('.spirit-card[data-spirit="lightning"] [data-pick]');
  await page.waitForSelector('.spirit-card.mine[data-spirit="lightning"]');
  await page.click('.spirit-card[data-spirit="lure"] [data-add]');
  await page.waitForSelector('.spirit-card.mine[data-spirit="lure"]');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-room.png` });
  await page.click('#btn-start');
  await page.waitForSelector('#screen-game:not(.hidden)');
  await page.waitForSelector('#seat-bar:not(.hidden) .seat');
  const seats = await page.locator('#seat-bar .seat').count();
  const diff = await page.textContent('#topbar');
  let steps = 0;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline && steps < 40) {
    if (await page.locator('.result').count()) break;
    const modal = page.locator('#modal:not(.hidden) #btn-confirm-cards');
    if (await modal.count()) {
      const c = page.locator('#modal .card.selectable:not(.selected)');
      if (await c.count()) await c.first().click({ timeout: 2000 }).catch(() => {});
      if (await modal.isEnabled().catch(() => false)) { await modal.click({ timeout: 2000 }).catch(() => {}); steps++; continue; }
    }
    const land = page.locator('#prompt button[data-land]');
    if (await land.count()) { await land.first().click({ timeout: 2000 }).catch(() => {}); steps++; await page.waitForTimeout(80); continue; }
    const opt = page.locator('#prompt button[data-i]');
    if (await opt.count()) { await opt.first().click({ timeout: 2000 }).catch(() => {}); steps++; await page.waitForTimeout(80); continue; }
    await page.waitForTimeout(150);
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-game.png` });
  await browser.close();
  console.log(`좌석 ${seats}개, 응답 ${steps}회, 난이도 표시: ${/어려움 · 브란덴부르크-프로이센 3레벨/.test(diff)}`);
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  if (seats !== 2 || steps < 8 || !/브란덴부르크-프로이센 3레벨/.test(diff)) process.exit(1);
  console.log('E2E 설정 OK');
})().catch((e) => { console.error(e); process.exit(1); });
