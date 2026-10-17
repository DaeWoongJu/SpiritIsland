'use strict';
// 원작 맵 스크립트(pokegold maps/*.asm)를 서버에서 돌릴 수 있는 간단한 명령 목록으로 바꾼다.
// 한 맵 파일의 모든 명령을 순서대로 한 줄로 펼쳐서, 라벨은 그 위치(pc)로 바꾼다.
// (라벨 끝에서 다음 라벨로 그냥 이어지는 원작 흐름도 그대로 됨)

const CMD = /^([a-z_0-9]+)\b\s*(.*)$/;

/** 움직임 라벨 → [{k:'step'|'turn'|'jump'|'sleep', d, n}] */
function parseMovement(lines) {
  const out = [];
  for (const l of lines) {
    const m = l.match(CMD);
    if (!m) continue;
    const [, c, rest] = m;
    const d = (rest.split(',')[0] || '').trim().toLowerCase();
    if (/^(step|big_step|slow_step|fast_slide_step|slide_step)$/.test(c)) out.push({ k: 'step', d, sp: c === 'big_step' ? 2 : c === 'slow_step' ? 0.5 : 1 });
    else if (/jump_step$/.test(c)) out.push({ k: 'jump', d });
    else if (c === 'turn_head' || c === 'turn_step' || c === 'half_step') out.push({ k: 'turn', d });
    else if (/^step_sleep|^step_wait/.test(c)) out.push({ k: 'sleep', n: parseInt(rest, 10) || 8 });
    else if (c === 'remove_object' || c === 'hide_object') out.push({ k: 'hide' });
    else if (c === 'show_object') out.push({ k: 'show' });
    else if (c === 'step_end' || c === 'step_resume') break;
  }
  return out;
}

/**
 * @param ls      맵 파일의 줄들 (주석 지움, 들여쓰기 유지)
 * @param env     { args, num, getText, speciesConst, sceneVal, itemConst, strings }
 */
