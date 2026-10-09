// 언락 카드 화면 점검: 모든 시나리오의 모든 카드를 실제 CSS로 그려서 그림 줄바꿈·넘침, 숨은 번호 가림·잘림, 글자 잘림을 찾는다
// 사용법: node unlock/test/visual.js
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const { LIST } = require(path.join(ROOT, 'server/game/scenarios'));
const cards = [];
for (const s of LIST) for (const c of s.cards) {
  if (c.decoy) continue;
  cards.push({ sid: s.id, theme: s.theme || '#888', v: {
    key: c.key, num: c.num, type: c.type, title: c.title, text: String(c.text || '').replace(/\{@(\w+)\}/g, (_, k) => String(s.byKey[k] ? s.byKey[k].num : '?')), art: c.art || '',
    spots: (c.spots || []).map((sp) => (sp.hidden ? { x: sp.x, y: sp.y, hidden: true, num: sp.num, found: false } : { x: sp.x, y: sp.y, emoji: sp.emoji || '', label: sp.label, found: false })),
    plus: c.plus != null ? { n: c.plus, color: c.plusColor || 'blue' } : null, hintsSeen: [], solved: false, shows: (c.shows || []).map((k) => s.byKey[k].num) } });
}
const app = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
const a = app.indexOf('/** 그림(이모지) 개수');
const b = app.indexOf('\n}\n', app.indexOf('function cardHTML')) + 3;
const src = app.slice(app.indexOf('const TYPE_NAME'), app.indexOf('\n', app.indexOf('const TYPE_NAME'))) + '\n' + app.slice(a, b);
const html = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><body style="background:#123"><div id="board" style="display:flex;flex-wrap:wrap;gap:8px;width:1300px"></div>
<script>const app={sel:[],seen:{has:()=>true}};const esc=(s)=>String(s??'').replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));\n${src}\nwindow.cardHTML=cardHTML;</script>`;
const srv = http.createServer((req, res) => {
  if (req.url === '/') { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(html); }
  const f = path.join(ROOT, 'public', req.url.split('?')[0]);
  if (fs.existsSync(f)) return res.end(fs.readFileSync(f));
  res.statusCode = 404; res.end();
}).listen(8766);
(async () => {
  const br = await chromium.launch();
  const p = await br.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto('http://localhost:8766/');
  p.on('pageerror', (e) => { console.error('페이지 오류', e.message); process.exitCode = 1; });
  const issues = await p.evaluate((cards) => {
    const out = [];
    const board = document.getElementById('board');
    const ov = (r1, r2) => Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left)) * Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
    for (const { sid, theme, v } of cards) {
      board.innerHTML = window.cardHTML(v, theme);
      const el = board.firstElementChild;
      const art = el.querySelector('.c-art');
      const ar = art.getBoundingClientRect();
      const id = `${sid}/${v.key}(${v.num})`;
      // 그림 글자 영역
      const node = v.type === 'place' ? art.querySelector('.bg') : art;
      let glyph = null;
      const tn = [...node.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (tn) { const r = document.createRange(); r.selectNodeContents(tn); const rs = [...r.getClientRects()]; if (rs.length > 1 && new Set(rs.map((x) => Math.round(x.top))).size > 1) out.push([id, '그림 줄바꿈']); glyph = rs; const u = r.getBoundingClientRect(); if (u.left < ar.left - 1 || u.right > ar.right + 1 || u.top < ar.top - 1 || u.bottom > ar.bottom + 1) out.push([id, `그림이 칸 밖으로 (${Math.round(u.width)}x${Math.round(u.height)} / ${Math.round(ar.width)}x${Math.round(ar.height)})`]); }
      const marks = [...art.querySelectorAll('.hnum, .spot')];
      for (const m of marks) {
        const r = m.getBoundingClientRect();
        const name = m.classList.contains('hnum') ? `숨은 번호 ${m.textContent}` : `살펴보기 ${m.textContent}`;
        if (r.left < ar.left || r.right > ar.right || r.top < ar.top || r.bottom > ar.bottom) out.push([id, `${name}: 칸 밖으로 잘림`]);
        if (m.classList.contains('hnum') && glyph && v.type !== 'place') {
          const o = glyph.reduce((s, g) => s + ov(r, g), 0) / (r.width * r.height);
          if (o > 0.15) out.push([id, `${name}: 그림과 ${Math.round(o * 100)}% 겹침`]);
        }
        for (const m2 of marks) if (m2 !== m && marks.indexOf(m2) > marks.indexOf(m)) { const o = ov(r, m2.getBoundingClientRect()); if (o > 4) out.push([id, `${name} ↔ ${m2.textContent}: 서로 겹침`]); }
      }
      // 글자 잘림
      const t = el.querySelector('.c-text');
      if (t && t.scrollHeight > t.clientHeight + 2) out.push([id, '본문 글자 잘림']);
      const h = el.querySelector('.c-title');
      if (h && h.scrollWidth > h.clientWidth + 2) out.push([id, `제목 잘림: ${h.textContent}`]);
    }
    return out;
  }, cards);
  const kinds = {};
  for (const [, k] of issues) { const key = k.replace(/\d+/g, '#').replace(/: .*/, (m) => m.slice(0, 14)); kinds[key] = (kinds[key] || 0) + 1; }
  for (const [id, k] of issues) console.log(id, k);
  console.log('카드', cards.length, '문제', issues.length, kinds);
  if (issues.length) process.exitCode = 1;
  await br.close(); srv.close();
})();
