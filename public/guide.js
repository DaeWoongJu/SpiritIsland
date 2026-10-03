'use strict';
/* 정령섬 온라인 — 게임 방법 안내 (튜토리얼 슬라이드) + 상황별 도움말 */

const TOK_GLYPH = { blight: '#ff6a55', dahan: '#f4dcb6' };
const tok = (k, color) => `<span class="g-tok" style="--c:${color}">${pcIcon(k, 18, TOK_GLYPH[k] || '#1b1a12')}</span>`;
const GUIDE_SLIDES = [
  {
    title: '정령섬은 어떤 게임인가요?',
    body: `
      <div class="g-hero">${'<svg viewBox="0 0 64 64" width="88" height="88"><use href="#logo"/></svg>'}</div>
      <p>여러분은 아름다운 섬에 깃든 <b>정령</b>입니다. 바다 건너 <b>침략자</b>들이 몰려와 섬을 개척하면서 땅을 망가뜨리고 있어요.</p>
      <p>친구와 <b>함께(협력)</b> 신비한 권능을 써서 침략자를 <b>겁주고 몰아내면 승리</b>합니다. 서로 경쟁하지 않아요. 모두 이기거나 모두 집니다.</p>
      <div class="g-box">
        <div>${tok('explorer', '#f1e7cc')} <b>탐험가</b> → ${tok('town', '#dcae62')} <b>마을</b> → ${tok('city', '#c3c6cd')} <b>도시</b> : 침략자는 점점 커집니다.</div>
        <div>${tok('dahan', '#7e5130')} <b>다한</b> : 섬의 원주민. <b>우리 편</b>이에요. 침략자에게 반격합니다.</div>
        <div>${tok('blight', '#2a1014')} <b>황폐</b> : 침략자가 망가뜨린 땅. 너무 많아지면 패배합니다.</div>
      </div>`,
  },
  {
    title: '지도 보는 법',
    body: `
      <p>섬은 여러 <b>지역</b>으로 나뉘고, 지역마다 지형이 있어요:
        ${trIcon('M', 16, '#9aa0a7')} 산 · ${trIcon('J', 16, '#3f9a46')} 정글 · ${trIcon('S', 16, '#e2c681')} 사막 · ${trIcon('W', 16, '#5aaba3')} 습지. 바다와 맞닿은 곳은 <b>해안</b>입니다.</p>
      <div class="g-box">
        <div><span class="g-orb"></span> <b>존재</b> : 여러분 정령이 머무는 곳(빛나는 구슬). 권능은 존재가 있는 곳에서부터 닿는 거리(<b>사거리</b>)만큼 쓸 수 있어요. 사거리 1 = 바로 옆 지역까지.</div>
        <div><span class="g-orb sacred"></span> <b>성지</b> : 한 지역에 존재가 2개 이상이면 성지가 됩니다(금빛 고리). 일부 강한 권능은 성지에서만 쓸 수 있어요.</div>
      </div>
      <p class="g-tip">💡 지역에 마우스를 올리면 그 지역의 자세한 정보가 나옵니다. 3D 지도는 <b>드래그로 회전</b>, <b>휠로 확대</b>, <b>우클릭 드래그로 이동</b>할 수 있어요.</p>`,
  },
  {
    title: '침략자는 어떻게 움직이나요?',
    body: `
      <p>침략자는 매 턴 <b>탐험 → 건설 → 약탈</b> 순서로 한 칸씩 밀려옵니다. 화면 위쪽 상자에 <b>어느 지형</b>에서 일어나는지 미리 보여 줘요.</p>
      <div class="g-steps">
        <div><b>① 탐험</b><br>해안이나 마을 근처의 해당 지형에 ${tok('explorer', '#f1e7cc')} 탐험가가 나타납니다.</div>
        <div><b>② 건설</b><br>침략자가 있는 해당 지형에 ${tok('town', '#dcae62')} 마을(또는 도시)을 짓습니다.</div>
        <div><b>③ 약탈</b><br>해당 지형의 침략자가 땅을 공격합니다. 피해가 2 이상이면 ${tok('blight', '#2a1014')} <b>황폐</b>가 생기고 다한도 다칩니다.</div>
      </div>
      <p class="g-tip">💡 가장 중요한 것: 위쪽 <b>"약탈 (이번 턴)"</b> 상자를 보세요. 그 지형에 있는 침략자를 이번 턴에 없애거나 막아야 섬이 망가지지 않아요!</p>`,
  },
  {
    title: '한 턴의 흐름',
    body: `
      <div class="g-flow">
        <div class="on"><b>1. 성장</b><span>성장 옵션 1개 선택</span></div>
        <div class="on"><b>2. 카드 내기</b><span>에너지로 권능 카드 구매</span></div>
        <div class="fast"><b>3. 빠른 권능</b><span>침략자보다 먼저!</span></div>
        <div class="inv"><b>4. 침략자</b><span>자동 진행</span></div>
        <div class="slow"><b>5. 느린 권능</b><span>침략자 다음</span></div>
      </div>
      <p>모든 플레이어가 <b>동시에</b> 자기 할 일을 합니다. 화면 위쪽 <b>금색 상자</b>에 지금 해야 할 일이 나오고, 버튼을 누르거나 <b>빛나는 지역</b>을 클릭하면 돼요.</p>
      <p>내 할 일이 끝나면 "다른 플레이어를 기다리는 중"이 표시됩니다. 침략자 단계는 자동으로 진행돼요.</p>`,
  },
  {
    title: '1. 성장 — 정령을 키우기',
    body: `
      <p>매 턴 처음에 <b>성장 옵션 하나</b>를 고릅니다. 정령마다 옵션이 달라요. 주요 행동:</p>
      <div class="g-box">
        <div><b>존재 추가</b> : 섬에 존재를 하나 놓습니다. 존재는 <b>오른쪽 패널의 트랙</b>에서 꺼내는데, 꺼낼수록 <b>매 턴 받는 에너지</b>나 <b>낼 수 있는 카드 수</b>가 늘어나요.</div>
        <div><b>카드 모두 회수</b> : 사용해서 버린 카드를 손으로 되돌립니다. 손패가 다 떨어졌을 때 고르세요.</div>
        <div><b>권능 카드 획득</b> : 새 카드 4장 중 1장을 가져옵니다.</div>
        <div><b>에너지 +N</b> : 에너지를 바로 얻습니다.</div>
      </div>
      <p class="g-tip">💡 처음 몇 턴은 <b>존재 추가</b>로 섬에 퍼지고 트랙을 여는 것이 좋아요.</p>`,
  },
  {
    title: '2. 권능 카드 내기',
    body: `
      <p>성장이 끝나면 <b>에너지</b>를 받고, 손패에서 카드를 골라 냅니다.</p>
      <div class="g-card-ex">
        <div class="g-card"><div class="g-ch"><span class="g-cost">1</span>카드 이름<span class="g-sp fast">빠름</span></div><div class="g-els">${elIcon('moon', 16)}${elIcon('fire', 16)}</div><div class="g-tg">존재에서 사거리 1</div><div class="g-tx">효과 설명</div></div>
        <ul>
          <li><b>왼쪽 위 숫자</b> = 필요한 에너지</li>
          <li><b>빠름</b>(주황) = 침략자보다 먼저 발동 / <b>느림</b>(파랑) = 침략자 다음에 발동</li>
          <li><b>원소 아이콘</b> = 이번 턴에 낸 카드의 원소가 모이면 정령의 <b>내재 권능</b>이 자동으로 강해져요</li>
          <li><b>사거리</b> = 내 존재에서 몇 칸 떨어진 곳까지 쓸 수 있는지</li>
        </ul>
      </div>
      <p>한 턴에 낼 수 있는 카드 수와 에너지는 오른쪽 패널에 나와요. 낸 카드는 턴이 끝나면 버림 더미로 가고, 성장의 "카드 모두 회수"로 되찾습니다.</p>`,
  },
  {
    title: '3. 권능 사용 — 침략자 몰아내기',
    body: `
      <p>낸 카드를 하나씩 눌러 사용하고, 대상 지역을 지도에서 클릭합니다.</p>
      <div class="g-box">
        <div><b>피해</b> : 탐험가는 1, 마을은 2, 도시는 3의 피해로 파괴됩니다. (자동으로 가장 효율적으로 나눠요)</div>
        <div><b>공포</b> : 침략자를 겁줍니다. 마을을 파괴하면 공포 1, 도시는 2. 공포가 쌓이면 <b>공포 카드</b>를 얻어요.</div>
        <div><b>방어</b> : 그 지역의 약탈 피해를 줄여 황폐를 막습니다.</div>
        <div><b>밀어내기 / 모으기</b> : 조각을 옆 지역으로 내보내거나 옆 지역에서 데려옵니다. 약탈될 지역에서 침략자를 밀어내면 약탈을 피할 수 있어요!</div>
      </div>
      <p class="g-tip">💡 다 쓴 뒤에는 "권능 단계 종료"를 누르세요.</p>`,
  },
  {
    title: '이기는 법 / 지는 법',
    body: `
      <div class="g-two">
        <div class="win"><h4>🎉 승리</h4>
          <p>공포 카드를 모을수록 <b>공포 단계</b>가 올라가 승리가 쉬워집니다.</p>
          <ul><li>1단계: 섬에 침략자가 <b>하나도</b> 없으면</li><li>2단계: <b>마을·도시</b>가 없으면</li><li>3단계: <b>도시</b>가 없으면</li><li>또는 공포 카드를 모두 얻으면</li></ul></div>
        <div class="lose"><h4>💀 패배</h4>
          <ul><li>황폐 카드의 황폐가 모두 떨어지면 (위쪽 ${pcIcon('blight', 14, '#e8604f')} 숫자)</li><li>정령의 존재가 섬에서 모두 사라지면</li><li>침략자 덱이 다 떨어지면 (시간 초과)</li></ul></div>
      </div>`,
  },
  {
    title: '초보자를 위한 팁',
    body: `
      <ol class="g-tips">
        <li><b>"약탈 (이번 턴)" 지형을 먼저 확인</b>하고, 그곳의 침략자를 <b>빠른 권능</b>으로 처리하거나 밀어내세요.</li>
        <li>처음 2~3턴은 <b>존재 추가</b>로 섬에 퍼지며 에너지와 카드 수를 늘리세요.</li>
        <li><b>마을과 도시 파괴</b>는 공포도 주니 일석이조입니다.</li>
        <li><b>다한</b>이 많은 곳에서 싸우면 다한이 반격해 도와줍니다.</li>
        <li>친구와 <b>채팅</b>으로 "나는 왼쪽 해안 맡을게" 같이 역할을 나누세요.</li>
        <li>처음이라면 <b>대지의 활력</b>, <b>햇살 속에 굽이치는 강</b>, <b>굴하지 않는 바위</b>가 쉬워요.</li>
        <li>방장은 대기실의 <b>게임 설정</b>에서 난이도를 <b>입문</b>으로 낮출 수 있어요. 익숙해지면 <b>적대 세력</b>을 추가해 도전해 보세요.</li>
        <li>혼자서도 <b>＋ 추가로 조종</b>으로 정령 2개를 맡아 연습할 수 있어요.</li>
      </ol>
      <p class="g-tip">💡 게임 중에도 위쪽 <b>📖 게임 방법</b> 버튼으로 이 안내를 다시 볼 수 있고, 금색 상자 아래의 <b>💡 도움말</b>이 지금 할 일을 알려줍니다.</p>`,
  },
];

