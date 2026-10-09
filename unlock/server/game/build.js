'use strict';
// 언락! — 시나리오 설명(키 이름으로 쓴 카드)을 실제 카드 번호가 붙은 시나리오로 만든다.
// 원작 규칙: 빨간 번호 + 파란 번호 = 새 카드 번호. 보정 숫자(+N)는 다른 색 번호에 더한다.
// 번호는 자동으로 정하고, 원작처럼 덱에는 “틀린 조합을 하면 걸리는” 벌점 카드도 섞어 둔다.

const COLORS = ['red', 'blue'];
const TYPES = ['place', 'red', 'blue', 'code', 'machine', 'item', 'trap'];

function hash(str) { let h = 2166136261; for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const DECOY_TEXT = [
  '이건 아닌 것 같다… 소중한 시간만 날아갔다.',
  '덜컹! 아무 일도 일어나지 않았다. 괜히 손만 다쳤다.',
  '그럴듯했지만 틀렸다. 처음부터 다시 생각해 보자.',
  '삐— 경고음이 울린다. 서둘러 원래대로 돌려놓았다.',
  '전혀 어울리지 않는 조합이다. 시간이 흘러간다.',
];

/** 조합 재료로서의 색과 값 (보정 숫자를 가진 카드는 그 색·값) */
function partOf(c) {
  if (c.plus != null) return { color: c.plusColor || 'blue', value: null, plus: c.plus };
  if (COLORS.includes(c.type)) return { color: c.type, value: null };
  return null;
}

function build(spec) {
  const cards = spec.cards.map((c) => ({ ...c, spots: c.spots ? c.spots.map((s) => ({ ...s })) : undefined }));
  const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));
  const err = (m) => { throw new Error(`[${spec.id}] ${m}`); };
  for (const c of cards) {
    if (!TYPES.includes(c.type)) err(`알 수 없는 카드 종류 ${c.key}:${c.type}`);
    for (const k of [...(c.shows || []), ...(c.discard || []), ...(c.from || []), ...(c.spots || []).map((s) => s.reveal).filter(Boolean), c.result].filter(Boolean)) if (!byKey[k]) err(`${c.key} → 없는 카드 ${k}`);
    if (c.from) {
      const ps = c.from.map((k) => partOf(byKey[k]));
      if (c.from.length !== 2 || ps.some((p) => !p) || ps[0].color === ps[1].color) err(`${c.key}: 빨강 1 + 파랑 1 (또는 보정 숫자)을 합쳐야 해요`);
      if (ps[0].plus != null && ps[1].plus != null) err(`${c.key}: 보정 숫자끼리는 합칠 수 없어요`);
    }
    if (c.type === 'machine' && (!c.solution || !c.solution.every((b) => c.buttons.includes(b)))) err(`${c.key}: 장치 정답이 버튼에 없어요`);
  }
  // 장소는 A, B, C … (조합으로 나오는 장소는 번호가 합이어야 하므로 숫자)
  let li = 0;
  for (const c of cards) if (c.type === 'place' && !c.from) c.num = String.fromCharCode(65 + li++);
  const numbered = cards.filter((c) => c.type !== 'place' || c.from);
  const order = [];
  const seen = new Set();
  const visit = (c) => { if (seen.has(c.key)) return; seen.add(c.key); for (const k of c.from || []) visit(byKey[k]); order.push(c); };
  numbered.forEach(visit);
  const val = (k) => (byKey[k].plus != null ? byKey[k].plus : byKey[k].num);
  const rand = rng(hash(spec.id));
  // 조합 재료는 작은 번호(합이 99를 넘지 않도록), 조합 결과는 합, 나머지는 남은 번호 중 아무거나
  const sources = new Set(cards.flatMap((c) => c.from || []));
  const combo = order.filter((c) => c.from || sources.has(c.key));
  const rest = order.filter((c) => !c.from && !sources.has(c.key));
  let srcMax = 40;
  for (let tryNo = 0; tryNo < 8000; tryNo++) {
    if (tryNo && tryNo % 1000 === 0) srcMax = Math.min(49, srcMax + 2);
    const used = new Set();
    let ok = true;
    for (const c of combo) {
      let n;
      if (c.from) n = val(c.from[0]) + val(c.from[1]);
      else for (let k = 0; k < 80; k++) { n = 1 + Math.floor(rand() * srcMax); if (!used.has(n)) break; }
      if (n > 99 || used.has(n)) { ok = false; break; }
      used.add(n); c.num = n;
    }
    if (ok) {
      const free = []; for (let n = 1; n <= 99; n++) if (!used.has(n)) free.push(n);
      if (free.length < rest.length + 10) { ok = false; }
      else for (const c of rest) { const i = Math.floor(rand() * free.length); c.num = free.splice(i, 1)[0]; }
    }
    if (ok) break;
    if (tryNo === 7999) err('카드 번호를 정할 수 없어요');
  }
  // 원작처럼 덱에 벌점 카드를 섞는다 (틀린 조합의 합이 이 번호면 벌점)
  const used = new Set(cards.map((c) => c.num));
  const nDecoy = spec.decoys ?? Math.max(2, Math.round(numbered.length * 0.2));
  for (let i = 0; i < nDecoy; i++) {
    let n = null;
    for (let k = 0; k < 400; k++) { const t = 10 + Math.floor(rand() * 90); if (!used.has(t)) { n = t; break; } }
    if (n == null) break;
    used.add(n);
    cards.push({ key: `__decoy${i}`, type: 'trap', decoy: true, num: n, title: '벌점', text: DECOY_TEXT[i % DECOY_TEXT.length], penalty: 1 });
  }
  for (const c of cards) byKey[c.key] = c;
  // 숨은 번호: reveal 이 있는 살펴보기 지점은 원작처럼 그림 속 작은 번호 (click:true 면 눌러서 찾기)
  for (const c of cards) for (const s of c.spots || []) if (s.reveal) { s.num = byKey[s.reveal].num; if (!s.click) s.hidden = true; }
  // 물건 카드는 그림이 가운데에 크게 있어서, 숨은 번호가 그림에 가려지지 않게 아래 가장자리로
  for (const c of cards) if (c.type !== 'place') for (const s of c.spots || []) if (s.hidden && s.x > 18 && s.x < 82 && s.y > 15 && s.y < 84) { s.x = s.x < 50 ? 12 : 88; s.y = 84; }
  // 힌트가 없는 카드에 자동 힌트 — 1단계: 짝이 될 카드를 어디서 찾는지, 2단계: 무엇과 합쳐 몇 번이 되는지
  const origin = {};
  const note = (k, o) => { if (!origin[k]) origin[k] = o; };
  for (const c of cards) {
    if (c.decoy) continue;
    (c.spots || []).forEach((sp) => { if (sp.reveal) note(sp.reveal, { via: 'spot', card: c, label: sp.label }); });
    for (const k of c.shows || []) note(k, { via: 'shows', card: c });
    if (c.result) note(c.result, { via: 'result', card: c });
    if (c.from && c.type !== 'trap') note(c.key, { via: 'combo', card: c });
  }
  // 받침에 맞춘 조사: j(word, '이', '가') → 받침 있으면 '이', 없으면 '가'
  const j = (w, yes, no) => { const ch = String(w).replace(/[^가-힣0-9A-Za-z]+$/u, '').slice(-1); const code = ch.charCodeAt(0) - 0xac00; if (code >= 0 && code < 11172) return w + (code % 28 ? yes : no); return `${w}${yes}(${no})`; };
  const q = (t) => `「${t}」`;
  const qj = (t, yes, no) => j(q(t), yes, no);
  const whereIs = (o) => {
    const src = origin[o.key];
    const need = `${qj(o.title, '이', '가')} 필요해요.`;
    if (!src) return `${qj(o.title, '은', '는')} 처음부터 펼쳐져 있는 카드예요.`;
    if (src.via === 'spot') return `${need} ${q(src.card.title)} 카드의 ${j(`'${src.label}'`, '을', '를')} 자세히 살펴보세요.`;
    if (src.via === 'shows') return `${need} ${q(src.card.title)} 카드를 펼치면 함께 나와요.`;
    if (src.via === 'result') return `${need} ${qj(src.card.title, '을', '를')} 풀면 나와요.`;
    return `${need} ${qj(byKey[src.card.from[0]].title, '과', '와')} ${qj(byKey[src.card.from[1]].title, '을', '를')} 먼저 합치면 나와요.`;
  };
  const valText = (k) => (byKey[k].plus != null ? `+${byKey[k].plus}` : `${byKey[k].num}`);
  for (const c of cards) {
    if (c.decoy || (c.hint && c.hint.length)) continue;
    const combo = cards.find((r) => r.from && r.type !== 'trap' && r.from.includes(c.key));
    if (combo) {
      const other = byKey[combo.from.find((k) => k !== c.key)];
      const plusNote = other.plus != null ? ` 이미 있다면: 그 카드의 +${other.plus}는 이 카드 번호에 더하는 보정 숫자예요.` : '';
      c.hint = [whereIs(other) + plusNote, `「${c.title}」(${valText(c.key)}) + 「${other.title}」(${valText(other.key)}) = ${combo.num}번 카드!`];
    } else if (c.spots && c.spots.some((sp) => sp.reveal)) {
      const sps = c.spots.filter((sp) => sp.reveal);
      c.hint = [`${sps.map((sp) => `'${sp.label}'`).join(', ')} 쪽을 자세히 보세요. ${sps.some((sp) => sp.hidden) ? '그림 속에 작은 숫자가 섞여 있어요.' : '🔍 표시를 눌러 살펴보세요.'}`,
        sps.map((sp) => (sp.hidden ? `'${sp.label}'의 숨은 번호는 ${sp.num} → “번호로 카드 가져오기”에 입력!` : `'${sp.label}'의 🔍를 눌러 보세요.`)).join(' / ')];
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
  for (let step = 0; step < 400; step++) {
    if ([...inPlay].some((k) => sc.byKey[k].end)) {
      const seenAll = new Set([...inPlay, ...gone]);
      return { ok: true, steps: step, unused: sc.cards.filter((c) => c.type !== 'trap' && !seenAll.has(c.key)).map((c) => c.key) };
    }
    let moved = false;
    for (const k of [...inPlay]) {
      const c = sc.byKey[k];
      (c.spots || []).forEach((s, i) => { const id = `${k}#${i}`; if (s.reveal && !done.has(id)) { done.add(id); reveal(s.reveal); moved = true; } });
      if ((c.type === 'code' || c.type === 'machine') && !done.has(k) && c.result) { done.add(k); reveal(c.result); moved = true; }
    }
    for (const c of sc.cards) if (c.from && c.type !== 'trap' && !inPlay.has(c.key) && !gone.has(c.key) && c.from.every((k) => inPlay.has(k))) { reveal(c.key); moved = true; }
    if (!moved) return { ok: false, inPlay: [...inPlay] };
  }
  return { ok: false };
}

module.exports = { build, solve, partOf };
