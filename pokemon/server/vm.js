'use strict';
// 원작 스크립트 실행기. scripts.js 가 만든 명령 목록을 한 사람 기준으로 돌린다.
// 화면에 보일 것(대사, 움직임, 그림 …)은 out 에 모아 두었다가, 예/아니오나 배틀처럼
// 손님(브라우저)의 대답이 필요할 때 한꺼번에 보낸다.

const DIR_N = { down: 0, up: 1, left: 2, right: 3 };
const STEP = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
const DAILY = /TODAY|DAILY|HAIRCUT|GROOMING|LUCKY_NUMBER|TM27_RETURN|MERCHANT_CLOSED|KURT_MAKING/;
const BADGE_RE = /^ENGINE_(\w+BADGE)$/;
const STRINGS_KO = { '#GEAR': '포켓기어', 'POKéGEAR': '포켓기어', 'MAP CARD': '맵카드', 'RADIO CARD': '라디오카드', 'EXPN CARD': '확장카드', 'PHONE CARD': '전화카드' };
let seq = 1;

/**
 * api: { W, ko, dex, itemKo, bagAdd, bagUse, receiveMon, addSeen, sendTo, save, sendState,
 *        trainerBattle, wildBattle, giveBadge, timeOfDay, STARTERS }
 */
function createVM(api) {
  const { W, ko } = api;
  const today = () => new Date().toDateString();

  function flagOn(d, name) {
    const v = d.flags[name];
    if (DAILY.test(name)) return v === today();
    return !!v;
  }
  function engineFlag(d, name) {
    const b = name.match(BADGE_RE);
    if (b) return d.badges.includes(b[1]);
    if (name === 'ENGINE_POKEDEX') return !!d.flags.ENGINE_POKEDEX || !!d.flags.GOT_STARTER;
    if (name === 'ENGINE_POKEGEAR' || name === 'ENGINE_PHONE_CARD') return true;
    return flagOn(d, name);
  }
  function setFlag(d, name, on) {
    if (on) d.flags[name] = DAILY.test(name) ? today() : true;
    else delete d.flags[name];
  }
  function hideKey(m, idx) { const o = m.objects[idx]; return o && o.flag ? o.flag : `HIDE:${m.id}:${idx}`; }

  function readVar(p, run, name) {
    const d = p.data;
    switch (name) {
      case 'VAR_WEEKDAY': return new Date().getDay();
      case 'VAR_HOUR': return new Date().getHours();
      case 'VAR_PARTYCOUNT': return d.party.length;
      case 'VAR_BOXSPACE': return Math.max(0, 1000 - d.box.length) > 0 ? 20 : 0;
      case 'VAR_BADGES': return d.badges.length;
      case 'VAR_FACING': return DIR_N[d.dir] || 0;
      case 'VAR_XCOORD': return d.x;
      case 'VAR_YCOORD': return d.y;
      case 'VAR_DEXCAUGHT': return d.caught.length;
      case 'VAR_DEXSEEN': return d.seen.length;
      case 'VAR_UNOWNCOUNT': return 0;
      case 'VAR_BATTLETYPE': return run.battleType || 0;
      default: return 0;
    }
  }

  function say(run, pages) { if (pages && pages.length) run.out.push({ text: pages }); }
  const nameOf = (d) => `${d.name}${ko.hasBatchim(d.name) ? '은' : '는'}`;

  function special(p, run, name) {
    const d = p.data;
    switch (name) {
      case 'HealParty': for (const m of d.party) api.dex.healMon(m); run.out.push({ heal: true }); break;
      case 'FindPartyMonThatSpecies': run.v = d.party.some((m) => !m.egg && m.species === run.v) ? 1 : 0; break;
      case 'FindPartyMonThatSpeciesYourTrainerID': run.v = d.party.some((m) => !m.egg && m.species === run.v && (!m.otId || m.otId === p.id)) ? 1 : 0; break;
      case 'CheckFirstMonIsEgg': run.v = d.party[0] && d.party[0].egg ? 1 : 0; break;
      case 'GetFirstPokemonHappiness': run.v = d.party[0] ? d.party[0].happiness || 70 : 0; break;
      case 'PlayersHousePC': run.out.push({ pc: true }); break;
      case 'SnorlaxAwake': run.v = 1; break;
      case 'GiveShuckle': {
        const mon = api.dex.makeMon(213, 15, { item: 'BERRY', ot: 'KIRK', otId: 'kirk' });
        mon.nick = '셔클';
        say(run, api.receiveMon(p, mon).map((l) => [l]));
        run.v = 1;
        break;
      }
      case 'NameRater': case 'BankOfMom': case 'DayCareMan': case 'DayCareLady': case 'MoveDeletion':
      case 'SelectApricornForKurt': case 'CheckMagikarpLength': case 'ReturnShuckie':
        run.out.push({ text: [['(이 기능은 아직 준비 중이에요.)']] }); run.v = 0; break;
      default: break;
    }
  }

  function std(p, run, name) {
    const d = p.data;
    switch (name) {
      case 'ReceiveItem': case 'ReceiveTogepiEgg':
        if (run.buf) say(run, [[`${nameOf(d)} ${ko.josa(run.buf, '을/를')} 받았다!`]]);
        break;
      case 'PokecenterNurse': run.out.push({ nurse: true }); break;
      case 'PCScript': case 'PokecenterPC': run.out.push({ pc: true }); break;
      default: run.out.push({ std: name });
    }
  }

  function give(p, run, item, n, verbose) {
    const d = p.data;
    const it = W.items[item];
    if (it) api.bagAdd(d, item, n);
    else d.flags[`KEY:${item}`] = true;
    run.v = 1;
    if (verbose) {
      const nm = it ? api.itemKo(item) : item;
      say(run, [[`${nameOf(d)} ${ko.josa(nm, '을/를')}${n > 1 ? ` ${n}개` : ''} 받았다!`]]);
      run.out.push({ sfx: 'item' });
    }
  }

  /** 명령을 하나씩 실행. 손님 대답이 필요하면 멈춘다. */
  function step(p, run) {
    const d = p.data;
    const map = W.maps[run.mapId];
    const S = map.script;
    for (let guard = 0; guard < 4000; guard++) {
      if (run.pc < 0 || run.pc >= S.ops.length) return finish(p, run);
      const op = S.ops[run.pc++];
      const tgt = (x) => (x === 'last' ? run.last : x);
      switch (op[0]) {
        case 't': say(run, op[1]); break;
        case 'face': if (run.last != null && run.last >= 0) run.out.push({ face: run.last }); break;
        case 'yn': return wait(p, run, 'yn');
        case 'jt': if (run.v) run.pc = op[1]; break;
        case 'jf': if (!run.v) run.pc = op[1]; break;
        case 'jeq': if (run.v === op[1]) run.pc = op[2]; break;
        case 'jne': if (run.v !== op[1]) run.pc = op[2]; break;
        case 'jgt': if (run.v > op[1]) run.pc = op[2]; break;
        case 'jlt': if (run.v < op[1]) run.pc = op[2]; break;
        case 'jmp': run.pc = op[1]; break;
        case 'call': run.stack.push(run.pc); run.pc = op[1]; break;
        case 'end': if (run.stack.length) run.pc = run.stack.pop(); else return finish(p, run); break;
        case 'endall': return finish(p, run);
        case 'ev': run.v = flagOn(d, op[1]) ? 1 : 0; break;
        case 'set': setFlag(d, op[1], true); break;
        case 'clr': setFlag(d, op[1], false); break;
        case 'fl': run.v = engineFlag(d, op[1]) ? 1 : 0; break;
        case 'sf': {
          const b = op[1].match(BADGE_RE);
          if (b) { const lines = api.giveBadge(p, b[1]); say(run, lines.slice(1).map((l) => [l])); } else setFlag(d, op[1], true); // 배지 받는 대사는 원작에 있음
          break;
        }
        case 'cf': setFlag(d, op[1], false); break;
        case 'scene': (d.scenes ||= {})[run.mapId] = op[1]; break;
        case 'mapscene': (d.scenes ||= {})[op[1]] = op[2]; break;
        case 'chkscene': run.v = (d.scenes || {})[run.mapId] || 0; break;
        case 'var': run.v = readVar(p, run, op[1]); break;
        case 'setval': run.v = op[1]; break;
        case 'addval': run.v = (run.v + op[1]) & 255; break;
        case 'loadvar': if (op[1] === 'VAR_BATTLETYPE') run.battleType = op[2]; break;
        case 'time': run.v = ['MORN', 'DAY', 'NITE'][api.timeOfDay()] === op[1] || (op[1] === 'NITE' && api.timeOfDay() === 2) ? 1 : 0; break;
        case 'random': run.v = Math.floor(Math.random() * (op[1] || 256)); break;
        case 'item': run.v = (d.bag[op[1]] || d.flags[`KEY:${op[1]}`]) ? 1 : 0; break;
        case 'give': give(p, run, op[1], op[2], op[3]); break;
        case 'take': run.v = api.bagUse(d, op[1], op[2]) ? 1 : (d.flags[`KEY:${op[1]}`] ? (delete d.flags[`KEY:${op[1]}`], 1) : 0); break;
        case 'mon': {
          if (!op[1]) { run.v = 0; break; }
          const mon = api.dex.makeMon(op[1], op[2], { item: op[3] || undefined, ot: d.name, otId: p.id });
          say(run, api.receiveMon(p, mon).map((l) => [l]));
          run.out.push({ sfx: 'item' });
          if (run.mapId === 'ELMS_LAB' && api.STARTERS.includes(op[1])) { d.flags.GOT_STARTER = true; d.starter = op[1]; }
          run.v = 1;
          break;
        }
        case 'egg': {
          const mon = api.dex.makeMon(op[1], op[2], { ot: d.name, otId: p.id });
          mon.egg = true; mon.eggSteps = 600;
          if (d.party.length < 6) d.party.push(mon); else d.box.push(mon);
          say(run, [[`${nameOf(d)} 포켓몬의 알을 받았다!`]]);
          run.v = 1;
          break;
        }
        case 'chkmon': run.v = d.party.some((m) => !m.egg && m.species === op[1]) ? 1 : 0; break;
        case 'money': {
          const n = op[2];
          if (op[1] === 'chk') run.v = d.money > n ? 0 : d.money === n ? 1 : 2;
          else if (op[1] === 'give') d.money += n;
          else d.money = Math.max(0, d.money - n);
          break;
        }
        case 'coins': {
          d.coins = d.coins || 0;
          if (op[1] === 'chk') run.v = d.coins > op[2] ? 0 : d.coins === op[2] ? 1 : 2;
          else if (op[1] === 'give') d.coins += op[2];
          else d.coins = Math.max(0, d.coins - op[2]);
          break;
        }
        case 'buf':
          if (op[1] === 'str') run.buf = STRINGS_KO[op[2]] || op[2];
          else if (op[1] === 'item') run.buf = api.itemKo(op[2]);
          else if (op[1] === 'mon') run.buf = ko.speciesName(api.speciesOf(op[2]) || 0) || '';
          break;
        case 'hide': {
          const i = tgt(op[1]);
          if (i == null || i < 0) break;
          setFlag(d, hideKey(map, i), true);
          run.out.push({ hide: i });
          break;
        }
        case 'show': {
          const i = tgt(op[1]);
          if (i == null || i < 0) break;
          setFlag(d, hideKey(map, i), false);
          delete d.flags[`HIDE:${map.id}:${i}`];
          run.out.push({ show: i });
          break;
        }
        case 'mvobj': run.out.push({ mvobj: tgt(op[1]), x: op[2], y: op[3] }); break;
        case 'turn': {
          const i = tgt(op[1]);
          if (i === -1) d.dir = op[2];
          run.out.push({ turn: i, dir: op[2] });
          break;
        }
        case 'move': {
          const i = tgt(op[1]);
          const steps = S.moves[op[2]] || [];
          if (i === -1) for (const s of steps) {
            if (s.k === 'step' || s.k === 'jump') { const [dx, dy] = STEP[s.d] || [0, 0]; const k = s.k === 'jump' ? 2 : 1; d.x += dx * k; d.y += dy * k; d.dir = s.d; }
            else if (s.k === 'turn') d.dir = s.d;
          }
          run.out.push({ move: i, steps });
          break;
        }
        case 'emote': run.out.push({ emote: tgt(op[1]) }); break;
        case 'last': run.last = tgt(op[1]); break;
        case 'pic': run.out.push({ pic: op[1] }); break;
        case 'closepic': run.out.push({ closepic: true }); break;
        case 'pause': run.out.push({ pause: op[1] }); break;
        case 'sfx': break;
        case 'shake': run.out.push({ shake: true }); break;
        case 'wl': run.wl = [op[1], op[2]]; break;
        case 'trainer': run.trainer = op[1]; break;
        case 'wild': run.wild = { species: op[1], level: op[2] }; break;
        case 'battle': return wait(p, run, 'battle');
        case 'afterbattle': if (run.v === 1 && !run.canLose) return finish(p, run); break;
        case 'catchtut': {
          const nm = ko.speciesName(run.wild ? run.wild.species : 19);
          say(run, [[`야생 ${ko.josa(nm, '이/가')} 튀어나왔다!`], ['먼저 포켓몬으로 싸워서', `${ko.josa(nm, '을/를')} 약하게 만든다…`], ['몬스터볼을 던졌다!'], ['…… …… ……'], [`좋았어! ${ko.josa(nm, '을/를')} 잡았다!`]]);
          run.wild = null;
          break;
        }
        case 'mart': run.out.push({ mart: op[1] }); break;
        case 'std': std(p, run, op[1]); break;
        case 'special': special(p, run, op[1]); break;
        case 'warp': {
          if (!W.maps[op[1]]) break;
          d.map = op[1]; d.x = op[2]; d.y = op[3];
          run.out.push({ warp: { map: op[1], x: op[2], y: op[3] } });
          return finish(p, run);
        }
        case 'trade': run.v = 0; say(run, [['(포켓몬 교환은 친구와 해 보세요!)']]); break;
        default: break;
      }
    }
    return finish(p, run);
  }

  function wait(p, run, what) {
    run.waiting = what;
    api.sendTo(p, { t: 'script', id: run.id, out: run.out, wait: what });
    run.out = [];
    api.save(p);
    api.sendState(p);
  }
  function finish(p, run) {
    if (p.script === run) p.script = null;
    api.sendTo(p, { t: 'script', id: run.id, out: run.out, end: true });
    run.out = [];
    api.save(p);
    api.sendState(p);
    if (run.onEnd) run.onEnd();
  }

  /** 배틀 시작 (손님이 앞의 대사를 다 본 뒤) */
  function startBattleFor(p, run) {
    run.canLose = run.battleType === 1;
    const win = run.wl ? run.wl[0] : null;
    if (run.trainer && W.trainers[run.trainer]) {
      api.trainerBattle(p, run.mapId, run.last, { key: run.trainer, beaten: win, script: run, canLose: run.canLose });
    } else if (run.wild && run.wild.species) {
      api.wildBattle(p, 'static', null, { species: run.wild.species, level: run.wild.level, script: run });
    } else { run.v = 0; step(p, run); return; }
    run.trainer = null; run.wild = null; run.wl = null; run.battleType = 0;
    if (!p.battle) { run.v = 0; step(p, run); } // 배틀을 못 열었으면 그냥 이어감
  }

  return {
    /** 스크립트 시작. pc: 시작 위치, last: 말 건 사람 번호 */
    start(p, mapId, pc, opts = {}) {
      const m = W.maps[mapId];
      if (!m || !m.script || pc == null || pc < 0 || p.script || p.battle) return false;
      const run = { id: seq++, mapId, pc, stack: [], v: 0, last: opts.last ?? null, out: [], silent: !!opts.silent, onEnd: opts.onEnd };
      p.script = run;
      step(p, run);
      return true;
    },
    /** 손님의 대답 (예/아니오, 대사 다 봄) */
    answer(p, id, value) {
      const run = p.script;
      if (!run || run.id !== id || !run.waiting) return;
      const what = run.waiting;
      run.waiting = null;
      if (what === 'yn') { run.v = value ? 1 : 0; step(p, run); }
      else if (what === 'battle') startBattleFor(p, run);
    },
    /** 배틀이 끝나면 이어서 */
    afterBattle(p, run, lost) {
      if (p.script !== run) return;
      run.v = lost ? 1 : 0;
      if (lost && !run.canLose) { finish(p, run); return; }
      step(p, run);
    },
    cancel(p) { if (p.script) { const r = p.script; p.script = null; if (r.onEnd) r.onEnd(); } },
    /** 맵 콜백 (사람 보이기/숨기기 등) — 대사 없이 조용히 */
    callbacks(p, mapId) {
      const m = W.maps[mapId];
      if (!m || !m.script || p.script) return [];
      const out = [];
      for (const cb of m.script.callbacks) {
        if (cb.type !== 'OBJECTS' && cb.type !== 'NEWMAP') continue;
        const run = { id: 0, mapId, pc: cb.pc, stack: [], v: 0, last: null, out: [] };
        const S = m.script;
        for (let g = 0; g < 500 && run.pc >= 0 && run.pc < S.ops.length; g++) {
          const op = S.ops[run.pc++];
          if (op[0] === 'end' || op[0] === 'endall') { if (op[0] === 'end' && run.stack.length) { run.pc = run.stack.pop(); continue; } break; }
          if (op[0] === 'yn' || op[0] === 'battle' || op[0] === 'warp') break;
          execQuiet(p, run, op, m);
        }
        out.push(...run.out.filter((x) => x.hide !== undefined || x.show !== undefined));
      }
      return out;
    },
    flagOn, engineFlag,
  };

  /** 콜백용: 깃발·조건·사람 보이기만 */
  function execQuiet(p, run, op, map) {
    const d = p.data;
    switch (op[0]) {
      case 'jt': if (run.v) run.pc = op[1]; break;
      case 'jf': if (!run.v) run.pc = op[1]; break;
      case 'jeq': if (run.v === op[1]) run.pc = op[2]; break;
      case 'jne': if (run.v !== op[1]) run.pc = op[2]; break;
      case 'jgt': if (run.v > op[1]) run.pc = op[2]; break;
      case 'jlt': if (run.v < op[1]) run.pc = op[2]; break;
      case 'jmp': run.pc = op[1]; break;
      case 'call': run.stack.push(run.pc); run.pc = op[1]; break;
      case 'ev': run.v = flagOn(d, op[1]) ? 1 : 0; break;
      case 'fl': run.v = engineFlag(d, op[1]) ? 1 : 0; break;
      case 'set': setFlag(d, op[1], true); break;
      case 'clr': setFlag(d, op[1], false); break;
      case 'sf': if (!BADGE_RE.test(op[1])) setFlag(d, op[1], true); break;
      case 'cf': setFlag(d, op[1], false); break;
      case 'var': run.v = readVar(p, run, op[1]); break;
      case 'setval': run.v = op[1]; break;
      case 'time': run.v = ['MORN', 'DAY', 'NITE'][api.timeOfDay()] === op[1] ? 1 : 0; break;
      case 'item': run.v = d.bag[op[1]] ? 1 : 0; break;
      case 'chkscene': run.v = (d.scenes || {})[run.mapId] || 0; break;
      case 'scene': (d.scenes ||= {})[run.mapId] = op[1]; break;
      case 'random': run.v = Math.floor(Math.random() * (op[1] || 256)); break;
      case 'hide': if (op[1] >= 0) { setFlag(d, hideKey(map, op[1]), true); run.out.push({ hide: op[1] }); } break;
      case 'show': if (op[1] >= 0) { setFlag(d, hideKey(map, op[1]), false); run.out.push({ show: op[1] }); } break;
      default: break;
    }
  }
}

module.exports = { createVM };
