'use strict';
// E2E (아르낙·챔피언스): 2명 + AI 1명 → 방장이 저장하고 그만두기 → (서버 재시작) → 이어하기 + 친구 재입장
// 사용법: SAVE_DIR=<임시폴더> 로 서버 실행 후 `node test/e2e-save-multi.js <URL> <arnak|champions> <save|resume>`
const { chromium } = require('playwright');
const BASE = process.argv[2];
const KIND = process.argv[3];
const PHASE = process.argv[4] || 'save';
const SHOTS = process.env.SHOTS || '';
const GUIDED = KIND === 'arnak' ? 'arnak-guided' : 'champ-guided';

async function step(page) {
  return page.evaluate((kind) => {
    if (!window.app || !app.state || app.state.result) return 'idle';
    const pr = app.prompt;
    if (!pr) return 'wait';
    if (pr.type === 'cards') { answer(pr.suggest || []); return 'cards'; }
    const ok = pr.options.filter((o) => !o.disabled && o.value !== 'cancel');
    let v;
    if (pr.kind === 'turn') {
      if (kind === 'arnak') v = (ok.find((o) => ['dig', 'buy', 'research'].includes(o.value)) || ok.find((o) => o.value === 'end') || ok.find((o) => o.value === 'pass') || ok[0]).value;
      else {
        const me = app.state.ps[app.you];
        if (me.form === 'alter' && !me.flipped && me.hp > me.maxHp / 2) v = 'flip';
        else v = (ok.find((o) => ['ability', 'attack', 'thwart', 'recover'].includes(o.value)) || ok.find((o) => o.value === 'end') || ok[0]).value;
      }
    } else v = (ok[Math.floor(Math.random() * ok.length)] || pr.options[0]).value;
    answer(v);
    return 'answered';
  }, KIND);
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const mk = async () => {
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => d.accept());
    await page.route('**/*', (r) => (r.request().url().startsWith(BASE) || r.request().url().startsWith('ws') ? r.continue() : r.abort()));
    await page.goto(BASE);
    await page.evaluate((k) => localStorage.setItem(k, '1'), GUIDED);
    await page.reload();
    return page;
  };
  const a = await mk();
  const b = await mk();
  await a.fill('#in-name', '호스트');
  await b.fill('#in-name', '친구');
  if (PHASE === 'save') {
    await a.click('#btn-create');
    await a.waitForSelector('#room:not(.hidden)');
    const code = (await a.textContent('#room-code')).trim();
    await b.fill('#in-code', code);
    await b.click('#btn-join');
    await b.waitForSelector('#room:not(.hidden)');
    await a.click('#btn-add-bot');
    await a.waitForTimeout(300);
    await a.click('#btn-start');
    await a.waitForSelector('#game:not(.hidden)');
    let n = 0;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline && n < 10) {
      for (const p of [a, b]) { const r = await step(p); if (r === 'answered' || r === 'cards') n++; }
      await a.waitForTimeout(120);
    }
    await a.waitForTimeout(1500);
    const before = await a.evaluate(() => ({ round: app.state.round, log: app.state.log ? app.state.log.length : 0 }));
    if (!(await a.locator('#btn-quit').count())) console.log('상태', await a.evaluate(() => JSON.stringify({ result: app.state.result, host: app.room.hostId, you: app.you })));
    await a.click('#btn-quit');
    await a.waitForSelector('#room:not(.hidden) .resume-box');
    await b.waitForSelector('#room:not(.hidden) .resume-box');
    if (SHOTS) await a.screenshot({ path: `${SHOTS}/${KIND}-save-room.png` });
    console.log('저장 직전', JSON.stringify(before), '응답', n);
  } else {
    await a.waitForSelector('#saves-box:not(.hidden) [data-resume]');
    if (SHOTS) await a.screenshot({ path: `${SHOTS}/${KIND}-save-home.png` });
    await a.click('#saves-box [data-resume]');
    await a.waitForSelector('#room:not(.hidden) .slot-card.mine');
    const code = (await a.textContent('#room-code')).trim();
    await b.fill('#in-code', code);
    await b.click('#btn-join');
    await b.waitForSelector('#room:not(.hidden) .slot-card.mine');
    if (SHOTS) await b.screenshot({ path: `${SHOTS}/${KIND}-resume-room.png` });
    await a.click('#btn-start');
    await a.waitForSelector('#game:not(.hidden)');
    await b.waitForSelector('#game:not(.hidden)');
    const after = await a.evaluate(() => ({ round: app.state.round }));
    // 이어서 조금 더 진행 가능한지
    let n = 0;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline && n < 6) {
      for (const p of [a, b]) { const r = await step(p); if (r === 'answered' || r === 'cards') n++; }
      await a.waitForTimeout(150);
    }
    if (SHOTS) await a.screenshot({ path: `${SHOTS}/${KIND}-resumed.png` });
    console.log('이어하기 후', JSON.stringify(after), '추가 응답', n);
    if (n < 2) { console.error('이어한 뒤 진행되지 않음'); process.exit(1); }
  }
  if (errors.length) { console.error('페이지 오류:', errors); process.exit(1); }
  console.log(KIND, '저장', PHASE, 'OK');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
