// js/config.js — KB 정본 변환계수 + 인덱스 메타 + 이벤트 플래그

export const CONVERSION = {
  LPG_TON_TO_MMBTU:  47.84,
  LPG_TON_TO_BBL:     8.2,
  LNG_TON_TO_MMBTU:  51.876,
  LNG_CARGO_MMBTU:   3500000,
  LNG_CARGO_TON:     73000,
  MB_CPG_TO_TON:      5.208,   // MB ¢/gal × 5.208 = $/ton
  MB_CPG_TO_BBL:     12.38,    // MB ¢/gal ÷ 12.38 = $/bbl
  MB_CPG_TO_MMBTU:    0.1089,  // MB ¢/gal × 5.208 / 47.84
  BRENT_HEDGE_RATIO:  3.75,    // 산업체 판가 = Brent×3.75 + 상수
  FEIS_MOPJ_RATIO:    0.97,    // FEI/MOPJ 소싱 기준
  CV_SOURCING_TARGET: 0.90,    // CV < 90% → 소싱 적정
  CV_UNWIND_PREMIUM:  0.05,    // 소싱가 + 5% → Unwind 트리거
  JKM_SENSITIVITY_KRW: 1500000000, // JKM $1/mmbtu = ₩15억
  NET_SPREAD_SEP26:   3.7,     // '26년 9월 참고 Net Spread $/mmbtu
  NET_SPREAD_OCT26:   3.1,     // '26년 10월 참고 Net Spread $/mmbtu
  KOGAS_JKM_WEIGHT:   0.35,
  KOGAS_HH_WEIGHT:    0.10,
  KOGAS_BRENT_WEIGHT: 0.55,
};

// Panel A ($/mmbtu) 표시 지표. defaultOn=false 는 토글 버튼이 꺼진 상태로 시작.
// 참고 환산(KB 정본 아님): C2 ¢/gal×0.1517, nC4 ¢/gal×0.0971, iC4 ¢/gal×0.1010, F/O380 $/MT÷40.5
export const INDEX_META = {
  // ── LPG 아시아 (FEI/CP) ──
  FEI:    { label: 'FEI C3 (Far East)',   unit: '$/ton',   color: '#00d4ff', group: 'buy',  defaultOn: true,  toMmbtu: v => v / CONVERSION.LPG_TON_TO_MMBTU },
  FEI_C4: { label: 'FEI C4',              unit: '$/ton',   color: '#0ea5e9', group: 'buy',  defaultOn: false, toMmbtu: v => v / CONVERSION.LPG_TON_TO_MMBTU },
  CP:     { label: 'CP C3 (Aramco)',      unit: '$/ton',   color: '#f472b6', group: 'buy',  defaultOn: true,  toMmbtu: v => v / CONVERSION.LPG_TON_TO_MMBTU },
  CP_C4:  { label: 'CP C4',               unit: '$/ton',   color: '#be185d', group: 'buy',  defaultOn: false, toMmbtu: v => v / CONVERSION.LPG_TON_TO_MMBTU },
  // ── LPG 미주/유럽 (MB/ARA) ──
  MB:           { label: 'MB TET C3',       unit: '¢/gal', color: '#f0a500', group: 'buy', defaultOn: true,  toMmbtu: v => v * CONVERSION.MB_CPG_TO_MMBTU },
  MB_nonTET_C3: { label: 'MB non-TET C3',   unit: '¢/gal', color: '#b45309', group: 'buy', defaultOn: false, toMmbtu: v => v * CONVERSION.MB_CPG_TO_MMBTU },
  MB_nC4:       { label: 'MB TET nC4',      unit: '¢/gal', color: '#fbbf24', group: 'buy', defaultOn: false, toMmbtu: v => v * 0.0971 },
  MB_iC4:       { label: 'MB iC4',          unit: '¢/gal', color: '#fde68a', group: 'buy', defaultOn: false, toMmbtu: v => v * 0.1010 },
  C2:           { label: 'Purity C2 (에탄)', unit: '¢/gal', color: '#a3e635', group: 'buy', defaultOn: false, toMmbtu: v => v * 0.1517 },
  ARA_C3:       { label: 'ARA C3 (NW유럽)',  unit: '$/ton', color: '#2dd4bf', group: 'buy', defaultOn: false, toMmbtu: v => v / CONVERSION.LPG_TON_TO_MMBTU },
  ARA_C4:       { label: 'ARA C4',          unit: '$/ton', color: '#0f766e', group: 'buy', defaultOn: false, toMmbtu: v => v / CONVERSION.LPG_TON_TO_MMBTU },
  // ── LNG ──
  JKM:   { label: 'JKM (LNG Asia)',   unit: '$/mmbtu', color: '#4ade80', group: 'sell', defaultOn: true,  toMmbtu: v => v },
  TTF:   { label: 'TTF (Europe Gas)', unit: '$/mmbtu', color: '#a0aec0', group: 'sell', defaultOn: true,  toMmbtu: v => v },
  HH:    { label: 'HH (Henry Hub)',   unit: '$/mmbtu', color: '#e2e8f0', group: 'sell', defaultOn: true,  toMmbtu: v => v },
  // ── 유가 / 석유제품 ──
  Brent: { label: 'Brent',               unit: '$/bbl', color: '#ff6b6b', group: 'sell', defaultOn: true,  toMmbtu: v => v / CONVERSION.LPG_TON_TO_BBL },
  WTI:   { label: 'WTI',                 unit: '$/bbl', color: '#fb923c', group: 'sell', defaultOn: false, toMmbtu: v => v / CONVERSION.LPG_TON_TO_BBL },
  MOPJ:  { label: 'MOPJ (Naphtha)',      unit: '$/ton', color: '#c77dff', group: 'sell', defaultOn: true,  toMmbtu: v => v / CONVERSION.LPG_TON_TO_MMBTU },
  FO380: { label: 'MOPS F/O 380cst',     unit: '$/ton', color: '#9ca3af', group: 'sell', defaultOn: false, toMmbtu: v => v / 40.5 },
};

