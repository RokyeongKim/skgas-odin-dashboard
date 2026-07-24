// scripts/parse_excel.js — Odin_시계열_누적.xlsx → data/timeseries.json & data/prices_native.json
// 실행: node scripts/parse_excel.js
// 필요: npm install -g xlsx (또는 node_modules/xlsx)

'use strict';
const path   = require('path');
const fs     = require('fs');
const XLSX   = require(process.env.XLSX_PATH || 'C:/Users/rice2/AppData/Roaming/npm/node_modules/xlsx');

// ─── 경로 설정 ──────────────────────────────────────────────────────────────
const EXCEL_SRC  = path.resolve(__dirname, '../../Project 9. 오딘 지표분석/Odin_시계열_누적.xlsx');
const OUT_TS     = path.resolve(__dirname, '../data/timeseries.json');
const OUT_NATIVE = path.resolve(__dirname, '../data/prices_native.json');

// ─── KB 정본 환산계수 ────────────────────────────────────────────────────────
const C = {
  LPG_MMBTU:    47.84,   // LPG 1 ton = 47.84 mmbtu
  LPG_BBL:       8.2,    // LPG 1 ton = 8.2 bbl (Brent equiv)
  MB_TO_TON:     5.208,  // MB ¢/gal × 5.208 = $/ton
  NV_COEF:       0.42,   // MB ¢/gal × 0.42 = $/bbl
};

