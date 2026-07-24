// scripts/parse_notion.js — Notion Odin 페이지 파싱 → timeseries에 병합
// 실행: node scripts/parse_notion.js
// 입력: Claude tool-result 파일 (MCP Notion fetch 결과)
// 출력: data/timeseries.json 에 1월 데이터 prepend

'use strict';
const fs   = require('fs');
const path = require('path');

const TOOL_RESULT_JAN = process.argv[2] ||
  'C:/Users/rice2/.claude/projects/C--WINDOWS-system32/680c9566-26b1-4af5-8063-1c177733becf/tool-results/mcp-claude_ai_Notion-notion-fetch-1784932722132.txt';

const OUT_TS = path.resolve(__dirname, '../data/timeseries.json');

// ─── KB 정본 환산계수 ────────────────────────────────────────────────────────
const C = {
  LPG_MMBTU: 47.84,
  LPG_BBL:    8.2,
  MB_TO_TON:  5.208,
};

function r(v, d = 4) {
  if (v === null || v === undefined || isNaN(v)) return null;
  return Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
}

// 백분율 파싱: "106.4 %" → 1.064, "0.947" → 0.947
function parsePct(s) {
  if (s === null || s === undefined || s === '') return null;
  const str = String(s).trim();
  if (str.includes('%')) {
    const n = parseFloat(str.replace('%', '').trim());
    return isNaN(n) ? null : n / 100;
  }
  const n = parseFloat(str.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

// 음수 괄호 파싱: "(206)" → -206
function parseParen(s) {
  if (s === null || s === undefined || s === '') return null;
  const str = String(s).trim();
  const m = str.match(/^\((.+)\)$/);
  if (m) return -parseFloat(m[1].replace(/,/g, ''));
  const n = parseFloat(str.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

// Notion enhanced-markdown 테이블 파싱
function parseTable(tableText) {
  const rows = tableText.match(/<tr>([\s\S]*?)<\/tr>/g) || [];
  return rows.map(row => {
    const cells = (row.match(/<td>([\s\S]*?)<\/td>/g) || []).map(td =>
      td.replace(/<\/?td>/g, '').replace(/\*\*/g, '').trim()
    );
    return cells;
  });
}

// 관측일 텍스트 → YYYY-MM-DD
function obsLabelToDate(label, year = 2026) {
  const m = label.match(/(\d+)월\s+(\d+)일/);
  if (!m) return null;
  const mon = String(m[1]).padStart(2, '0');
  const day = String(m[2]).padStart(2, '0');
  return `${year}-${mon}-${day}`;
}

// 기준월 셀 → YYYY-MM
function parseBaseMonth(cell) {
  const s = String(cell).trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
  const m = s.match(/(\d{4})[/-](\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  return null;
}

// Odin Notion 테이블 고정 컬럼 인덱스 (Row1 기준, Row0의 '기준월' 은 idx=0)
const COL = {
  base:     0,
  brent:    1,
  fei:      2,
  fei_mm:   3,
  mb:       4,
  cp:       5,
  mopj:     6,
  cv:       7,
  cv3:      8,
  nv:       9,
  nv2:      10,
  cp_brent: 11,
  fei_mopj: 12,
  fei_mopj2:13,
  mb_fei:   14,
  fei_cp:   15,
  hh:       16,
  jkm:      17,
  ttf:      18,
  jkm_fei:  19,
};

// ─── 메인 파싱 ───────────────────────────────────────────────────────────────
console.log('Reading Notion JSON:', TOOL_RESULT_JAN);
const raw = fs.readFileSync(TOOL_RESULT_JAN, 'utf8');
const data = JSON.parse(raw);
const fullText = data[0].text;

// 관측일 블록 분리
const obsPattern = /(\d+)월\s+(\d+)일\s+오딘/g;
const obsMatches = [];
let m;
while ((m = obsPattern.exec(fullText)) !== null) {
  obsMatches.push({ label: m[0], pos: m.index });
}
console.log(`관측일 ${obsMatches.length}개 발견`);

const notionRecords = [];

for (let i = 0; i < obsMatches.length; i++) {
  const { label, pos } = obsMatches[i];
  const nextPos = i + 1 < obsMatches.length ? obsMatches[i + 1].pos : fullText.length;
  const block = fullText.slice(pos, nextPos);

  const obsDate = obsLabelToDate(label);
  if (!obsDate) { console.warn('날짜 파싱 실패:', label); continue; }

  // 테이블 추출
  const tableMatch = block.match(/<table[\s\S]*?<\/table>/);
  if (!tableMatch) { console.warn('테이블 없음:', obsDate); continue; }

  const tableRows = parseTable(tableMatch[0]);
  if (tableRows.length < 3) { console.warn('행 부족:', obsDate, tableRows.length); continue; }

  // 데이터 행: tableRows[2..] → 기준월 행들 (Row0=그룹헤더, Row1=컬럼헤더, Row2+=데이터)
  const obsYM = obsDate.slice(0, 7);  // "2026-01"
  let frontRow = null;
  for (let ri = 2; ri < tableRows.length; ri++) {
    const cells = tableRows[ri];
    const bm = parseBaseMonth(cells[COL.base] || '');
    if (!bm) continue;
    if (bm >= obsYM && !frontRow) frontRow = { bm, cells };
    if (!frontRow) frontRow = { bm, cells };  // fallback: 첫 번째 유효 행
  }

  if (!frontRow) { console.warn('근월 행 없음:', obsDate); continue; }

  const cells = frontRow.cells;

  const brent = parseParen(cells[COL.brent]);
  const fei   = parseParen(cells[COL.fei]);
  const mb    = parseParen(cells[COL.mb]);
  const cp    = parseParen(cells[COL.cp]);
  const mopj  = parseParen(cells[COL.mopj]);
  const jkm   = parseParen(cells[COL.jkm]);
  const ttf   = parseParen(cells[COL.ttf]);
  const hh    = parseParen(cells[COL.hh]);

  // Notion은 "106.4 %" 형식의 % 문자열
  const cvRaw      = parsePct(cells[COL.cv]);
  const nvRaw      = parsePct(cells[COL.nv]);
  const feiMopjRaw = parsePct(cells[COL.fei_mopj]);

  notionRecords.push({
    date:       obsDate,
    baseMonth:  frontRow.bm,
    source:     'notion',
    tier:       1,
    native: {
      Brent: r(brent, 2),
      FEI:   r(fei,   2),
      MB:    r(mb,    3),
      CP:    r(cp,    2),
      MOPJ:  r(mopj,  2),
      JKM:   r(jkm,   3),
      TTF:   r(ttf,   3),
      HH:    r(hh,    3),
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
      CV:           r(cvRaw,      4),
      NV:           r(nvRaw,      4),
      FEI_MOPJ:     r(feiMopjRaw, 4),
      JKM_FEI_M2:   null,
      MB_FEI:       r(parseParen(cells[COL.mb_fei]),  1),
      FEI_CP:       r(parseParen(cells[COL.fei_cp]),  1),
      JKM_FEI_ODIN: r(parseParen(cells[COL.jkm_fei]), 3),
    },
  });
}

console.log(`Notion 파싱 레코드: ${notionRecords.length}개`);
if (notionRecords.length > 0) {
  console.log('첫 레코드:', JSON.stringify(notionRecords[0], null, 2));
}

// ─── 기존 timeseries.json 병합 (Notion 1월 + Excel 2~7월) ──────────────────
const existing = JSON.parse(fs.readFileSync(OUT_TS, 'utf8'));
const existingDates = new Set(existing.map(r => r.date));

// Notion 레코드 중 Excel에 없는 날짜만 추가
const toAdd = notionRecords.filter(r => !existingDates.has(r.date));
console.log(`병합할 신규 레코드: ${toAdd.length}개 (중복 제외)`);

const merged = [...toAdd, ...existing].sort((a, b) => a.date.localeCompare(b.date));
fs.writeFileSync(OUT_TS, JSON.stringify(merged, null, 2), 'utf8');
console.log(`저장 완료: ${OUT_TS} (총 ${merged.length}개 레코드)`);