// Panel A-2 (Native 단위 Range·이상치) 대상 지표 — 운임 포함, 에너지 환산 불필요
export const NATIVE_META = {
  Brent:        { label: 'Brent',               unit: '$/bbl',   group: '유가',  color: '#ff6b6b', digits: 2 },
  WTI:          { label: 'WTI',                 unit: '$/bbl',   group: '유가',  color: '#fb923c', digits: 2 },
  MOPJ:         { label: 'MOPJ (납사)',          unit: '$/ton',   group: '유가',  color: '#c77dff', digits: 1 },
  FO380:        { label: 'MOPS F/O 380cst',     unit: '$/ton',   group: '유가',  color: '#9ca3af', digits: 1 },
  CP:           { label: 'CP C3',               unit: '$/ton',   group: 'LPG 아시아', color: '#f472b6', digits: 0 },
  CP_C4:        { label: 'CP C4',               unit: '$/ton',   group: 'LPG 아시아', color: '#be185d', digits: 0 },
  FEI:          { label: 'FEI C3',              unit: '$/ton',   group: 'LPG 아시아', color: '#00d4ff', digits: 1 },
  FEI_C4:       { label: 'FEI C4',              unit: '$/ton',   group: 'LPG 아시아', color: '#0ea5e9', digits: 1 },
  MB:           { label: 'MB TET C3',           unit: '¢/gal',   group: 'LPG 미주', color: '#f0a500', digits: 2 },
  MB_nC4:       { label: 'MB TET nC4',          unit: '¢/gal',   group: 'LPG 미주', color: '#fbbf24', digits: 2 },
  MB_iC4:       { label: 'MB TET iC4',          unit: '¢/gal',   group: 'LPG 미주', color: '#fde68a', digits: 2 },
  MB_nonTET_C3: { label: 'MB non-TET C3',       unit: '¢/gal',   group: 'LPG 미주', color: '#b45309', digits: 2 },
  MB_nonTET_nC4:{ label: 'MB non-TET nC4',      unit: '¢/gal',   group: 'LPG 미주', color: '#d97706', digits: 2 },
  MB_nonTET_iC4:{ label: 'MB non-TET iC4',      unit: '¢/gal',   group: 'LPG 미주', color: '#f59e0b', digits: 2 },
  C2:           { label: 'Purity C2 (에탄)',     unit: '¢/gal',   group: 'LPG 미주', color: '#a3e635', digits: 2 },
  ARA_C3:       { label: 'ARA C3',              unit: '$/ton',   group: 'LPG 유럽', color: '#2dd4bf', digits: 1 },
  ARA_C4:       { label: 'ARA C4',              unit: '$/ton',   group: 'LPG 유럽', color: '#0f766e', digits: 1 },
  JKM:          { label: 'JKM (LNG)',           unit: '$/mmbtu', group: 'LNG',   color: '#4ade80', digits: 3 },
  FRT_BALTIC:   { label: 'Freight Baltic (VLGC)', unit: '$/ton', group: '운임',  color: '#60a5fa', digits: 1 },
  FRT_RIM:      { label: 'Freight RIM',         unit: '$/ton',   group: '운임',  color: '#93c5fd', digits: 1 },
};