// ─── Odin Notion 백분율 파싱 (Excel은 이미 소수) ────────────────────────────
function pctToDecimal(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;   // Excel 저장값은 이미 소수 (1.011 = 101.1%)
  const s = String(v).replace(/%/, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n / 100;     // Notion 텍스트 "101.1 %" → 1.011
}

// ─── 음수 괄호 표기 파싱 "(206)" → -206 ─────────────────────────────────────
function parseParen(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  const m = s.match(/^\((.+)\)$/);
  if (m) return -parseFloat(m[1].replace(/,/g, ''));
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function r(v, d = 4) {
  if (v === null || v === undefined || isNaN(v)) return null;
  return Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
}

// ─── Excel 파싱 ──────────────────────────────────────────────────────────────
console.log('Reading:', EXCEL_SRC);
const wb   = XLSX.readFile(EXCEL_SRC);
const ws   = wb.Sheets['데이터(long)'];
const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

// 컬럼명 → 키 매핑 (Odin 헤더 기준)
const COL = {
  obs:       '관측일',
  type:      '구분',
  base:      '기준월',
  brent:     'Brent ($/bbl)',
  fei:       'FEI ($/Ton)',
  fei_mm:    'FEI ($/mmbtu)',
  mb:        'MB (cpg)',
  cp:        'CP ($/Ton)',
  mopj:      'MOPJ ($/Ton)',
  cv:        'FEI/Brent CV',
  cv3:       'FEI CV3 (M/M-4)',
  nv:        'MB/Brent NV',
  nv2:       'MB NV2 (M/M-4)',
  cp_brent:  'CP/Brent',
  fei_mopj:  'FEI/MOPJ',
  fei_mopj2: 'FEI/MOPJ (M-1/M)',
  mb_fei:    'MB-FEI',
  fei_cp:    'FEI-CP',
  hh:        'Henry Hub',
  jkm:       'JKM',
  ttf:       'TTF',
  jkm_fei:   'JKM-FEI (MJKM-M2FEI)',
};

// 날짜 직렬화 (Excel date serial → YYYY-MM-DD string)
function toDateStr(v) {
  if (!v) return null;
  if (typeof v === 'string' && /^\d{4}-\d{2}/.test(v)) return v.slice(0, 10);
  if (typeof v === 'number') {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v);
  if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(s)) return s.slice(0, 7).replace('/', '-') + s.slice(7, 10).replace('/', '-');
  return s.slice(0, 10);
}

// ─── 유형별 그룹화: 구분='월' 만 사용, 관측일별 근월 추출 ─────────────────────
const byDate = {};   // obsDate → [rows]
for (const row of rows) {
  const type = String(row[COL.type] || '').trim();
  if (type !== '월') continue;
  const obsDate  = toDateStr(row[COL.obs]);
  const baseDate = toDateStr(row[COL.base]);
  if (!obsDate || !baseDate) continue;
  if (!byDate[obsDate]) byDate[obsDate] = [];
  byDate[obsDate].push({ ...row, _obsDate: obsDate, _baseDate: baseDate });
}

const obsDates = Object.keys(byDate).sort();
console.log(`관측일 ${obsDates.length}개 (${obsDates[0]} ~ ${obsDates[obsDates.length - 1]})`);

// 근월(front-month) 선택: 관측일과 같거나 가장 가까운 미래 기준월
function selectFrontMonth(dateStr, rowArr) {
  const obsYM = dateStr.slice(0, 7);  // "2026-02"
  const futures = rowArr.filter(r => r._baseDate.slice(0, 7) >= obsYM)
                         .sort((a, b) => a._baseDate.localeCompare(b._baseDate));
  return futures.length ? futures[0] : rowArr.sort((a, b) => a._baseDate.localeCompare(b._baseDate))[0];
}

// ─── timeseries 레코드 생성 ───────────────────────────────────────────────────
const records = [];

for (const obsDate of obsDates) {
  const fm = selectFrontMonth(obsDate, byDate[obsDate]);

  const brent = r(fm[COL.brent],  2);
  const fei   = r(fm[COL.fei],    2);
  const mb    = r(fm[COL.mb],     3);
  const cp    = r(fm[COL.cp],     2);
  const mopj  = r(fm[COL.mopj],   2);
  const jkm   = r(fm[COL.jkm],    3);
  const ttf   = r(fm[COL.ttf],    3);
  const hh    = r(fm[COL.hh],     3);

  // CV: Excel에 이미 계산되어 있으나 소수점 표현 확인
  // Excel 값은 1.011 (= 101.1% 형태가 아니라 이미 ratio), Notion은 "101.1 %"
  const cvRaw  = fm[COL.cv];
  const cvVal  = (typeof cvRaw === 'number' && cvRaw > 5) ? cvRaw / 100 : (typeof cvRaw === 'number' ? cvRaw : null);

  const nvRaw  = fm[COL.nv];
  const nvVal  = (typeof nvRaw === 'number' && nvRaw > 5) ? nvRaw / 100 : (typeof nvRaw === 'number' ? nvRaw : null);

  const feiMopjRaw = fm[COL.fei_mopj];
  const feiMopjVal = (typeof feiMopjRaw === 'number' && feiMopjRaw > 5) ? feiMopjRaw / 100 : (typeof feiMopjRaw === 'number' ? feiMopjRaw : null);

  records.push({
    date: obsDate,
    baseMonth: fm._baseDate.slice(0, 7),
    native: {
      Brent: brent,
      FEI:   fei,
      MB:    mb,
      CP:    cp,
      MOPJ:  mopj,
      JKM:   jkm,
      TTF:   ttf,
      HH:    hh,
    },
    mmbtu: {
      Brent: brent !== null ? r(brent / C.LPG_BBL,    3) : null,
      FEI:   fei   !== null ? r(fei   / C.LPG_MMBTU,  3) : null,
      MB:    mb    !== null ? r(mb    * C.MB_TO_TON / C.LPG_MMBTU, 3) : null,
      CP:    cp    !== null ? r(cp    / C.LPG_MMBTU,  3) : null,
      MOPJ:  mopj  !== null ? r(mopj  / C.LPG_MMBTU,  3) : null,
      JKM:   jkm,
      TTF:   ttf,
      HH:    hh,
    },
    derived: {
      CV:         r(cvVal,       4),
      NV:         r(nvVal,       4),
      FEI_MOPJ:   r(feiMopjVal,  4),
      JKM_FEI_M2: null,   // data.js에서 43 영업일 lag로 계산
      // 스프레드 (원본값, $/ton)
      MB_FEI:     r(parseParen(fm[COL.mb_fei]),  1),
      FEI_CP:     r(parseParen(fm[COL.fei_cp]),  1),
      // Odin 직접 제공 JKM-FEI(M JKM - M-2 FEI) $/mmbtu
      JKM_FEI_ODIN: r(parseParen(fm[COL.jkm_fei]), 3),
    },
  });
}

console.log(`생성 레코드: ${records.length}개`);
console.log(`첫 레코드:`, JSON.stringify(records[0], null, 2));
console.log(`마지막 레코드:`, JSON.stringify(records[records.length - 1], null, 2));

fs.writeFileSync(OUT_TS, JSON.stringify(records, null, 2), 'utf8');
console.log(`저장 완료: ${OUT_TS}`);

// ─── prices_native.json: 이벤트 플래그 시점별 가격 ───────────────────────────
const EVENT_DATES = {
  war_start:    '2026-02-28',
  ceasefire1:   '2026-04-08',
  mou_news:     '2026-06-12',
  mou_signed:   '2026-06-17',
  mou_end:      '2026-07-08',
  strait_close: '2026-07-11',
  strait_open:  '2026-07-15',
  iran_escalate:'2026-07-18',
};

function findNearest(targetDate, recList) {
  return recList.reduce((best, rec) => {
    if (!best) return rec;
    return Math.abs(new Date(rec.date) - new Date(targetDate)) <
           Math.abs(new Date(best.date) - new Date(targetDate)) ? rec : best;
  }, null);
}

const pricesNative = { current: { date: records[records.length - 1].date, ...records[records.length - 1].native } };
for (const [evId, evDate] of Object.entries(EVENT_DATES)) {
  const rec = findNearest(evDate, records);
  if (rec) pricesNative[evId] = { date: rec.date, ...rec.native };
}

fs.writeFileSync(OUT_NATIVE, JSON.stringify(pricesNative, null, 2), 'utf8');
console.log(`저장 완료: ${OUT_NATIVE}`);
