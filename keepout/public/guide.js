'use strict';
/* 킵 더 히어로즈 아웃 — 게임 방법 (그림 설명) */

const Guide = (() => {
  const pic = (svg, label) => `<div class="g-pic">${svg}<span>${label}</span></div>`;
  const ic = (k) => {
    const map = { A: ['⚔', '#e85858', '공격'], M: ['👢', '#58a8e8', '이동'], P: ['✋', '#e8b830', '방 작동'], S: ['🥚', '#68c858', '소환'], T: ['🪤', '#a8a8b8', '함정'] };
    const [i, c, n] = map[k];
    return `<div class="g-pic"><span class="ic" style="--ic:${c};width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:24px;background:radial-gradient(circle at 35% 30%,#fff8,#0000 60%),${c};border:2px solid #1a1020">${i}</span><span>${n}</span></div>`;
  };
  const SLIDES = [
    { title: '👾 우리는 몬스터!', body: () => `
      <p>용사들이 우리 던전의 <b>보물</b>을 노리고 쳐들어와요. 여러분은 던전에 사는 <b>몬스터 종족</b>이 되어 함께 보물을 지켜요. (1~4인 협력)</p>
      <div class="g-pics">${pic(Art.monster('rats', '#9a8468', 48), '쥐인간')}${pic(Art.monster('slimes', '#5cc84a', 48), '슬라임')}${pic(Art.monster('skeletons', '#e8e2d0', 48), '해골')}${pic(Art.monster('dragon', '#d8542a', 48), '드래곤')}</div>
      <p><b>승리</b>: 용사 웨이브를 모두 막아내고 던전의 용사를 다 쓰러뜨리면 승리!<br><b>패배</b>: <b>대보물 금고</b>의 상자 3개를 모두 빼앗기면 패배.</p>
      <div class="g-pics">${pic(Art.chest(40), '보물 상자')}</div>
      <p class="g-tip">💡 몬스터는 쓰러져도 다시 소환할 수 있어요. 하지만 빼앗긴 보물은 돌아오지 않아요!</p>` },
    { title: '🃏 내 차례: 카드의 아이콘', body: () => `
      <p>손패는 <b>5장</b>. 내 차례에 카드를 <b>원하는 만큼</b> 내고, 카드에 그려진 <b>아이콘</b>마다 행동을 하나씩 해요.</p>
      <div class="g-pics">${ic('A')}${ic('M')}${ic('P')}${ic('S')}${ic('T')}</div>
      <ul>
        <li>⚔ <b>공격</b>: 같은 방에 있는 용사 하나에게 내 몬스터의 공격력만큼 피해.</li>
        <li>👢 <b>이동</b>: 내 몬스터 하나를 옆 방으로 1칸. 방에 아이템이나 뼈가 있으면 하나 들고 갈 수 있어요 (아이템 → 제단, 뼈 → 납골당).</li>
        <li>✋ <b>방 작동</b>: 내 몬스터가 있는 방의 능력을 써요 (아래 슬라이드).</li>
        <li>🥚 <b>소환</b>: 쉬고 있는 몬스터를 <b>둥지</b>나 내 몬스터가 있는 방에 불러와요.</li>
        <li>🪤 <b>함정</b>: 내 몬스터가 있는 방이나 옆 방에 함정. 용사가 들어오면 피해 1.</li>
      </ul>
      <p class="g-tip">💡 아이콘은 순서 상관없이, 내 몬스터 여러 마리에게 나눠 써도 돼요. 차례가 끝나면 손패를 5장까지 채워요.</p>` },
    { title: '🏰 던전의 방', body: () => `
      <div class="g-pics">${['entrance', 'forge', 'lab', 'altar', 'lair', 'crypt', 'trapshop', 'vault'].map((t) => `<div class="g-pic"><div style="width:70px;height:70px;border-radius:10px;background:#6a6478;border:3px solid #2a2438;position:relative">${Art.roomDeco(t).replace('class="deco"', 'style="position:absolute;inset:6px;width:58px;height:58px"')}</div><span>${{ entrance: '입구', forge: '대장간', lab: '연구실', altar: '제단', lair: '둥지', crypt: '납골당', trapshop: '함정 공방', vault: '금고' }[t]}</span></div>`).join('')}</div>
      <ul>
        <li>🚪 <b>입구</b>: 용사가 들어오는 곳. ✋ 함정 설치.</li>
        <li>⚒ <b>대장간·물약 연구실</b>: ✋ 아이템을 만들어요.</li>
        <li>🕯 <b>어둠의 제단</b>: 아이템을 이 방으로 옮겨 ✋ 하면 <b>전리품 카드</b>(강한 카드)를 골라 덱에 넣어요.</li>
        <li>🥚 <b>몬스터 둥지</b>: ✋ 몬스터 소환.</li>
        <li>⚰ <b>납골당</b>: 쓰러진 용사가 남긴 <b>뼈</b>로 몬스터를 되살리거나 체력 회복.</li>
        <li>🪤 <b>함정 공방</b>: ✋ 함정 2개.</li>
        <li>💰 <b>보물 창고·금화 보관실·보석 방</b>: 보물 상자가 하나씩. <b>대보물 금고</b>에는 3개!</li>
      </ul>` },
    { title: '⚔ 용사들이 쳐들어온다!', body: () => `
      <p>각 플레이어의 차례가 끝날 때마다 용사가 <b>입구</b>로 들어와요 (난이도에 따라 1~2명). 그리고 <b>깨어 있는 용사</b>가 모두 행동해요.</p>
      <div class="g-pics">${pic(Art.hero('warrior', '#d84040', 46), '전사')}${pic(Art.hero('archer', '#3aa84a', 46), '궁수')}${pic(Art.hero('rogue', '#8a5ad8', 46), '도적')}${pic(Art.hero('mage', '#3a7ad8', 46), '마법사')}</div>
      <p>용사의 행동: <b>① 같은 방에 몬스터가 있으면 공격 → ② 없으면 보물 상자를 훔침 → ③ 그것도 없으면 보물을 향해 이동.</b></p>
      <ul>
        <li>🗡 <b>전사</b>: 튼튼하고 피해 2. 🏹 <b>궁수</b>: 옆 방 몬스터도 쏴요.</li>
        <li>🗝 <b>도적</b>: 2칸씩 움직이고, 몬스터가 있어도 보물부터 훔쳐요!</li>
        <li>🔮 <b>마법사</b>: 방의 모든 몬스터에게 피해. 소진되지 않고 동료를 깨워요.</li>
        <li>2웨이브에는 <b>정예</b>(기사·암살자·대마법사·레인저)가 나와요.</li>
      </ul>` },
    { title: '💤 소진과 고무', body: () => `
      <div class="g-pics">${pic(Art.hero('warrior', '#d84040', 46, false), '깨어 있음')}${pic(Art.hero('warrior', '#d84040', 46, true), '소진 (Zz)')}</div>
      <p>행동한 용사는 <b>소진</b>되어 누워요. 소진된 용사는 다음 용사 단계에 움직이지 않아요.</p>
      <p>하지만 <b>새 용사가 같은 방에 들어오면</b> 소진된 용사들이 모두 다시 일어나요(고무). 마법사도 같은 방 동료를 깨워요.</p>
      <p class="g-tip">💡 입구에 용사가 쌓이면 새 용사가 올 때마다 모두 깨어나요! 입구 근처 용사부터 처리하세요. 마지막 웨이브가 끝나면 남은 용사는 쉬지 않고 덤벼요.</p>` },
    { title: '🐀 종족마다 다른 능력', body: () => `
      <p>9종족은 몬스터 수·체력·공격력·능력·시작 카드가 모두 달라요.</p>
      <ul style="font-size:.92em">${(window.app && app.catalog ? app.catalog.clans : []).map((c) => `<li>${c.icon} <b>${c.name}</b> (${c.count}마리 · 체력 ${c.hp} · 공격 ${c.atk}) — ${c.ability}</li>`).join('')}</ul>
      <p class="g-tip">💡 처음이라면 <b>해골</b>이나 <b>쥐인간</b>을 추천해요. 난이도는 <b>쉬움</b>부터!</p>` },
  ];
  let idx = 0;
  function render() {
    const s = SLIDES[idx];
    const box = document.querySelector('#guide .modal-inner');
    box.innerHTML = `<h2>${s.title}</h2><div class="g-slide">${s.body()}</div>
      <div class="g-dots">${SLIDES.map((_, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('')}</div>
      <div class="actions"><button class="small" id="g-prev" ${idx ? '' : 'disabled'}>◀ 이전</button><span style="flex:1"></span><button class="small" id="g-close">닫기</button><button class="primary" id="g-next">${idx < SLIDES.length - 1 ? '다음 ▶' : '시작하기!'}</button></div>`;
    document.getElementById('g-prev').onclick = () => { idx--; render(); };
    document.getElementById('g-next').onclick = () => { if (idx < SLIDES.length - 1) { idx++; render(); } else close(); };
    document.getElementById('g-close').onclick = close;
  }
  function open(i = 0) { idx = i; render(); document.getElementById('guide').classList.remove('hidden'); try { localStorage.setItem('keepout-guided', '1'); } catch { /* 무시 */ } }
  function close() { document.getElementById('guide').classList.add('hidden'); }
  function isOpen() { return !document.getElementById('guide').classList.contains('hidden'); }
  return { open, close, isOpen };
})();
window.Guide = Guide;
