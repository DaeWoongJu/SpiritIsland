'use strict';
/* 정령섬 온라인 — 정령 판(보드) 보기: 앞면(규칙·성장·존재 트랙·내재 권능) / 뒷면(소개·플레이 방법·성향·고유 권능), 뒤집기 가능 */

const SpiritBoard = (() => {
  let list = [];
  let idx = 0;
  let flipped = false;

  const growthIcon = (label) => {
    if (label.startsWith('카드 모두 회수')) return '<span class="gi reclaim">↺</span>';
    if (label.startsWith('권능 카드')) return `<span class="gi">${pcIcon('card', 22, '#9ed3ff')}</span>`;
    if (label.startsWith('에너지')) return `<span class="gi">${pcIcon('energy', 22, '#f3d98b')}<b>${label.replace(/[^0-9+]/g, '')}</b></span>`;
    if (label.startsWith('존재')) return `<span class="gi"><span class="g-orb"></span><b>${(label.match(/사거리 (\d+)/) || [])[1] ?? ''}</b></span>`;
    return '<span class="gi">•</span>';
  };

  /** 고유 권능·내재 권능 문장에서 권능 성향을 대략 계산 (0~5) */
  function ratings(sp) {
    const texts = [...sp.uniques.map((u) => app.catalog.powers[u].text), ...sp.innates.flatMap((i) => i.levels.map((l) => l.text)), sp.special.text].join(' ');
    const count = (re) => (texts.match(re) || []).length;
    const raw = {
      공격: count(/피해|파괴/g),
      통제: count(/밀어|모으|건너뜁|건설하지|약탈하지|탐험하지/g),
      공포: count(/공포/g),
      방어: count(/방어|황폐 1개를 제거|치유|받지 않/g),
      지원: count(/에너지|원소|권능 카드|권능 1장|존재 1개를 추가|대상 정령/g),
    };
    const out = {};
    for (const [k, v] of Object.entries(raw)) out[k] = Math.max(1, Math.min(5, Math.round(v / 1.6)));
    return out;
  }

  function front(sp) {
    const track = (label, icon, values) => `<div class="b-track"><div class="b-track-l">${icon} ${label}</div><div class="b-slots">${values.map((v, i) => `<span class="b-slot ${i === 0 ? 'first' : ''}" title="${i === 0 ? '시작 값' : `존재 ${i}개를 꺼내면`}">${v}</span>`).join('<i>›</i>')}</div></div>`;
    return `
      <div class="b-art">${SpiritArt.html(sp.id, 'b-art-img')}<div class="b-title"><h2>${esc(sp.name)}</h2><div class="b-en">${esc(sp.en)}</div></div><span class="b-side">앞면</span></div>
      <div class="b-grid">
        <section class="b-box b-special"><h4>특수 규칙</h4><b>${esc(sp.special.name)}</b><p>${esc(sp.special.text)}</p></section>
        <section class="b-box b-tracks"><h4>존재 트랙 <span class="hint">— 왼쪽부터 존재를 꺼낼수록 값이 커집니다</span></h4>
          ${track('턴당 에너지', pcIcon('energy', 16, '#f3d98b'), sp.energyTrack)}
          ${track('낼 수 있는 카드 수', pcIcon('card', 16, '#9ed3ff'), sp.cardTrack)}</section>
        <section class="b-box b-growth"><h4>성장 <span class="hint">— 매 턴 하나를 고릅니다</span></h4>
          <div class="b-gopts">${sp.growth.map((g, i) => `<div class="b-gopt"><div class="b-gnum">${i + 1}</div><div class="b-gicons">${g.map(growthIcon).join('')}</div><div class="b-gtext">${g.map(esc).join(' + ')}</div></div>`).join('')}</div></section>
        <section class="b-box b-innates"><h4>내재 권능 <span class="hint">— 이번 턴에 낸 카드의 원소가 모이면 자동으로 강해집니다</span></h4>
          ${sp.innates.map((inn) => `<div class="b-innate ${inn.speed}"><div class="b-inn-h"><b>${esc(inn.name)}</b><span class="c-speed ${inn.speed}">${inn.speed === 'fast' ? '빠름' : '느림'}</span><span class="hint">${esc(targetText(inn.target))}</span></div>
            ${inn.levels.map((l) => `<div class="b-lv"><span class="b-lv-els">${Object.entries(l.el).map(([e, n]) => elRep(e, n, 15)).join('')}</span><span>${esc(l.text)}</span></div>`).join('')}</div>`).join('')}</section>
      </div>`;
  }

  function back(sp) {
    const r = ratings(sp);
    const exp = app.catalog.expansions.find((e) => e.id === sp.exp);
    const cx = { 낮음: 1, 보통: 2, 높음: 3 }[sp.complexity];
    return `
      <div class="b-art back">${SpiritArt.html(sp.id, 'b-art-img')}<div class="b-title"><h2>${esc(sp.name)}</h2><div class="b-en">${esc(exp ? exp.name : '')}</div></div><span class="b-side">뒷면</span></div>
      <div class="b-grid back">
        <section class="b-box b-lore"><h4>정령 소개</h4><p class="lore">${esc(sp.summary)}</p>
          <h4>이렇게 플레이하세요</h4><p>💡 ${esc(sp.tip || '')}</p>
          <h4>시작 배치</h4><p>${esc(sp.setupText)}</p></section>
        <section class="b-box b-stats"><h4>난이도</h4>
          <div class="b-cx">${[1, 2, 3].map((i) => `<i class="${i <= cx ? 'on' : ''}"></i>`).join('')}<span>${esc(sp.complexity)}</span>${sp.complexity === '낮음' ? '<span class="badge rec">초보 추천</span>' : ''}</div>
          <h4>권능 성향</h4>
          ${Object.entries(r).map(([k, v]) => `<div class="b-bar"><span>${k}</span><div class="b-bar-t"><div style="width:${v * 20}%"></div></div><b>${v}</b></div>`).join('')}
          <p class="hint">고유 권능과 내재 권능의 효과로 계산한 대략적인 성향입니다.</p></section>
        <section class="b-box b-cards"><h4>고유 권능 카드</h4><div class="b-cardrow">${sp.uniques.map((u) => cardHTML(u, {})).join('')}</div></section>
      </div>`;
  }

  function render() {
    const sp = list[idx];
    const room = app.room;
    let actions = '';
    if (room && !room.started) {
      const owner = room.players.find((p) => p.spiritIds.includes(sp.id));
      const me = room.players.find((p) => p.id === app.personId) || { spiritIds: [] };
      const total = room.players.reduce((a, p) => a + p.spiritIds.length, 0);
      if (owner && owner.id === app.personId) actions = '<button class="small" data-act="remove">선택 해제</button><span class="b-chosen">✓ 내가 고른 정령</span>';
      else if (owner) actions = `<span class="hint">${esc(owner.name)} 님이 고른 정령입니다</span>`;
      else {
        actions = '<button class="primary" data-act="pick">이 정령 선택</button>';
        if (me.spiritIds.length && total < room.maxSpirits) actions += '<button data-act="add">＋ 추가로 조종</button>';
      }
    }
    $('#board .board-modal').innerHTML = `
      <div class="b-top">
        <button class="small" data-act="prev" ${list.length < 2 ? 'disabled' : ''}>◀</button>
        <span class="b-count">${idx + 1} / ${list.length}</span>
        <button class="small" data-act="next" ${list.length < 2 ? 'disabled' : ''}>▶</button>
        <button class="small b-flipbtn" data-act="flip">↻ ${flipped ? '앞면 보기' : '뒷면 보기'}</button>
        <span style="flex:1"></span>
        ${actions}
        <button class="small" data-act="close">닫기 ✕</button>
      </div>
      <div class="board-scene"><div class="board-flip ${flipped ? 'flipped' : ''}">
        <div class="board-face front" style="--sc:${sp.color}">${front(sp)}</div>
        <div class="board-face back" style="--sc:${sp.color}">${back(sp)}</div>
      </div></div>`;
    for (const b of $('#board').querySelectorAll('[data-act]')) {
      b.onclick = () => {
        const a = b.dataset.act;
        if (a === 'close') close();
        else if (a === 'flip') { flipped = !flipped; $('#board .board-flip').classList.toggle('flipped', flipped); b.textContent = `↻ ${flipped ? '앞면 보기' : '뒷면 보기'}`; Sound.play('select'); }
        else if (a === 'prev') { idx = (idx - 1 + list.length) % list.length; render(); }
        else if (a === 'next') { idx = (idx + 1) % list.length; render(); }
        else if (a === 'pick') { send({ t: 'pickSpirit', spiritId: sp.id, mode: 'replace' }); Sound.play('presence'); }
        else if (a === 'add') { send({ t: 'pickSpirit', spiritId: sp.id, mode: 'add' }); Sound.play('presence'); }
        else if (a === 'remove') send({ t: 'pickSpirit', spiritId: sp.id, mode: 'remove' });
      };
    }
    attachCardTips($('#board'));
  }

  function open(spiritId, ids) {
    const all = app.catalog.spirits;
    list = (ids && ids.length ? ids : all.map((s) => s.id)).map((id) => all.find((s) => s.id === id)).filter(Boolean);
    idx = Math.max(0, list.findIndex((s) => s.id === spiritId));
    flipped = false;
    $('#board').classList.remove('hidden');
    render();
  }

  function close() { $('#board').classList.add('hidden'); }
  function isOpen() { return !$('#board').classList.contains('hidden'); }
  /** 방 정보가 바뀌면(선택 상태) 다시 그림 */
  function refresh() { if (isOpen()) render(); }

  return { open, close, isOpen, refresh, flip: () => { flipped = !flipped; render(); } };
})();
