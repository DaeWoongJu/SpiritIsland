'use strict';
// 게임 저장 / 이어하기 (세 게임 공용)
// 게임 엔진은 같은 시드 + 같은 선택 순서면 항상 같은 결과가 나오므로,
// "시드 + 지금까지의 모든 선택(응답) 기록"만 저장하고 불러올 때 처음부터 빠르게 다시 진행한다.
const fs = require('fs');
const path = require('path');

const SAVE_ROOT = process.env.SAVE_DIR || path.join(__dirname, '..', 'saves');
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_SAVES = 30;

function store(kind) {
  const dir = path.join(SAVE_ROOT, kind);
  const file = (id) => path.join(dir, id + '.json');
  return {
    dir,
    write(data) {
      if (!ID_RE.test(data.id)) return;
      try {
        fs.mkdirSync(dir, { recursive: true });
        const tmp = file(data.id) + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(data));
        fs.renameSync(tmp, file(data.id));
      } catch (e) { console.error('[저장 실패]', e.message); }
    },
    load(id) {
      if (!ID_RE.test(String(id))) return null;
      try { return JSON.parse(fs.readFileSync(file(id), 'utf8')); } catch { return null; }
    },
    remove(id) {
      if (!ID_RE.test(String(id))) return;
      try { fs.unlinkSync(file(id)); } catch { /* 없음 */ }
    },
    /** 저장 목록(최신순). 너무 많으면 오래된 것부터 지움 */
    list() {
      let names = [];
      try { names = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { return []; }
      const out = [];
      for (const f of names) {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
          out.push({ id: d.id, savedAt: d.savedAt, summary: d.summary || {}, names: (d.roster || []).map((p) => p.name) });
        } catch { /* 깨진 파일 무시 */ }
      }
      out.sort((a, b) => b.savedAt - a.savedAt);
      for (const old of out.splice(MAX_SAVES)) this.remove(old.id);
      return out;
    },
  };
}

/** game.answer 를 감싸서 성공한 응답을 game.history 에 기록 */
function record(game, onAnswer) {
  const orig = game.answer.bind(game);
  game.history = [];
  game.answer = (pid, promptId, value) => {
    const copy = value === undefined ? null : JSON.parse(JSON.stringify(value));
    const err = orig(pid, promptId, value);
    if (!err) {
      game.history.push({ p: pid, v: copy });
      if (onAnswer) onAnswer();
    }
    return err;
  };
}

/**
 * 기록된 응답을 순서대로 다시 넣어 저장 시점까지 진행.
 * beforeLast: 마지막 응답 직전에 호출 (원래 진행 속도 설정 복구 등)
 * @returns {Promise<{ok:boolean, at?:number}>}
 */
async function replay(game, history, beforeLast) {
  const tick = () => new Promise((r) => setImmediate(r));
  if (!history.length && beforeLast) beforeLast();
  for (let i = 0; i < history.length; i++) {
    if (i === history.length - 1 && beforeLast) beforeLast();
    const { p, v } = history[i];
    let cur = null;
    for (let k = 0; k < 300 && !game.result; k++) {
      cur = game.currentPrompt(p);
      if (cur) break;
      await tick();
    }
    if (!cur) { if (i < history.length - 1 && beforeLast) beforeLast(); return { ok: false, at: i }; }
    const err = game.answer(p, cur.id, v);
    if (err) { if (i < history.length - 1 && beforeLast) beforeLast(); return { ok: false, at: i }; }
  }
  return { ok: true };
}

function newSaveId(code) {
  return `${Date.now().toString(36)}-${code}`;
}

module.exports = { store, record, replay, newSaveId };
