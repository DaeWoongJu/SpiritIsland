'use strict';
(() => {
// 메뉴 화면들: 시작 메뉴, 포켓몬, 가방, 도감, 트레이너 카드, PC, 상점, 친구, 교환, 날기, 설정
const G = window.G;

G.closeAllUI = () => { G.ui.length = 0; };
G.typeName = (t) => (G.W.ko.types[t] || t);
G.speciesName = (id) => G.W.ko.species[id] || `#${id}`;
G.itemName = (c) => {
  const it = G.W.items[c];
  if (it && it.tm) return `기술머신${String(it.tm).padStart(2, '0')}`;
  if (it && it.hm) return `비전머신${String(it.hm).padStart(2, '0')}`;
  return G.W.ko.items[c] || (it ? it.name : c);
};
G.moveName = (c) => G.W.ko.moves[c] || c;

// ───────── 시작 메뉴 ─────────
G.openStartMenu = async function openStartMenu() {
  G.sfx('select');
  G.net.send({ t: 'busy', busy: true });
  let last = G.lastStart || 0;
  for (;;) {
    const items = [];
    if (G.me.caught.length || G.me.seen.length || G.me.flags.GOT_STARTER) items.push(['포켓몬 도감', G.dexScreen]);
    if (G.me.party.length) items.push(['포켓몬', () => G.partyScreen({ mode: 'field' })]);
    items.push(['가방', () => G.bagScreen({ mode: 'field' })]);
    items.push([G.me.name, G.trainerCard]);
    items.push(['친구', G.friendsMenu]);
    items.push(['레포트', async () => { if (await G.yesno('지금까지의 활약을 레포트에 기록하겠습니까?')) G.net.send({ t: 'save' }); }]);
    items.push(['설정', G.optionsMenu]);
    items.push(['닫기', null]);
    const i = await G.choose(items.map((x) => x[0]), { x: 160 - 80, y: 0, w: 80, start: Math.min(last, items.length - 1), rows: items.length });
    if (i < 0 || !items[i][1]) break;
    last = i; G.lastStart = i;
    const r = await items[i][1]();
    if (r === 'close') break;
  }
  G.net.send({ t: 'busy', busy: false });
};

// ───────── 포켓몬 목록 ─────────
/** mode: field | battle | replace | item | give | trade | deposit */
G.partyScreen = function partyScreen(opts) {
  return new Promise((resolve) => {
    const party = () => (opts.party && opts.mode === 'replace' ? opts.party : G.me.party);
    let i = 0;
    if (opts.mode === 'replace' && opts.choices && opts.choices.length) i = opts.choices[0];
    let swapFrom = -1;
    const msg = () => opts.msg || (opts.mode === 'replace' ? '다음 포켓몬을 고르세요.' : swapFrom >= 0 ? '어디로 옮길까요?' : opts.mode === 'item' ? '어느 포켓몬에게 쓸까요?' : opts.mode === 'give' ? '어느 포켓몬에게 지니게 할까요?' : '포켓몬을 고르세요.');
    const scr = {
      update: async () => {
        if (scr.locked) return;
        const list = party();
        const n = list.length;
        if (!n) { G.pop(scr); resolve(-1); return; }
        if (G.tap('up')) { i = (i - 1 + n) % n; G.sfx('move'); }
        if (G.tap('down')) { i = (i + 1) % n; G.sfx('move'); }
        if (G.input.pressed.b) {
          if (swapFrom >= 0) { swapFrom = -1; return; }
          if (opts.mode === 'replace') return;
          G.pop(scr); resolve(-1); return;
        }
        if (!G.input.pressed.a) return;
        G.sfx('select');
        if (opts.mode === 'replace') {
          if (!opts.choices.includes(i)) { scr.locked = true; await G.say(list[i].hp <= 0 ? '싸울 기력이 없다!' : list[i].egg ? '알은 싸울 수 없다!' : '이미 나와 있다!'); scr.locked = false; return; }
          G.pop(scr); resolve(i); return;
        }
        if (swapFrom >= 0) { if (swapFrom !== i) G.net.send({ t: 'swap', a: swapFrom, b: i }); swapFrom = -1; return; }
        if (opts.mode !== 'field' && opts.mode !== 'battle') { G.pop(scr); resolve(i); return; }
        scr.locked = true;
        const mon = list[i];
        const sub = [];
        if (opts.mode === 'battle') { sub.push(['교체한다', 'switch']); sub.push(['능력을 본다', 'stats']); sub.push(['그만둔다', null]); }
        else {
          sub.push(['능력을 본다', 'stats']);
          for (const fm of ['FLY', 'SURF', 'CUT', 'FLASH', 'STRENGTH', 'ROCK_SMASH', 'HEADBUTT', 'WHIRLPOOL', 'WATERFALL', 'DIG', 'TELEPORT', 'SOFTBOILED', 'MILK_DRINK']) if (!mon.egg && mon.moves.some((m) => m.id === fm)) sub.push([G.moveName(fm), 'fm:' + fm]);
          sub.push(['순서 바꾸기', 'swap']); sub.push(['도구', 'item']); sub.push(['그만둔다', null]);
        }
        const k = await G.choose(sub.map((x) => x[0]), { x: 160 - 84, y: 144 - sub.length * 16 - 14, w: 84, rows: sub.length });
        scr.locked = false;
        const act = k >= 0 ? sub[k][1] : null;
        if (!act) return;
        if (act === 'switch') { G.pop(scr); resolve(i); return; }
        if (act === 'stats') { scr.locked = true; await G.summary(list, i); scr.locked = false; return; }
        if (act === 'swap') { swapFrom = i; return; }
        if (act === 'item') {
          scr.locked = true;
          const kk = await G.choose(['지니게 한다', '맡은 도구를 받는다', '그만둔다'], { x: 64, y: 72, w: 96, rows: 3 });
          if (kk === 0) { const res = await G.bagScreen({ mode: 'give' }); if (res) G.net.send({ t: 'giveItem', uid: mon.uid, item: res.item }); }
          if (kk === 1) { if (mon.item) G.net.send({ t: 'takeItem', uid: mon.uid }); else await G.say(`${G.josa(mon.name, '은/는')} 아무것도 지니고 있지 않다.`); }
          scr.locked = false;
          return;
        }
        if (act.startsWith('fm:')) {
          const r = await G.fieldMove(act.slice(3), mon);
          if (r === 'close') { G.pop(scr); resolve('close'); }
        }
      },
      draw: (ctx) => {
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(0, 0, 160, 144);
        const list = party();
        list.forEach((m, k) => {
          const y = k * 16;
          if (k === i) { ctx.fillStyle = '#e8e8f8'; ctx.fillRect(0, y, 160, 16); }
          if (swapFrom === k) { ctx.fillStyle = '#f8e0a0'; ctx.fillRect(0, y, 160, 16); }
          const bob = k === i && m.hp > 0 ? Math.floor(performance.now() / 160) % 2 : Math.floor(performance.now() / 500) % 2;
          const ic = m.egg ? null : G.icon(m.species, bob);
          if (ic) ctx.drawImage(ic, 10, y);
          else if (m.egg) { ctx.fillStyle = '#f8f0d0'; ctx.fillRect(13, y + 3, 10, 12); ctx.fillStyle = '#101010'; ctx.fillRect(13, y + 3, 10, 1); }
          if (k === i) G.cursor(ctx, 2, y + 4);
          G.text(ctx, m.egg ? '알' : m.name, 28, y + 2, opts.mode === 'replace' && opts.choices && !opts.choices.includes(k) ? '#888' : G.BLACK);
          if (!m.egg) {
            const st = m.hp <= 0 ? '기절' : m.status ? { PSN: '독', TOX: '독', BRN: '화상', PAR: '마비', SLP: '잠듦', FRZ: '얼음' }[m.status] : `Lv${m.level}`;
            G.text(ctx, st, 158, y + 2, G.BLACK, 'right');
            G.battleBar(ctx, 86, y + 7, 40, m.hp, m.maxhp);
          }
        });
        G.box(ctx, 0, 96, 160, 48);
        const ls = G.wrap(ctx, msg(), 142);
        ls.slice(0, 2).forEach((l, k) => G.text(ctx, l, 8, 103 + k * 16));
      },
    };
    G.push(scr);
  });
};
G.battleBar = function battleBar(ctx, x, y, w, hp, max) {
  ctx.fillStyle = G.BLACK; ctx.fillRect(x - 1, y - 1, w + 2, 5);
  ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x, y, w, 3);
  const k = max ? Math.max(0, hp) / max : 0;
  ctx.fillStyle = k > 0.5 ? '#00b800' : k > 0.2 ? '#f8b800' : '#f80000';
  ctx.fillRect(x, y, Math.ceil(w * k), 3);
};

// ───────── 능력 보기 ─────────
G.summary = function summary(list, start) {
  return new Promise((resolve) => {
    let i = start, page = 0;
    const scr = {
      update() {
        if (G.input.pressed.b) { G.pop(scr); resolve(); return; }
        if (G.tap('left') || G.tap('right') || G.input.pressed.a) { page = (page + 1) % 2; G.sfx('move'); }
        if (G.tap('up')) { i = (i - 1 + list.length) % list.length; }
        if (G.tap('down')) { i = (i + 1) % list.length; }
      },
      draw(ctx) {
        const m = list[i];
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(0, 0, 160, 144);
        const s = G.W.species[m.species];
        if (m.egg) { G.text(ctx, '알', 8, 8); G.text(ctx, '무엇이 태어날까?', 8, 30); return; }
        const c = G.picCanvas(s.front);
        if (c) ctx.drawImage(c, 0 + (56 - c.width) / 2, 56 - c.height);
        G.text(ctx, `No.${String(m.species).padStart(3, '0')}`, 60, 2);
        G.text(ctx, m.name + (m.gender === 'M' ? '♂' : m.gender === 'F' ? '♀' : ''), 60, 14);
        G.text(ctx, `Lv${m.level}`, 158, 2, G.BLACK, 'right');
        G.text(ctx, G.speciesName(m.species), 60, 26, '#505050');
        G.text(ctx, m.types.map(G.typeName).join('/'), 60, 38);
        if (m.shiny) G.text(ctx, '★', 150, 14, '#e8a000');
        ctx.fillStyle = G.BLACK; ctx.fillRect(0, 56, 160, 1);
        if (page === 0) {
          const names = ['HP', '공격', '방어', '스피드', '특수공격', '특수방어'];
          const vals = m.stats || [];
          G.text(ctx, `HP ${m.hp}/${m.maxhp}`, 4, 60);
          G.battleBar(ctx, 100, 64, 52, m.hp, m.maxhp);
          [1, 2, 4, 5, 3].forEach((si, k) => { G.text(ctx, names[si], 4, 74 + k * 12); G.text(ctx, String(vals[si] ?? '-'), 76, 74 + k * 12, G.BLACK, 'right'); });
          G.text(ctx, '경험치', 86, 74);
          G.text(ctx, String(m.exp ?? ''), 158, 86, G.BLACK, 'right');
          G.text(ctx, '다음까지', 86, 98);
          G.text(ctx, String(Math.max(0, (m.expNext || 0) - (m.exp || 0))), 158, 110, G.BLACK, 'right');
          G.text(ctx, `어버이 ${m.ot || '-'}`, 86, 122);
          G.text(ctx, `도구: ${m.item ? G.itemName(m.item) : '없음'}`, 4, 134, '#303030');
        } else {
          (m.moves || []).forEach((mv, k) => {
            const y = 60 + k * 20;
            G.text(ctx, mv.name, 6, y);
            ctx.fillStyle = G.TYPE_COLOR[mv.type] || '#888'; ctx.fillRect(6, y + 12, 4, 6);
            G.text(ctx, G.typeName(mv.type), 12, y + 10, '#505050');
            G.text(ctx, `PP ${mv.pp}/${mv.max}`, 158, y, G.BLACK, 'right');
            G.text(ctx, `위력 ${mv.power > 1 ? mv.power : '-'}  명중 ${mv.acc}`, 158, y + 10, '#505050', 'right');
          });
        }
        G.text(ctx, page === 0 ? '▶' : '◀', 156, 134, '#808080', 'right');
      },
    };
    G.push(scr);
  });
};

// ───────── 가방 ─────────
const POCKETS = [['ITEM', '도구'], ['BALL', '볼'], ['KEY_ITEM', '중요한 물건'], ['TM_HM', '기술머신']];
G.bagScreen = function bagScreen(opts) {
  return new Promise((resolve) => {
    let p = G.lastPocket || 0, i = 0, scroll = 0;
    const pockets = opts.mode === 'battle' ? POCKETS.slice(0, 2) : opts.mode === 'give' ? POCKETS.slice(0, 2) : POCKETS;
    if (p >= pockets.length) p = 0;
    const items = () => {
      const pk = pockets[p][0];
      return Object.entries(G.me.bag).filter(([c, n]) => n > 0 && G.W.items[c] && G.W.items[c].pocket === pk).sort((a, b) => (G.W.items[a[0]].id - G.W.items[b[0]].id));
    };
    const scr = {
      update: async () => {
        if (scr.locked) return;
        const list = items();
        if (G.tap('left')) { p = (p - 1 + pockets.length) % pockets.length; i = 0; scroll = 0; G.lastPocket = p; G.sfx('move'); }
        if (G.tap('right')) { p = (p + 1) % pockets.length; i = 0; scroll = 0; G.lastPocket = p; G.sfx('move'); }
        const n = list.length + 1;
        if (G.tap('up')) { i = (i - 1 + n) % n; G.sfx('move'); }
        if (G.tap('down')) { i = (i + 1) % n; G.sfx('move'); }
        if (i < scroll) scroll = i; if (i >= scroll + 5) scroll = i - 4;
        if (G.input.pressed.b || (G.input.pressed.a && i === list.length)) { G.pop(scr); resolve(null); return; }
        if (!G.input.pressed.a) return;
        G.sfx('select');
        const [code] = list[i];
        const it = G.W.items[code];
        scr.locked = true;
        try {
          if (opts.mode === 'give') {
            if (it.pocket === 'KEY_ITEM' || it.tm || it.hm) { await G.say('그 도구는 지니게 할 수 없다!'); return; }
            G.pop(scr); resolve({ item: code }); return;
          }
          if (opts.mode === 'battle') {
            if (it.battle === 'ITEMMENU_NOUSE' || it.battle === 'ITEMMENU_NOUSE)') { await G.say('지금은 쓸 수 없다!'); return; }
            if (it.pocket === 'BALL') { G.pop(scr); resolve({ item: code }); return; }
            const k = await G.partyScreen({ mode: 'item' });
            if (k < 0) return;
            G.pop(scr); resolve({ item: code, uid: G.me.party[k].uid }); return;
          }
          // 필드
          const acts = [['사용한다', 'use']];
          if (it.pocket !== 'KEY_ITEM' && !it.tm && !it.hm) { acts.push(['지니게 한다', 'give']); acts.push(['버린다', 'toss']); }
          acts.push(['그만둔다', null]);
          const k = await G.choose(acts.map((x) => x[0]), { x: 64, y: 144 - acts.length * 16 - 14, w: 96, rows: acts.length });
          const act = k >= 0 ? acts[k][1] : null;
          if (act === 'use') { const r = await G.useItemField(code); if (r === 'close') { G.pop(scr); resolve('close'); } }
          if (act === 'give') { const m = await G.partyScreen({ mode: 'give' }); if (m >= 0) G.net.send({ t: 'giveItem', uid: G.me.party[m].uid, item: code }); }
          if (act === 'toss') { const q = await G.chooseQty(G.me.bag[code]); if (q && await G.yesno(`${G.josa(G.itemName(code), '을/를')} ${q}개 버리겠습니까?`)) G.net.send({ t: 'toss', item: code, qty: q }); }
        } finally { scr.locked = false; }
      },
      draw: (ctx) => {
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(0, 0, 160, 144);
        ctx.fillStyle = '#d8b878'; ctx.fillRect(0, 0, 48, 96);
        ctx.fillStyle = '#a07838'; ctx.fillRect(8, 20, 32, 40); ctx.fillStyle = '#e8d098'; ctx.fillRect(12, 26, 24, 12);
        G.text(ctx, pockets[p][1], 24, 70, G.BLACK, 'center');
        G.text(ctx, '◀ ▶', 24, 82, '#604020', 'center');
        G.box(ctx, 48, 0, 112, 96);
        const list = items();
        for (let r = 0; r < 5; r++) {
          const k = scroll + r;
          if (k > list.length) break;
          const y = 7 + r * 17;
          if (k === list.length) G.text(ctx, '닫기', 62, y);
          else { G.text(ctx, G.itemName(list[k][0]), 62, y); if (pockets[p][0] !== 'KEY_ITEM') G.text(ctx, `×${list[k][1]}`, 152, y + 8, G.BLACK, 'right'); }
          if (k === i) G.cursor(ctx, 54, y + 1);
        }
        G.box(ctx, 0, 96, 160, 48);
        const cur = list[i];
        if (cur) {
          const it = G.W.items[cur[0]];
          const d = it.tm || it.hm ? `${G.moveName(it.move)} (${G.typeName(G.W.moves[it.move] ? G.W.moves[it.move].type : '')})` : itemDesc(cur[0]);
          G.wrap(ctx, d, 144).slice(0, 2).forEach((l, k) => G.text(ctx, l, 8, 103 + k * 16));
        }
      },
    };
    G.push(scr);
  });
};
function itemDesc(c) {
  const it = G.W.items[c];
  if (!it) return '';
  if (it.healHP) return `체력을 ${it.healHP >= 999 ? '모두' : it.healHP} 회복한다.`;
  if (it.healStatus) return it.healStatus === 'ALL' ? '상태 이상을 모두 고친다.' : '상태 이상을 고친다.';
  if (it.pocket === 'BALL') return '야생 포켓몬에게 던져서 잡는다.';
  const d = { REPEL: '약한 야생 포켓몬이 100걸음 동안 나오지 않는다.', SUPER_REPEL: '약한 야생 포켓몬이 200걸음 동안 나오지 않는다.', MAX_REPEL: '약한 야생 포켓몬이 250걸음 동안 나오지 않는다.', ESCAPE_ROPE: '마지막으로 들른 포켓몬센터로 돌아간다.', RARE_CANDY: '포켓몬의 레벨을 1 올린다.', BICYCLE: '빨리 달릴 수 있다. (Shift 로도 탐)', OLD_ROD: '물가에서 낚시를 한다.', GOOD_ROD: '물가에서 낚시를 한다.', SUPER_ROD: '물가에서 낚시를 한다.', REVIVE: '기절한 포켓몬을 되살린다.', MAX_REVIVE: '기절한 포켓몬을 완전히 되살린다.' }[c];
  if (d) return d;
  if (/STONE/.test(c)) return '특정 포켓몬을 진화시키는 돌.';
  if (it.held && it.held !== 'HELD_NONE') return '포켓몬에게 지니게 하면 효과가 있다.';
  return it.price ? `가격 ${it.price}원` : '';
}

G.useItemField = async function useItemField(code) {
  const it = G.W.items[code];
  if (code === 'BICYCLE') { G.toggleBike(); return 'close'; }
  if (/_ROD$/.test(code)) { await G.fish(code); return 'close'; }
  if (['REPEL', 'SUPER_REPEL', 'MAX_REPEL'].includes(code)) { G.net.send({ t: 'useItem', item: code }); return; }
  if (code === 'ESCAPE_ROPE') { if (!['CAVE', 'DUNGEON'].includes(G.ow.map.env)) { await G.say('여기서는 쓸 수 없다!'); return; } G.net.send({ t: 'useItem', item: code }); return 'close'; }
  if (it.pocket === 'BALL') { await G.say('지금은 쓸 수 없다!'); return; }
  if (it.field === 'ITEMMENU_PARTY' || it.tm || it.hm || /STONE|CANDY|HP_UP|PROTEIN|IRON|CARBOS|CALCIUM|PP_UP|ETHER|ELIXER|REVIVE/.test(code)) {
    if (it.tm || it.hm) await G.say(`${G.itemName(code)}을(를) 켰다!`, {}).then(() => G.say(`${G.josa(G.moveName(it.move), '을/를')} 가르치겠습니까?`));
    const k = await G.partyScreen({ mode: 'item', msg: it.tm || it.hm ? '어느 포켓몬에게 가르칠까요?' : undefined });
    if (k < 0) return;
    const mon = G.me.party[k];
    let slot;
    if (/ETHER|PP_UP/.test(code)) { slot = await G.choose(mon.moves.map((m) => `${m.name} ${m.pp}/${m.max}`), { x: 24, y: 40, w: 136, rows: mon.moves.length }); if (slot < 0) return; }
    G.net.send({ t: 'useItem', item: code, uid: mon.uid, slot });
    return;
  }
  await G.say(`${G.josa(G.me.name, '은/는')} ${G.josa(G.itemName(code), '을/를')} 썼다… 그러나 아무 일도 일어나지 않았다.`);
};

G.fish = async function fish(rod) {
  const ow = G.ow;
  const [dx, dy] = G.DIRS[ow.dir];
  const c = G.collAt(ow.mapId, ow.x + dx, ow.y + dy);
  if (c == null || (G.W.collPerm[c] & 15) !== 1) { await G.say('여기서는 낚시를 할 수 없다!'); return; }
  await G.say(`${G.josa(G.me.name, '은/는')} ${G.josa(G.itemName(rod), '을/를')} 던졌다!`, { auto: 40 });
  await G.wait(40 + Math.random() * 60);
  G.net.send({ t: 'encounter', kind: 'fish', rod });
  G.waitingBattle = 60;
};

// ───────── 필드 기술 ─────────
G.fieldMove = async function fieldMove(mv, mon) {
  const ow = G.ow;
  if (mv === 'FLY') {
    if (!['TOWN', 'ROUTE'].includes(ow.map.env)) { await G.say('여기서는 쓸 수 없다!'); return; }
    const pts = G.W.flypoints.filter((f) => G.me.visited.includes(f.landmark));
    const k = await G.choose(pts.map((f) => G.landmarkName(f.landmark)), { x: 40, y: 0, w: 120, rows: Math.min(7, pts.length) });
    if (k < 0) return;
    G.net.send({ t: 'fly', landmark: pts[k].landmark });
    return 'close';
  }
  if (mv === 'FLASH') {
    if (ow.map.palette !== 'DARK') { await G.say('여기서는 쓸 필요가 없다.'); return; }
    ow.flash = true; await G.say(`${mon.name}의 플래시! 주위가 밝아졌다!`); return 'close';
  }
  if (mv === 'DIG' || mv === 'TELEPORT') { if (mv === 'DIG' && !['CAVE', 'DUNGEON'].includes(ow.map.env)) { await G.say('여기서는 쓸 수 없다!'); return; } G.net.send({ t: 'useItem', item: 'ESCAPE_ROPE', fake: true }); await G.say('여기서는 쓸 수 없다…'); return; }
  if (mv === 'SOFTBOILED' || mv === 'MILK_DRINK') { await G.say('필드에서는 포켓몬센터를 이용해 주세요!'); return; }
  if (mv === 'STRENGTH') { ow.strength = true; await G.say(`${mon.name}의 괴력! 바위를 밀 수 있게 되었다!`); return 'close'; }
  if (mv === 'SURF') { await G.say('물가를 바라보고 A 버튼을 누르세요.'); return 'close'; }
  if (mv === 'CUT' || mv === 'HEADBUTT' || mv === 'ROCK_SMASH' || mv === 'WHIRLPOOL' || mv === 'WATERFALL') { await G.say('대상 앞에서 A 버튼을 누르세요.'); return 'close'; }
};

// ───────── 도감 ─────────
G.dexScreen = function dexScreen() {
  return new Promise((resolve) => {
    let i = 0, scroll = 0, detail = false;
    const max = 251;
    const scr = {
      update() {
        if (detail) { if (G.input.pressed.b || G.input.pressed.a) detail = false; if (G.tap('up')) i = Math.max(0, i - 1); if (G.tap('down')) i = Math.min(max - 1, i + 1); return; }
        if (G.tap('up')) i = Math.max(0, i - 1);
        if (G.tap('down')) i = Math.min(max - 1, i + 1);
        if (G.tap('left')) i = Math.max(0, i - 7);
        if (G.tap('right')) i = Math.min(max - 1, i + 7);
        if (i < scroll) scroll = i; if (i >= scroll + 7) scroll = i - 6;
        if (G.input.pressed.b) { G.pop(scr); resolve(); return; }
        if (G.input.pressed.a && G.me.seen.includes(i + 1)) detail = true;
      },
      draw(ctx) {
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(0, 0, 160, 144);
        const id = i + 1;
        const seen = G.me.seen.includes(id), caught = G.me.caught.includes(id);
        if (detail) {
          const s = G.W.species[id];
          const c = G.picCanvas(s.front);
          if (c) ctx.drawImage(c, 4 + (56 - c.width) / 2, 4 + 56 - c.height);
          G.text(ctx, `No.${String(id).padStart(3, '0')}`, 66, 8);
          G.text(ctx, G.speciesName(id), 66, 22);
          G.text(ctx, caught ? s.types.map(G.typeName).join('/') : '?', 66, 36);
          G.box(ctx, 0, 64, 160, 80);
          G.text(ctx, caught ? `종족값 ${s.base.reduce((a, b) => a + b, 0)}` : '아직 잡지 못했다.', 8, 72);
          if (caught) {
            const names = ['HP', '공격', '방어', '스피드', '특공', '특방'];
            s.base.forEach((v, k) => { const x = 8 + (k % 3) * 50, y = 88 + Math.floor(k / 3) * 14; G.text(ctx, `${names[k]} ${v}`, x, y); });
            G.text(ctx, `잡기 쉬움 ${s.catchRate}`, 8, 120, '#505050');
          }
          return;
        }
        ctx.fillStyle = '#c03028'; ctx.fillRect(0, 0, 160, 16);
        G.text(ctx, `포켓몬 도감  본 수 ${G.me.seen.length}  잡은 수 ${G.me.caught.length}`, 4, 3, '#f8f8f8');
        const sp = seen ? G.W.species[id] : null;
        if (sp) { const c = G.picCanvas(sp.front); if (c) ctx.drawImage(c, 2 + (56 - c.width) / 2, 30 + 56 - c.height); }
        else { ctx.fillStyle = '#d0d0d0'; ctx.fillRect(14, 50, 32, 32); G.text(ctx, '?', 30, 60, '#808080', 'center'); }
        for (let r = 0; r < 7; r++) {
          const k = scroll + r;
          if (k >= max) break;
          const y = 20 + r * 17;
          const sid = k + 1;
          const s2 = G.me.seen.includes(sid), c2 = G.me.caught.includes(sid);
          if (c2) G.drawBall(ctx, 64, y + 2);
          G.text(ctx, String(sid).padStart(3, '0'), 76, y);
          G.text(ctx, s2 ? G.speciesName(sid) : '-----', 100, y);
          if (k === i) G.cursor(ctx, 58, y + 1);
        }
      },
    };
    G.push(scr);
  });
};

// ───────── 트레이너 카드 ─────────
G.trainerCard = function trainerCard() {
  return new Promise((resolve) => {
    const scr = {
      update() { if (G.input.pressed.a || G.input.pressed.b) { G.pop(scr); resolve(); } },
      draw(ctx) {
        ctx.fillStyle = '#f8e8b8'; ctx.fillRect(0, 0, 160, 144);
        G.box(ctx, 0, 0, 160, 72);
        const me = G.me;
        G.text(ctx, `이름/ ${me.name}`, 10, 10);
        G.text(ctx, `돈     ${me.money}원`, 10, 26);
        G.text(ctx, `도감   ${me.caught.length}마리`, 10, 42);
        const ms = me.playMs || 0;
        G.text(ctx, `플레이 ${Math.floor(ms / 3600000)}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}`, 10, 56);
        const c = G.spriteFrame(G.W.sprites[1].file, G.LOOK_PAL[me.look & 3], 1, 0, false);
        if (c) { ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(c, 116, 16, 32, 32); ctx.restore(); }
        G.text(ctx, '배지', 8, 78);
        const badges = Object.keys(G.W.ko.badges);
        badges.forEach((b, k) => {
          const x = 8 + (k % 8) * 19, y = 94 + Math.floor(k / 8) * 22;
          const got = me.badges.includes(b);
          ctx.fillStyle = got ? ['#a0a0a0', '#e8c020', '#f8f8f8', '#9070c0', '#e09040', '#c8c8d8', '#80c8f0', '#e04040', '#888', '#4878e8', '#f8a000', '#40c040', '#f080b0', '#f8d800', '#e83020', '#30a030'][k] : '#d8c8a0';
          ctx.beginPath(); ctx.arc(x + 7, y + 7, 7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#101010'; if (got) { ctx.fillRect(x + 6, y + 6, 2, 2); }
        });
        G.text(ctx, '조토', 156, 78, '#806040', 'right');
      },
    };
    G.push(scr);
  });
};

// ───────── PC ─────────
G.openPC = async function openPC() {
  G.net.send({ t: 'busy', busy: true });
  await G.say(`${G.josa(G.me.name, '은/는')} PC의 스위치를 켰다!`);
  for (;;) {
    const k = await G.choose([`${G.me.name}의 PC`, '포켓몬 맡기기', '포켓몬 데려가기', '포켓몬 놓아주기', '스위치를 끈다'], { x: 0, y: 0, w: 120, rows: 5, start: 1 });
    if (k < 0 || k === 4) break;
    if (k === 0) { await G.say(`맡긴 포켓몬: ${G.me.box.length}마리`); continue; }
    if (k === 1) {
      const i = await G.partyScreen({ mode: 'deposit', msg: '어느 포켓몬을 맡길까요?' });
      if (i >= 0) G.net.send({ t: 'deposit', uid: G.me.party[i].uid });
      continue;
    }
    if (!G.me.box.length) { await G.say('맡긴 포켓몬이 없다!'); continue; }
    const list = G.me.box.map((m) => ({ label: m.name, right: `Lv${m.level}` }));
    const i = await G.choose(list, { x: 24, y: 0, w: 136, rows: 7, extra: (ctx, idx) => { const m = G.me.box[idx]; if (!m) return; const c = G.picCanvas(G.W.species[m.species].front); if (c) ctx.drawImage(c, 0, 144 - c.height - 4, c.width / 2, c.height / 2); } });
    if (i < 0) continue;
    const m = G.me.box[i];
    if (k === 2) G.net.send({ t: 'withdraw', uid: m.uid });
    if (k === 3 && await G.yesno(`정말로 ${G.josa(m.name, '을/를')} 놓아주겠습니까?`)) G.net.send({ t: 'release', uid: m.uid });
  }
  G.net.send({ t: 'busy', busy: false });
};

// ───────── 상점 ─────────
G.openMart = async function openMart(list) {
  G.net.send({ t: 'busy', busy: true });
  await G.say('어서 오세요! 무엇을 도와 드릴까요?', { noWait: false });
  for (;;) {
    const k = await G.choose(['사러 왔다', '팔러 왔다', '그만둔다'], { x: 0, y: 0, w: 96, rows: 3 });
    if (k < 0 || k === 2) break;
    if (k === 0) {
      for (;;) {
        const i = await G.choose(list.map((x) => ({ label: x.name, right: `${x.price}원` })).concat([{ label: '그만둔다' }]), { x: 16, y: 0, w: 144, rows: 6, extra: (ctx) => { G.box(ctx, 0, 112, 80, 32); G.text(ctx, `${G.me.money}원`, 72, 121, G.BLACK, 'right'); } });
        if (i < 0 || i === list.length) break;
        const it = list[i];
        const maxQ = Math.max(1, Math.min(99, Math.floor(G.me.money / Math.max(1, it.price))));
        if (G.me.money < it.price) { await G.say('돈이 모자랍니다.'); continue; }
        const q = await G.chooseQty(maxQ, { price: it.price });
        if (!q) continue;
        if (await G.yesno(`${G.josa(it.name, '을/를')} ${q}개 해서 ${it.price * q}원입니다. 괜찮으십니까?`)) { G.net.send({ t: 'buy', item: it.id, qty: q }); G.sfx('select'); await G.say('감사합니다!'); }
      }
    }
    if (k === 1) {
      for (;;) {
        const sellable = Object.entries(G.me.bag).filter(([c, n]) => n > 0 && G.W.items[c] && G.W.items[c].price && G.W.items[c].pocket !== 'KEY_ITEM' && !G.W.items[c].hm);
        if (!sellable.length) { await G.say('팔 수 있는 물건이 없다.'); break; }
        const i = await G.choose(sellable.map(([c, n]) => ({ label: G.itemName(c), right: `×${n}` })), { x: 16, y: 0, w: 144, rows: 6 });
        if (i < 0) break;
        const [c, n] = sellable[i];
        const price = Math.floor(G.W.items[c].price / 2);
        const q = await G.chooseQty(n, { price });
        if (!q) continue;
        if (await G.yesno(`${price * q}원에 사겠습니다. 괜찮으십니까?`)) G.net.send({ t: 'sell', item: c, qty: q });
      }
    }
  }
  await G.say('또 오세요!');
  G.net.send({ t: 'busy', busy: false });
};

// ───────── 친구 ─────────
G.friendsMenu = async function friendsMenu() {
  const list = [...G.ow.others.values()];
  if (!list.length) { await G.say([['지금 접속한 친구가 없다.'], ['옆 컴퓨터에서 같은 주소로 들어오면 함께할 수 있어요!']]); return; }
  const k = await G.choose(list.map((o) => ({ label: o.name, right: G.landmarkName(G.W.maps[o.map] ? G.W.maps[o.map].landmark : '') })), { x: 0, y: 0, w: 160, rows: Math.min(6, list.length) });
  if (k < 0) return;
  return G.playerMenu(list[k]);
};
G.playerMenu = async function playerMenu(o) {
  G.net.send({ t: 'busy', busy: true });
  const teamed = G.me.team === o.id;
  const items = [['싱글 배틀', 'battle1'], ['더블 배틀', 'battle2'], ['포켓몬 교환', 'trade'], [teamed ? '동행 끝내기' : '함께 다니기', teamed ? 'unteam' : 'team'], ['그만둔다', null]];
  const k = await G.choose(items.map((x) => x[0]), { x: 160 - 100, y: 0, w: 100, rows: items.length, extra: (ctx) => { G.box(ctx, 0, 112, 60, 32); G.text(ctx, o.name, 30, 121, G.BLACK, 'center'); } });
  G.net.send({ t: 'busy', busy: false });
  if (k < 0 || !items[k][1]) return;
  G.net.send({ t: 'ask', to: o.id, kind: items[k][1] });
  return 'close';
};

/** 다른 사람의 신청 */
G.incoming = [];
G.handleAsked = async function handleAsked() {
  if (G.askBusy || !G.incoming.length || G.battle || G.uiBusy()) return;
  const a = G.incoming.shift();
  G.askBusy = true;
  try {
    const yes = await G.yesno([[`${G.josa(a.name, '이/가')}`, `${G.josa(a.label, '을/를')} 신청했다!`], ['받아들이겠습니까?']]);
    G.net.send({ t: 'answer', id: a.id, yes });
  } finally { G.askBusy = false; }
};

// ───────── 교환 ─────────
G.tradeScreen = function tradeScreen() {
  if (G.tradeScr) return;
  let side = 0, i = 0;
  const scr = (G.tradeScr = {
    update: async () => {
      const t = G.tradeState;
      if (!t) { G.pop(scr); G.tradeScr = null; return; }
      if (scr.locked) return;
      const list = side === 0 ? t.mine : t.theirs;
      if (G.tap('up')) i = (i - 1 + list.length + 1) % (list.length + 1);
      if (G.tap('down')) i = (i + 1) % (list.length + 1);
      if (G.tap('left') || G.tap('right')) { side = 1 - side; i = Math.min(i, (side === 0 ? t.mine : t.theirs).length); }
      if (G.input.pressed.b) { scr.locked = true; if (await G.yesno('교환을 그만두겠습니까?')) G.net.send({ t: 'tradeCancel' }); scr.locked = false; return; }
      if (!G.input.pressed.a) return;
      if (i === list.length) { scr.locked = true; if (await G.yesno('교환을 그만두겠습니까?')) G.net.send({ t: 'tradeCancel' }); scr.locked = false; return; }
      scr.locked = true;
      if (side === 1) { await G.summary(t.theirs, i); scr.locked = false; return; }
      const k = await G.choose(['이 포켓몬 내놓기', '능력을 본다', '그만둔다'], { x: 56, y: 88, w: 104, rows: 3 });
      if (k === 0) G.net.send({ t: 'tradeOffer', uid: t.mine[i].uid });
      if (k === 1) await G.summary(t.mine, i);
      scr.locked = false;
    },
    draw: (ctx) => {
      const t = G.tradeState;
      ctx.fillStyle = '#f8f8f8'; ctx.fillRect(0, 0, 160, 144);
      if (!t) return;
      G.text(ctx, '나', 40, 1, G.BLACK, 'center'); G.text(ctx, t.otherName, 120, 1, G.BLACK, 'center');
      ctx.fillStyle = G.BLACK; ctx.fillRect(80, 0, 1, 104);
      const drawList = (list, x, offer, s) => list.forEach((m, k) => {
        const y = 13 + k * 14;
        if (offer === m.uid) { ctx.fillStyle = '#f8e0a0'; ctx.fillRect(x, y - 1, 80, 14); }
        const ic = G.icon(m.species, 0); if (ic) ctx.drawImage(ic, x + 8, y - 3);
        G.text(ctx, m.name, x + 26, y);
        if (side === s && i === k) G.cursor(ctx, x + 1, y + 1);
      });
      drawList(t.mine, 0, t.myOffer, 0);
      drawList(t.theirs, 80, t.theirOffer, 1);
      const cl = (side === 0 ? t.mine : t.theirs).length;
      G.text(ctx, '그만두기', side === 0 ? 26 : 106, 13 + 6 * 14 - 2);
      if (i === cl) G.cursor(ctx, side === 0 ? 17 : 97, 13 + 6 * 14 - 1);
      G.box(ctx, 0, 104, 160, 40);
      const mo = t.mine.find((m) => m.uid === t.myOffer), to = t.theirs.find((m) => m.uid === t.theirOffer);
      G.text(ctx, `내 것: ${mo ? mo.name : '-'}  →  받을 것: ${to ? to.name : '-'}`, 8, 110);
      G.text(ctx, mo && to ? (t.myOk ? '상대의 확인을 기다리는 중…' : (t.theirOk ? '상대가 확인했다! Enter 로 교환' : 'Enter 를 누르면 교환 확정')) : '내놓을 포켓몬을 고르세요.', 8, 126, '#404040');
      if (mo && to && !t.myOk && G.input.pressed.start) G.net.send({ t: 'tradeOk' });
    },
  });
  G.push(scr);
};

// ───────── 설정 ─────────
G.optionsMenu = async function optionsMenu() {
  for (;;) {
    const s = G.settings;
    const items = [
      `글자 속도: ${s.fastText ? '빠르게' : '보통'}`,
      `배틀 글: ${s.manualText ? 'A로 넘기기' : '자동으로 넘기기'}`,
      `효과음: ${s.mute ? '끔' : '켬'}`,
      `B 누르고 달리기: ${s.run === false ? '끔' : '켬'}`,
      `옷 색깔: ${['빨강', '파랑', '초록', '갈색'][G.me.look & 3]}`,
      '갇혔어요 (포켓몬센터로)',
      '닫기',
    ];
    const k = await G.choose(items, { x: 0, y: 0, w: 160, rows: items.length });
    if (k < 0 || k === 6) break;
    if (k === 5) { if (await G.yesno('마지막으로 들른 포켓몬센터로 돌아가겠습니까?')) { G.net.send({ t: 'unstuck' }); return 'close'; } continue; }
    if (k === 0) s.fastText = !s.fastText;
    if (k === 1) s.manualText = !s.manualText;
    if (k === 2) s.mute = !s.mute;
    if (k === 3) s.run = s.run === false;
    if (k === 4) G.net.send({ t: 'look', look: (G.me.look + 1) & 3 });
    G.saveSettings();
  }
};
})();
