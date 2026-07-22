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

export const INDEX_META = {
  MB:    { label: 'MB (Mont Belvieu)', unit: '¢/gal',   color: '#f0a500', group: 'buy',  toMmbtu: v => v * CONVERSION.MB_CPG_TO_MMBTU },
  FEI:   { label: 'FEI (Far East)',    unit: '$/ton',   color: '#00d4ff', group: 'buy',  toMmbtu: v => v / CONVERSION.LPG_TON_TO_MMBTU },
  Brent: { label: 'Brent',            unit: '$/bbl',   color: '#ff6b6b', group: 'sell', toMmbtu: v => v / CONVERSION.LPG_TON_TO_BBL },
  CP:    { label: 'CP (Saudi Aramco)', unit: '$/ton',   color: '#ffa552', group: 'buy',  toMmbtu: v => v / CONVERSION.LPG_TON_TO_MMBTU },
  MOPJ:  { label: 'MOPJ (Naphtha)',   unit: '$/ton',   color: '#c77dff', group: 'sell', toMmbtu: v => v / CONVERSION.LPG_TON_TO_MMBTU },
  JKM:   { label: 'JKM (LNG Asia)',   unit: '$/mmbtu', color: '#4ade80', group: 'sell', toMmbtu: v => v },
  TTF:   { label: 'TTF (Europe Gas)', unit: '$/mmbtu', color: '#a0aec0', group: 'sell', toMmbtu: v => v },
  HH:    { label: 'HH (Henry Hub)',   unit: '$/mmbtu', color: '#e2e8f0', group: 'sell', toMmbtu: v => v },
};

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

export const RELATIVE_PAIRS = [
  { id: 'CV',            label: 'CV = FEI/Brent',        target: CONVERSION.CV_SOURCING_TARGET, group: 'buy' },
  { id: 'NV',            label: 'NV = MB/Brent',          target: 0.88,                          group: 'buy' },
  { id: 'FEI_MOPJ',      label: 'FEI/MOPJ',              target: CONVERSION.FEIS_MOPJ_RATIO,    group: 'buy' },
  { id: 'JKM_FEI_M2',    label: 'JKM vs FEI(M-2)',       target: null,                          group: 'sell' },
];