function compile(ls, env) {
  const { args, getText, speciesConst } = env;
  const ops = [];
  const at = {};
  const moves = {};
  const objConsts = [];
  const scenes = []; // 장면 번호 → 라벨
  const callbacks = [];
  const coords = [];
  const strings = {}; // .mapcardname 같은 db "...@" 글
  let global = null;
  let inObjConsts = false;
  let skipYesno = false;
  let curLabel = null;
  const labelLines = new Map(); // 움직임 데이터용
  const full = (name) => (name.startsWith('.') ? (global || '') + name : name);
  const sp = (x) => speciesConst[x] || 0;
  const target = (x) => (x === 'PLAYER' ? -1 : x === 'LAST_TALKED' ? 'last' : x);
  const dirOf = (x) => String(x || '').toLowerCase();

  for (const raw of ls) {
    if (!raw.trim()) continue;
    const lm = raw.match(/^([A-Za-z_][\w.]*)::?\s*(.*)$/) || raw.match(/^(\.[A-Za-z_][\w.]*):?(?:\s+(.*))?$/);
    if (lm && !/^\s/.test(raw)) {
      const name = full(lm[1]);
      if (!lm[1].startsWith('.')) global = lm[1];
      at[name] = ops.length;
      curLabel = name;
      labelLines.set(name, []);
      inObjConsts = false;
      if (!lm[2]) continue;
      if (/^[a-z_]+\b/.test(lm[2]) && !/^db\b/.test(lm[2])) { /* 라벨 뒤 같은 줄 명령은 드묾 */ }
      const sm = lm[2].match(/^db\s+"(.*)@"/);
      if (sm) strings[name] = sm[1];
      continue;
    }
    const line = raw.trim();
    if (curLabel) labelLines.get(curLabel).push(line);
    const m = line.match(CMD);
    if (!m) continue;
    const c = m[1], a = args(m[2] || '');
    const t = (lab) => { const x = getText(lab); return x || null; };
    const L = (lab) => (lab ? full(lab) : null);
    switch (c) {
      case 'object_const_def': inObjConsts = true; break;
      case 'db': { const sm = (m[2] || '').match(/^"(.*)@"/); if (sm && curLabel && strings[curLabel] === undefined) strings[curLabel] = sm[1]; break; }
      case 'const': if (inObjConsts) objConsts.push(a[0]); break;
      case 'scene_script': scenes.push(a[0]); break;
      case 'callback': callbacks.push({ type: a[0].replace('MAPCALLBACK_', ''), label: a[1] }); break;
      case 'coord_event': coords.push({ x: +a[0], y: +a[1], scene: env.sceneVal(a[2]), label: a[3] }); break;
      // 글
      case 'writetext': case 'farwritetext': {
        if (/DST/.test(a[0])) { skipYesno = true; break; } // 서머타임 질문은 건너뜀
        const x = t(a[0]); if (x) ops.push(['t', x]); break;
      }
      case 'jumptext': case 'farjumptext': { const x = t(a[0]); if (x) ops.push(['t', x]); ops.push(['end']); break; }
      case 'jumptextfaceplayer': { ops.push(['face']); const x = t(a[0]); if (x) ops.push(['t', x]); ops.push(['end']); break; }
      case 'faceplayer': ops.push(['face']); break;
      case 'yesorno': if (skipYesno) { skipYesno = false; ops.push(['setval', '1']); } else ops.push(['yn']); break;
      // 흐름
      case 'iftrue': ops.push(['jt', L(a[0])]); break;
      case 'iffalse': ops.push(['jf', L(a[0])]); break;
      case 'ifequal': ops.push(['jeq', a[0], L(a[1])]); break;
      case 'ifnotequal': ops.push(['jne', a[0], L(a[1])]); break;
      case 'ifgreater': ops.push(['jgt', a[0], L(a[1])]); break;
      case 'ifless': ops.push(['jlt', a[0], L(a[1])]); break;
      case 'sjump': case 'farsjump': ops.push(['jmp', L(a[0])]); break;
      case 'scall': case 'farscall': ops.push(['call', L(a[0])]); break;
      case 'sdefer': case 'prioritysjump': ops.push(['jmp', L(a[0])]); break;
      case 'end': case 'return': case 'endcallback': case 'endifjustbattled': ops.push(['end']); break;
      case 'endall': ops.push(['endall']); break;
      // 이벤트·깃발
      case 'checkevent': ops.push(['ev', a[0]]); break;
      case 'setevent': ops.push(['set', a[0]]); break;
      case 'clearevent': ops.push(['clr', a[0]]); break;
      case 'checkflag': ops.push(['fl', a[0]]); break;
      case 'setflag': ops.push(['sf', a[0]]); break;
      case 'clearflag': ops.push(['cf', a[0]]); break;
      case 'setscene': ops.push(['scene', env.sceneVal(a[0])]); break;
      case 'setmapscene': ops.push(['mapscene', a[0], env.sceneVal(a[1])]); break;
      case 'checkscene': ops.push(['chkscene']); break;
      // 값
      case 'readvar': ops.push(['var', a[0]]); break;
      case 'setval': ops.push(['setval', a[0]]); break;
      case 'addval': ops.push(['addval', a[0]]); break;
      case 'loadvar': ops.push(['loadvar', a[0], a[1]]); break;
      case 'checktime': ops.push(['time', a[0]]); break;
      case 'random': ops.push(['random', a[0]]); break;
      case 'checkver': ops.push(['setval', '0']); break;
      // 도구·포켓몬·돈
      case 'checkitem': ops.push(['item', a[0]]); break;
      case 'giveitem': ops.push(['give', a[0], +(a[1] || 1), 0]); break;
      case 'verbosegiveitem': ops.push(['give', a[0], +(a[1] || 1), 1]); break;
      case 'takeitem': ops.push(['take', a[0], +(a[1] || 1)]); break;
      case 'givepoke': ops.push(['mon', sp(a[0]), +a[1], a[2] && a[2] !== 'NO_ITEM' ? a[2] : null]); break;
      case 'giveegg': ops.push(['egg', sp(a[0]), +a[1]]); break;
      case 'checkpoke': ops.push(['chkmon', sp(a[0])]); break;
      case 'checkmoney': ops.push(['money', 'chk', +a[1]]); break;
      case 'givemoney': ops.push(['money', 'give', +a[1]]); break;
      case 'takemoney': ops.push(['money', 'take', +a[1]]); break;
      case 'checkcoins': ops.push(['coins', 'chk', +a[0]]); break;
      case 'givecoins': ops.push(['coins', 'give', +a[0]]); break;
      case 'takecoins': ops.push(['coins', 'take', +a[0]]); break;
      case 'getstring': ops.push(['buf', 'str', L(a[1])]); break;
      case 'getitemname': ops.push(['buf', 'item', a[1]]); break;
      case 'getmonname': ops.push(['buf', 'mon', a[1]]); break;
      // 사람·움직임
      case 'disappear': ops.push(['hide', target(a[0])]); break;
      case 'appear': ops.push(['show', target(a[0])]); break;
      case 'moveobject': ops.push(['mvobj', target(a[0]), +a[1], +a[2]]); break;
      case 'turnobject': ops.push(['turn', target(a[0]), dirOf(a[1])]); break;
      case 'applymovement': ops.push(['move', target(a[0]), L(a[1])]); break;
      case 'applymovementlasttalked': ops.push(['move', 'last', L(a[0])]); break;
      case 'showemote': ops.push(['emote', target(a[1])]); break;
      case 'follow': ops.push(['follow', target(a[0]), target(a[1])]); break;
      case 'stopfollow': ops.push(['stopfollow']); break;
      case 'setlasttalked': ops.push(['last', target(a[0])]); break;
      case 'pokepic': ops.push(['pic', sp(a[0])]); break;
      case 'closepokepic': ops.push(['closepic']); break;
      case 'pause': ops.push(['pause', +a[0] || 15]); break;
      case 'playsound': ops.push(['sfx', a[0]]); break;
      case 'earthquake': ops.push(['shake']); break;
      // 배틀
      case 'winlosstext': ops.push(['wl', t(a[0]), a[1] && a[1] !== '0' ? t(a[1]) : null]); break;
      case 'loadtrainer': ops.push(['trainer', `${a[0]}:${a[1]}`]); break;
      case 'loadwildmon': ops.push(['wild', sp(a[0]), +a[1]]); break;
      case 'startbattle': ops.push(['battle']); break;
      case 'reloadmapafterbattle': ops.push(['afterbattle']); break;
      case 'catchtutorial': ops.push(['catchtut']); break;
      // 그 밖
      case 'pokemart': ops.push(['mart', a[1]]); break;
      case 'jumpstd': ops.push(['std', a[0].replace(/Script$/, '')]); ops.push(['end']); break;
      case 'callstd': ops.push(['std', a[0].replace(/Script$/, '')]); break;
      case 'special': if (/DSTFlag$/.test(a[0])) skipYesno = true; else ops.push(['special', a[0]]); break;
      case 'warp': case 'warpfacing': { const b = c === 'warpfacing' ? a.slice(1) : a; ops.push(['warp', b[0], +b[1], +b[2]]); break; }
      case 'trade': ops.push(['trade', a[0]]); break;
      default: break; // opentext, closetext, waitbutton, playmusic, cry … 는 화면 연출이라 건너뜀
    }
  }
  // 라벨 → 위치
  const pcOf = (name) => (name && at[name] !== undefined ? at[name] : -1);
  const objIdx = (x) => { if (typeof x !== 'string' || x === 'last') return x; const i = objConsts.indexOf(x); return i >= 0 ? i : 'last'; };
  const val = (x) => { const n = env.num(x); return Number.isNaN(n) ? 0 : n; };
  for (const op of ops) {
    if (['jeq', 'jne', 'jgt', 'jlt', 'setval', 'addval', 'random'].includes(op[0])) op[1] = val(op[1]);
    if (op[0] === 'loadvar') op[2] = val(op[2]);
    if (['hide', 'show', 'mvobj', 'turn', 'move', 'emote', 'last', 'follow'].includes(op[0])) op[1] = objIdx(op[1]);
    if (op[0] === 'follow') op[2] = objIdx(op[2]);
    if (['jt', 'jf', 'jmp', 'call'].includes(op[0])) op[1] = pcOf(op[1]);
    else if (['jeq', 'jne', 'jgt', 'jlt'].includes(op[0])) op[2] = pcOf(op[2]);
    else if (op[0] === 'move') { const lab = op[2]; if (!moves[lab] && labelLines.has(lab)) moves[lab] = parseMovement(labelLines.get(lab)); if (!moves[lab]) op[0] = 'nop'; }
    else if (op[0] === 'buf' && op[1] === 'str') op[2] = strings[op[2]] || '';
  }
  return { ops, at, moves, objConsts, scenes: scenes.map((l) => pcOf(l)), callbacks: callbacks.map((cb) => ({ type: cb.type, pc: pcOf(cb.label) })).filter((cb) => cb.pc >= 0), coords: coords.map((c) => ({ x: c.x, y: c.y, scene: c.scene, pc: pcOf(c.label) })).filter((c) => c.pc >= 0) };
}

module.exports = { compile, parseMovement };