const Guide = {
  page: 0,
  open(page = 0) {
    this.page = page;
    $('#guide').classList.remove('hidden');
    this.render();
  },
  close() {
    $('#guide').classList.add('hidden');
    try { localStorage.setItem('si-guided', '1'); } catch { /* 무시 */ }
  },
  render() {
    const s = GUIDE_SLIDES[this.page];
    const n = GUIDE_SLIDES.length;
    $('#guide .modal-inner').innerHTML = `
      <div class="g-head"><span class="g-step">${this.page + 1} / ${n}</span><h2>${s.title}</h2><button class="small" id="g-close">닫기 ✕</button></div>
      <div class="g-body">${s.body}</div>
      <div class="g-dots">${GUIDE_SLIDES.map((_, i) => `<i class="${i === this.page ? 'on' : ''}" data-i="${i}"></i>`).join('')}</div>
      <div class="actions">
        <button id="g-prev" ${this.page === 0 ? 'disabled' : ''}>◀ 이전</button>
        ${this.page < n - 1 ? '<button id="g-next" class="primary">다음 ▶</button>' : '<button id="g-done" class="primary">시작하기!</button>'}
      </div>`;
    $('#g-close').onclick = () => this.close();
    $('#g-prev').onclick = () => { this.page--; this.render(); };
    const next = $('#g-next'); if (next) next.onclick = () => { this.page++; this.render(); };
    const done = $('#g-done'); if (done) done.onclick = () => this.close();
    for (const d of document.querySelectorAll('#guide .g-dots i')) d.onclick = () => { this.page = Number(d.dataset.i); this.render(); };
  },
};

