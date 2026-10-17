'use strict';
// 한국어 표기: 포켓몬·기술·도구 이름(ko-names.json), 지명, 트레이너 직업, 조사 붙이기
const KO = require('./data/ko-names.json');

/** 받침 있는지 (마지막 한글 기준, 영문·숫자는 대충) */
function hasBatchim(word) {
  const s = String(word || '').replace(/[^가-힣A-Za-z0-9]+$/u, '');
  const ch = s[s.length - 1];
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(ch)) return '013678'.includes(ch);
  return /[LMNR]$/i.test(ch);
}
function rieul(word) {
  const s = String(word || ''); const code = s.charCodeAt(s.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 8;
}
/** josa('피카츄', '이/가') → '피카츄가' */
function josa(word, pair) {
  if (!pair.includes('/')) return word + pair;
  const [a, b] = pair.split('/');
  if (pair === '으로/로') return word + (hasBatchim(word) && !rieul(word) ? '으로' : '로');
  return word + (hasBatchim(word) ? a : b);
}

/** 숫자 뒤 (으)로: 3·6·0 으로, 나머지 로 */
function roNum(n) { return n + ('360'.includes(String(n).slice(-1)) ? '으로' : '로'); }

const TYPES = {
  NORMAL: '노말', FIGHTING: '격투', FLYING: '비행', POISON: '독', GROUND: '땅', ROCK: '바위', BIRD: '새', BUG: '벌레', GHOST: '고스트',
  STEEL: '강철', CURSE_TYPE: '???', FIRE: '불꽃', WATER: '물', GRASS: '풀', ELECTRIC: '전기', PSYCHIC_TYPE: '에스퍼', ICE: '얼음', DRAGON: '드래곤', DARK: '악',
};

const LANDMARKS = {
  SPECIAL: '???', NEW_BARK_TOWN: '연두마을', ROUTE_29: '29번도로', CHERRYGROVE_CITY: '무궁시티', ROUTE_30: '30번도로', ROUTE_31: '31번도로', VIOLET_CITY: '도라지시티',
  SPROUT_TOWER: '모다피의탑', ROUTE_32: '32번도로', RUINS_OF_ALPH: '알프의유적', UNION_CAVE: '연결동굴', ROUTE_33: '33번도로', AZALEA_TOWN: '고동마을', SLOWPOKE_WELL: '야돈의우물',
  ILEX_FOREST: '너도밤나무숲', ROUTE_34: '34번도로', GOLDENROD_CITY: '금빛시티', RADIO_TOWER: '라디오탑', ROUTE_35: '35번도로', NATIONAL_PARK: '자연공원', ROUTE_36: '36번도로',
  ROUTE_37: '37번도로', ECRUTEAK_CITY: '인주시티', TIN_TOWER: '방울탑', BURNED_TOWER: '불탄탑', ROUTE_38: '38번도로', ROUTE_39: '39번도로', OLIVINE_CITY: '담청시티',
  LIGHTHOUSE: '등대', ROUTE_40: '40번수로', WHIRL_ISLANDS: '소용돌이섬', ROUTE_41: '41번수로', CIANWOOD_CITY: '진청시티', ROUTE_42: '42번도로', MT_MORTAR: '절구산',
  MAHOGANY_TOWN: '황토마을', ROUTE_43: '43번도로', LAKE_OF_RAGE: '분노의호수', ROUTE_44: '44번도로', ICE_PATH: '얼음샛길', BLACKTHORN_CITY: '검은먹시티', DRAGONS_DEN: '용의굴',
  ROUTE_45: '45번도로', DARK_CAVE: '어둠의동굴', ROUTE_46: '46번도로', SILVER_CAVE: '은빛산', PALLET_TOWN: '태초마을', ROUTE_1: '1번도로', VIRIDIAN_CITY: '상록시티',
  ROUTE_2: '2번도로', PEWTER_CITY: '회색시티', ROUTE_3: '3번도로', MT_MOON: '달맞이산', ROUTE_4: '4번도로', CERULEAN_CITY: '블루시티', ROUTE_24: '24번도로', ROUTE_25: '25번도로',
  ROUTE_5: '5번도로', UNDERGROUND_PATH: '지하통로', ROUTE_6: '6번도로', VERMILION_CITY: '갈색시티', DIGLETTS_CAVE: '디그다의굴', ROUTE_7: '7번도로', ROUTE_8: '8번도로',
  ROUTE_9: '9번도로', ROCK_TUNNEL: '돌산터널', ROUTE_10: '10번도로', POWER_PLANT: '무인발전소', LAVENDER_TOWN: '보라타운', LAV_RADIO_TOWER: '보라라디오탑', CELADON_CITY: '무지개시티',
  SAFFRON_CITY: '노랑시티', ROUTE_11: '11번도로', ROUTE_12: '12번도로', ROUTE_13: '13번도로', ROUTE_14: '14번도로', ROUTE_15: '15번도로', ROUTE_16: '16번도로', ROUTE_17: '17번도로',
  ROUTE_18: '18번도로', FUCHSIA_CITY: '연분홍시티', ROUTE_19: '19번수로', ROUTE_20: '20번수로', SEAFOAM_ISLANDS: '쌍둥이섬', CINNABAR_ISLAND: '홍련섬', ROUTE_21: '21번수로',
  ROUTE_22: '22번도로', VICTORY_ROAD: '챔피언로드', ROUTE_23: '23번도로', INDIGO_PLATEAU: '석영고원', ROUTE_26: '26번도로', ROUTE_27: '27번도로', TOHJO_FALLS: '도호폭포',
  ROUTE_28: '28번도로', FAST_SHIP: '아쿠아호',
};

const CLASSES = {
  FALKNER: '체육관 관장', WHITNEY: '체육관 관장', BUGSY: '체육관 관장', MORTY: '체육관 관장', PRYCE: '체육관 관장', JASMINE: '체육관 관장', CHUCK: '체육관 관장', CLAIR: '체육관 관장',
  RIVAL1: '라이벌', POKEMON_PROF: '포켓몬 박사', WILL: '사천왕', CAL: '포켓몬 트레이너', BRUNO: '사천왕', KAREN: '사천왕', KOGA: '사천왕', CHAMPION: '챔피언',
  BROCK: '체육관 관장', MISTY: '체육관 관장', LT_SURGE: '체육관 관장', SCIENTIST: '과학자', ERIKA: '체육관 관장', YOUNGSTER: '반바지 꼬마', SCHOOLBOY: '학원생',
  BIRD_KEEPER: '새조련사', LASS: '짧은치마', JANINE: '체육관 관장', COOLTRAINERM: '엘리트 트레이너', COOLTRAINERF: '엘리트 트레이너', BEAUTY: '아가씨',
  POKEMANIAC: '포켓몬 마니아', GRUNTM: '로켓단 조무래기', GENTLEMAN: '신사', SKIER: '스키어', TEACHER: '선생님', SABRINA: '체육관 관장', BUG_CATCHER: '곤충채집 소년',
  FISHER: '낚시꾼', SWIMMERM: '수영팬티 소년', SWIMMERF: '비키니 아가씨', SAILOR: '뱃사람', SUPER_NERD: '괴짜', RIVAL2: '라이벌', GUITARIST: '기타리스트', HIKER: '등산가',
  BIKER: '폭주족', BLAINE: '체육관 관장', BURGLAR: '도둑', FIREBREATHER: '불놀이꾼', JUGGLER: '저글러', BLACKBELT_T: '태권왕', EXECUTIVEM: '로켓단 간부', PSYCHIC_T: '초능력자',
  PICNICKER: '캠핑걸', CAMPER: '캠핑보이', EXECUTIVEF: '로켓단 간부', SAGE: '중', MEDIUM: '무녀', BOARDER: '보더', POKEFANM: '포켓몬 애호가', KIMONO_GIRL: '기모노 아가씨',
  TWINS: '쌍둥이', POKEFANF: '포켓몬 애호가', RED: '포켓몬 트레이너', BLUE: '체육관 관장', OFFICER: '경찰관', GRUNTF: '로켓단 조무래기',
};

const LEADERS = {
  FALKNER: '비상', WHITNEY: '꼭두', BUGSY: '호일', MORTY: '유빈', PRYCE: '류옹', JASMINE: '규리', CHUCK: '사도', CLAIR: '이향', WILL: '일목', BRUNO: '시바',
  KAREN: '카렌', KOGA: '독수', LANCE: '목호', BROCK: '웅', MISTY: '이슬', LT_SURGE: '마티스', ERIKA: '민화', JANINE: '도희', SABRINA: '초련', BLAINE: '강연',
  BLUE: '그린', RED: '레드', ELM: '공박사', OAK: '오박사', RIVAL: '라이벌',
};

const BADGES = {
  ZEPHYRBADGE: '윙배지', HIVEBADGE: '인섹트배지', PLAINBADGE: '레귤러배지', FOGBADGE: '팬텀배지', STORMBADGE: '쇼크배지', MINERALBADGE: '스틸배지', GLACIERBADGE: '아이스배지', RISINGBADGE: '라이징배지',
  BOULDERBADGE: '회색배지', CASCADEBADGE: '블루배지', THUNDERBADGE: '오렌지배지', RAINBOWBADGE: '무지개배지', SOULBADGE: '핑크배지', MARSHBADGE: '골드배지', VOLCANOBADGE: '크림슨배지', EARTHBADGE: '그린배지',
};
const BADGE_ORDER = Object.keys(BADGES);

const STATUS = { PSN: '독', TOX: '독', BRN: '화상', PAR: '마비', SLP: '잠듦', FRZ: '얼음' };

function speciesName(id) { return KO.species[id] || `포켓몬${id}`; }
function moveName(c, en) {
  return MOVE_KO_BY_CONST[c] || en || c;
}
const MOVE_KO_BY_CONST = {};
function bindMoves(moves) { for (const m of Object.values(moves)) MOVE_KO_BY_CONST[m.const] = KO.moves[m.id] || m.en; }
function itemName(c, items) {
  const it = items && items[c];
  if (it && it.tm) return `기술머신${String(it.tm).padStart(2, '0')}`;
  if (it && it.hm) return `비전머신${String(it.hm).padStart(2, '0')}`;
  return KO.items[c] || (it ? it.name : c);
}
function trainerTitle(cls) { return CLASSES[cls] || cls; }
function trainerName(cls, name) {
  if (LEADERS[cls]) return LEADERS[cls];
  if (cls === 'CHAMPION') return '목호';
  if (/^RIVAL/.test(cls)) return '라이벌';
  return name ? name.charAt(0) + name.slice(1).toLowerCase() : '';
}

module.exports = { josa, roNum, hasBatchim, TYPES, LANDMARKS, CLASSES, LEADERS, BADGES, BADGE_ORDER, STATUS, speciesName, moveName, bindMoves, itemName, trainerTitle, trainerName, KO };