// Panel A-2 통계 기준구간 (lastN = 최근 N 영업일, filter = 날짜 조건)
export const BASELINES = [
  { id: 'all',     label: '전체기간 (2023-01~)',             filter: (r) => true },
  { id: 'prewar',  label: '개전 전 (2023-01 ~ 2026-02-27)',  filter: (r) => r.date < '2026-02-28' },
  { id: 'war',     label: '개전 후 (2026-03-02~)',           filter: (r) => r.date >= '2026-03-02' },
  { id: 'y2026',   label: '2026년',                          filter: (r) => r.date.startsWith('2026') },
  { id: 'y2025',   label: '2025년',                          filter: (r) => r.date.startsWith('2025') },
  { id: 'y2024',   label: '2024년',                          filter: (r) => r.date.startsWith('2024') },
  { id: 'y2023',   label: '2023년',                          filter: (r) => r.date.startsWith('2023') },
  { id: 'last60',  label: '최근 60 영업일',                   lastN: 60 },
  { id: 'last120', label: '최근 120 영업일',                  lastN: 120 },
  { id: 'last250', label: '최근 250 영업일 (≈1년)',           lastN: 250 },
];

export const EVENTS = [
  { id: 'war_start',     date: '2026-02-28', label: '개전 (미·이스라엘 공습)',        color: '#ff4444', type: 'war' },
  { id: 'ceasefire1',    date: '2026-04-08', label: '1차 휴전 (2주, 파키스탄 중재)',  color: '#44ff88', type: 'ceasefire' },
  { id: 'mou_news',      date: '2026-06-12', label: 'MOU 뉴스화 (Pakistan 발표)',    color: '#ffdd44', type: 'mou' },
  { id: 'mou_signed',    date: '2026-06-17', label: 'MOU 서명 (Versailles/Tehran)', color: '#ffdd44', type: 'mou' },
  { id: 'mou_end',       date: '2026-07-08', label: 'Trump "MOU 종료" 시사',         color: '#ff8844', type: 'escalation' },
  { id: 'strait_close',  date: '2026-07-11', label: '호르무즈 해협 봉쇄 (IRGC)',     color: '#ff4444', type: 'war' },
  { id: 'strait_open',   date: '2026-07-15', label: '봉쇄 복원',                    color: '#44ff88', type: 'ceasefire' },
  { id: 'iran_escalate', date: '2026-07-18', label: '이란 MOU 이행 중단 선언 (전면전 재격화)', color: '#ff0000', type: 'war' },
];

export const PERIOD_FILTERS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '3Y', days: 1095 },
];

export const SPREAD_PAIRS = [
  { id: 'JKM_FEI',   labelA: 'JKM',   labelB: 'FEI',   label: 'JKM − FEI(M-2)' },
  { id: 'FEI_Brent', labelA: 'FEI',   labelB: 'Brent', label: 'FEI − Brent(LPG equiv)' },
  { id: 'JKM_TTF',   labelA: 'JKM',   labelB: 'TTF',   label: 'JKM − TTF' },
  { id: 'JKM_HH',    labelA: 'JKM',   labelB: 'HH',    label: 'JKM − HH' },
];

// 각 상대가별 소싱/판매 판단 기준선 (사용자 가이드 기반)
// - CV(FEI/Brent): 적정 소싱·판매 range 미확정 → 기준선 없음
// - NV(MB/Brent): 38.5% 이하 = 경쟁력 있는 소싱. '28~ Brent slope 하락 리스크 유의
// - FEI/MOPJ: 85% 소싱 → 90% 판매 = 5% 차익, 90%↑ 시 Tolerance 미공급 옵션 활용
export const RELATIVE_PAIRS = [
  {
    id: 'CV',
    label: 'CV = FEI/Brent',
    color: '#00d4ff',
    group: 'buy',
    thresholds: [],
    note: '적정 소싱·판매 range 미확정 (참고 지표)',
  },
  {
    id: 'NV',
    label: 'NV = MB/Brent',
    color: '#4ade80',
    group: 'buy',
    thresholds: [
      { value: 0.385, label: '경쟁력 조달선 38.5%', color: '#4ade80', style: 'dashed' },
    ],
    note: 'NV ≤ 38.5% → 경쟁력 있는 조달. \'28~ KOGAS Brent slope 14%→12% 하락 시 더 낮은 조달 필요',
  },
  {
    id: 'FEI_MOPJ',
    label: 'FEI/MOPJ',
    color: '#f0a500',
    group: 'buy',
    thresholds: [
      { value: 0.85, label: '소싱 기준 85% (Y+1, Y+2 원월물)', color: '#00d4ff', style: 'dashed' },
      { value: 0.90, label: '판매 기준 90% → 5% 차익', color: '#f85149', style: 'dashed' },
    ],
    note: '85% 소싱 → 90% 판매 = 5% 차익. 90% 훨씬 이상이면 Tolerance 미공급 옵션 활용',
  },
  {
    id: 'JKM_FEI_M2',
    label: 'JKM vs FEI(M-2)',
    color: '#c77dff',
    group: 'sell',
    thresholds: [],
    note: 'LNG 소싱 리드타임 2M 반영',
  },
];
