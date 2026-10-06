'use strict';
// 언락! — 시나리오 설명(키 이름으로 쓴 카드)을 실제 카드 번호가 붙은 시나리오로 만든다.
// 빨강+파랑 카드를 합치면 두 번호의 합이 결과 카드 번호가 되도록 번호를 자동으로 정한다.

const COLORS = ['red', 'blue'];
const TYPES = ['place', 'red', 'blue', 'code', 'machine', 'item', 'trap'];

function hash(str) { let h = 2166136261; for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function build(spec) {
  const cards = spec.cards.map((c) => ({ ...c }));
  const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));
  const err = (m) => { throw new Error(`[${spec.id}] ${m}`); };
  for (const c of cards) {
    if (!TYPES.includes(c.type)) err(`알 수 없는 카드 종류 ${c.key}:${c.type}`);
    for (const k of [...(c.shows || []), ...(c.discard || []), ...(c.from || []), ...(c.spots || []).map((s) => s.reveal).filter(Boolean), c.result].filter(Boolean)) if (!byKey[k]) err(`${c.key} → 없는 카드 ${k}`);
    if (c.from && (c.from.length !== 2 || !c.from.every((k) => COLORS.includes(byKey[k].type)) || byKey[c.from[0]].type === byKey[c.from[1]].type)) err(`${c.key}: 빨강 1장 + 파랑 1장을 합쳐야 해요`);
  }
  // 장소: A, B, C …
  let li = 0;
  // (조합으로 나오는 장소는 번호가 합이어야 하므로 숫자)
  for (const c of cards) if (c.type === 'place' && !c.from) c.num = String.fromCharCode(65 + li++);
  const others = cards.filter((c) => c.type !== 'place' || c.from);
  const order = [];
  const seen = new Set();
  const visit = (c) => { if (seen.has(c.key)) return; seen.add(c.key); for (const k of c.from || []) visit(byKey[k]); order.push(c); };
  others.forEach(visit);
  const rand = rng(hash(spec.id));
  for (let tryNo = 0; tryNo < 4000; tryNo++) {
    const used = new Set();
    let ok = true;
    for (const c of order) {
      let n;
      if (c.from) n = byKey[c.from[0]].num + byKey[c.from[1]].num;
      else for (let k = 0; k < 50; k++) { n = 1 + Math.floor(rand() * (tryNo < 2000 ? 48 : 60)); if (!used.has(n)) break; }
      if (n > 99 || used.has(n)) { ok = false; break; }
      used.add(n); c.num = n;
    }
    if (ok) break;
    if (tryNo === 3999) err('카드 번호를 정할 수 없어요');
  }
  // 힌트가 없는 카드에 자동 힌트
  for (const c of cards) {
    if (c.hint && c.hint.length) continue;
    if (c.type === 'red' || c.type === 'blue') {
      const combo = cards.find((r) => r.from && r.type !== 'trap' && r.from.includes(c.key));
      if (combo) { const other = byKey[combo.from.find((k) => k !== c.key)]; c.hint = [`이 카드는 ${c.type === 'red' ? '파란' : '빨간'} 카드 하나와 합칠 수 있어요.`, `「${other.title}」와(과) 합쳐 보세요.`]; }
    } else if (c.type === 'place' && c.spots && c.spots.some((sp) => sp.reveal)) {
      c.hint = ['그림 속 점선 동그라미를 모두 살펴보세요.', `숨은 번호: ${c.spots.filter((sp) => sp.reveal).map((sp) => sp.label).join(', ')}`];
    }
  }
  const out = { ...spec, cards, byKey, byNum: Object.fromEntries(cards.map((c) => [String(c.num), c])) };
  out.start = spec.start || cards.filter((c) => c.start).map((c) => c.key);
  if (!out.start.length) out.start = [cards[0].key];
  if (!cards.some((c) => c.end)) err('끝 카드가 없어요');
  return out;
}

/** 자동 풀이: 알려진 정답을 따라 끝 카드까지 갈 수 있는지 (테스트용) */
function solve(sc) {
  const inPlay = new Set();
  const gone = new Set();
  const reveal = (k) => { if (inPlay.has(k) || gone.has(k)) return; inPlay.add(k); const c = sc.byKey[k]; for (const d of c.discard || []) { inPlay.delete(d); gone.add(d); } for (const s of c.shows || []) reveal(s); };
  sc.start.forEach(reveal);
  const done = new Set();
  for (let step = 0; step < 200; step++) {
    if ([...inPlay].some((k) => sc.byKey[k].end)) {
      // 끝까지 가는 동안 한 번도 나오지 않는 카드 (함정 제외) — 쓸모없는 카드가 없는지 확인용
      const seenAll = new Set([...inPlay, ...gone]);
      return { ok: true, steps: step, unused: sc.cards.filter((c) => c.type !== 'trap' && !seenAll.has(c.key)).map((c) => c.key) };
    }
    let moved = false;
    for (const k of [...inPlay]) {
      const c = sc.byKey[k];
      (c.spots || []).forEach((s, i) => { const id = `${k}#${i}`; if (s.reveal && !done.has(id)) { done.add(id); reveal(s.reveal); moved = true; } });
      if ((c.type === 'code' || c.type === 'machine') && !done.has(k) && c.result) { done.add(k); reveal(c.result); moved = true; }
    }
    for (const c of sc.cards) if (c.from && !inPlay.has(c.key) && !gone.has(c.key) && c.from.every((k) => inPlay.has(k))) { reveal(c.key); moved = true; }
    if (!moved) return { ok: false, inPlay: [...inPlay] };
  }
  return { ok: false };
}

module.exports = { build, solve };
