// js/stats.js — 기준구간(Baseline) 정의 + 지표별 통계 (Panel A-1 Brief · A-2 Range 공용)

import { NATIVE_META, REGIMES } from './config.js';
import { getTimeseries, seriesStats, dailyChangeStats, latestNativeWithDate, percentileRank } from './data.js';

/** 데이터 범위에 맞춰 기준구간 목록을 동적으로 생성 (연도는 데이터에 있는 것만) */
export function buildBaselines(records) {
  const years = [...new Set(records.map(r => r.date.slice(0, 4)))].sort().reverse();
  const first = records[0]?.date.slice(0, 7) || '';
  const list = [
    { id: 'all',    label: `전체기간 (${first}~)`,                 filter: () => true },
    { id: 'prewar', label: `개전 전 (${first} ~ 2026-02-27)`,      filter: r => r.date < '2026-02-28' },
  ];
  REGIMES.forEach(g => {
    if (records.some(r => r.date >= g.from && r.date <= g.to)) {
      list.push({ id: g.id, label: g.label, filter: r => r.date >= g.from && r.date <= g.to });
    }
  });
  years.forEach(y => list.push({ id: `y${y}`, label: `${y}년`, filter: r => r.date.startsWith(y) }));
  list.push(
    { id: 'last60',  label: '최근 60 영업일',          lastN: 60 },
    { id: 'last120', label: '최근 120 영업일',         lastN: 120 },
    { id: 'last250', label: '최근 250 영업일 (≈1년)',  lastN: 250 },
  );
  return list;
}

let _baselines = null;
export function getBaselines() {
  if (!_baselines) _baselines = buildBaselines(getTimeseries() || []);
  return _baselines;
}

export function baselineRecords(baseId) {
  const all = getTimeseries() || [];
  const b = getBaselines().find(x => x.id === baseId) || getBaselines()[0];
  if (b.lastN) return all.slice(-b.lastN);
  return all.filter(b.filter);
}

export const STATUS_LABEL = { normal: '정상', watch: '주의', extreme: '이례적' };
export const STATUS_COLOR = { normal: '#3fb950', watch: '#d29922', extreme: '#f85149' };

/** native 지표 하나의 통계 묶음 (기준구간 기준) */
export function statsFor(key, baseId) {
  const base = baselineRecords(baseId);
  const vals = base.map(r => r.native[key]);
  const st = seriesStats(vals);
  if (!st) return null;
  const dc = dailyChangeStats(vals);
  const cur = latestNativeWithDate(key);
  const z = cur ? (cur.value - st.mean) / st.std : null;
  // 기준구간 내 최고/최저 시점
  let maxRec = null, minRec = null;
  base.forEach(r => {
    const v = r.native[key];
    if (v === null || v === undefined) return;
    if (!maxRec || v > maxRec.value) maxRec = { value: v, date: r.date };
    if (!minRec || v < minRec.value) minRec = { value: v, date: r.date };
  });
  return {
    key, ...st, daily: dc, current: cur, z, maxRec, minRec,
    pct: cur ? percentileRank(vals, cur.value) : null,
    status: z === null ? null : Math.abs(z) >= 2 ? 'extreme' : Math.abs(z) >= 1 ? 'watch' : 'normal',
    change60: change(key, 60),
  };
}

/** 임의 숫자 시계열(파생 스프레드 등)의 현재값 위치 */
export function seriesPosition(values, dates) {
  const st = seriesStats(values);
  if (!st) return null;
  let cur = null;
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] !== null && values[i] !== undefined) { cur = { value: values[i], date: dates[i] }; break; }
  }
  if (!cur) return null;
  return { ...st, current: cur, z: (cur.value - st.mean) / st.std, pct: percentileRank(values, cur.value) };
}

/** 최근 N 영업일 변화율(%) */
export function change(key, n) {
  const all = (getTimeseries() || []).filter(r => r.native[key] !== null && r.native[key] !== undefined);
  if (all.length < n + 1) return null;
  const a = all[all.length - 1 - n].native[key], b = all[all.length - 1].native[key];
  return a ? (b - a) / a * 100 : null;
}

/** 특정 기간(regime) 안에서 지표의 극값 (peak → max, trough → min) */
export function regimeExtreme(key, regime) {
  const recs = (getTimeseries() || []).filter(r => r.date >= regime.from && r.date <= regime.to && r.native[key] !== null && r.native[key] !== undefined);
  if (!recs.length) return null;
  const pick = regime.kind === 'trough'
    ? recs.reduce((m, r) => r.native[key] < m.native[key] ? r : m)
    : recs.reduce((m, r) => r.native[key] > m.native[key] ? r : m);
  return { value: pick.native[key], date: pick.date };
}

export function fmtNum(v, d) {
  return (v === null || v === undefined || Number.isNaN(v)) ? '—'
    : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function digitsOf(key) { return NATIVE_META[key]?.digits ?? 1; }