/** 현재 선택 상황에 맞는 도움말 */
function promptHint(p, st, you) {
  if (!p) return '';
  const rav = st.invader.ravage ? (st.invader.ravage.coastal ? '해안 지역' : st.invader.ravage.terrains.map((t) => app.catalog.terrains[t]).join('·')) : null;
  const build = st.invader.build ? (st.invader.build.coastal ? '해안 지역' : st.invader.build.terrains.map((t) => app.catalog.terrains[t]).join('·')) : null;
  const danger = rav ? `이번 턴 <b>약탈</b>될 지형: <b class="hl">${rav}</b>${build ? `, <b>건설</b>될 지형: <b>${build}</b>` : ''}.` : (build ? `이번 턴 <b>건설</b>될 지형: <b>${build}</b>.` : '');
  const s = st.spirits[you];
  switch (p.kind) {
    case 'growth': return `성장 옵션을 하나 고르세요. 처음엔 <b>존재 추가</b>가 들어간 옵션으로 섬에 퍼지는 게 좋아요. 손패가 비었다면 <b>카드 모두 회수</b>를 고르세요.`;
    case 'presenceLand': return `존재를 놓을 지역을 고르세요. 침략자가 많은 곳 근처에 두면 권능이 닿기 쉽고, 같은 지역에 2개를 두면 <b>성지</b>가 됩니다. ${danger}`;
    case 'presenceSource': return `<b>에너지 트랙</b>에서 꺼내면 매 턴 받는 에너지가, <b>카드 트랙</b>에서 꺼내면 매 턴 낼 수 있는 카드 수가 늘어나요.`;
    case 'gainKind': return `<b>소형</b>은 싸고 간단한 카드, <b>대형</b>은 강하지만 비싸고 기존 카드 1장을 영원히 잊어야 해요. 처음엔 소형을 추천합니다.`;
    case 'pickCard': return '새 권능 카드 4장 중 1장을 골라 손패에 넣습니다. 내 존재 근처에서 쓰기 좋은 카드를 고르세요.';
    case 'forget': return '대형 권능을 얻는 대가로 카드 1장을 영원히 잊어야 합니다. 가장 덜 쓰는 카드를 고르세요.';
    case 'play': return `에너지 <b>${p.budget}</b> 안에서 최대 <b>${p.max}장</b>을 낼 수 있어요. <b>빠름</b> 카드는 침략자보다 먼저 써서 약탈을 막을 수 있어요. ${danger} 카드를 아끼고 싶다면 "카드 없이 진행"도 괜찮아요.`;
    case 'power': return `낸 카드(또는 조건을 채운 내재 권능)를 하나씩 눌러 사용하세요. 다 썼으면 <b>단계 종료</b>를 누릅니다. ${st.phase === 'fast' ? danger : ''}`;
    case 'target': return `빛나는 지역 중 권능을 쓸 곳을 클릭하세요. ${danger} 그 지형의 침략자를 노리면 섬을 지킬 수 있어요.`;
    case 'targetSpirit': return '이 권능을 받을 정령을 고르세요. 친구를 도와줄 수도 있어요.';
    case 'push': return '밀어내기: 조각을 옆 지역으로 내보냅니다. 침략자는 <b>약탈 예정이 아닌 곳</b>이나 <b>다한이 많은 곳</b>으로 보내면 좋아요.';
    case 'gather': return '모으기: 옆 지역에서 조각을 이 지역으로 데려옵니다. 빛나는 지역이 데려올 수 있는 곳이에요.';
    case 'fear': return '공포 카드 효과입니다! 침략자가 겁을 먹고 물러납니다. 안내에 따라 지역을 고르세요.';
    default:
      if (p.type === 'land') return `지도에서 빛나는 지역을 클릭하세요. ${danger}`;
      return s ? '' : '';
  }
}

function idleHint(st) {
  switch (st.phase) {
    case 'growth': return '모두가 성장과 카드 고르기를 마치면 빠른 권능 단계로 넘어갑니다.';
    case 'fast': return '빠른 권능 단계: 침략자가 움직이기 전에 권능을 씁니다.';
    case 'invader': return '침략자 단계: 공포 카드 → 약탈 → 건설 → 탐험이 자동으로 진행됩니다. 지도의 빨간 테두리가 약탈된 곳이에요.';
    case 'slow': return '느린 권능 단계: 침략자가 움직인 뒤 권능을 씁니다.';
    default: return '';
  }
}
