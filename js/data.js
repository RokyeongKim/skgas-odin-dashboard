// js/data.js — JSON 로더 + 파생값 계산 (z-score, percentile, JKM(M) vs FEI(M-2))

import { CONVERSION } from './config.js';

let _timeseries = null;
let _events = null;
let _pricesNative = null;

export async function loadAll() {
  [_timeseries, _events, _pricesNative] = await Promise.all([
    fetch('data/timeseries.json').then(r => r.json()),
    fetch('data/events.json').then(r => r.json()),
    fetch('data/prices_native.json').then(r => r.json()),
  ]);
  _timeseries = computeJkmFeiLag(_timeseries);
  return { timeseries: _timeseries, events: _events, pricesNative: _pricesNative };
}

export function getTimeseries()    { return _timeseries; }
export function getEvents()        { return _events; }
export function getPricesNative()  { return _pricesNative; }

/** Filter timeseries to last N calendar days */
export function filterByDays(days) {
  if (!_timeseries) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutStr = cutoff.toISOString().slice(0, 10);
  return _timeseries.filter(r => r.date >= cutStr);
}

/** Compute JKM(M) vs FEI(M-2): LNG소싱 리드타임 2개월 = ~43 business days */
function computeJkmFeiLag(records) {
  const BDAYS_2M = 43;
  return records.map((r, i) => {
    const feePast = i >= BDAYS_2M ? records[i - BDAYS_2M].native.FEI : null;
    const jkmNow  = r.native.JKM;
    const jkmFeiM2 = (feePast !== null && feePast !== undefined && jkmNow !== null && jkmNow !== undefined)
      ? jkmNow - feePast / CONVERSION.LPG_TON_TO_MMBTU
      : null;
    r.derived.JKM_FEI_M2 = jkmFeiM2 !== null ? Math.round(jkmFeiM2 * 1000) / 1000 : null;
    return r;
  });
}

/** Compute spread series ($/mmbtu) between two mmbtu-normalized indices */
export function computeSpread(records, keyA, keyB) {
  return records.map(r => {
    const a = r.mmbtu[keyA];
    const b = r.mmbtu[keyB];
    return (a !== null && a !== undefined && b !== null && b !== undefined)
      ? Math.round((a - b) * 1000) / 1000
      : null;
  });
}

/** Compute rolling mean and std for a value array */
export function rollingStats(vals, window = 252) {
  return vals.map((v, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = vals.slice(start, i + 1).filter(x => x !== null && x !== undefined);
    if (slice.length < 2) return { mean: null, std: null };
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const std  = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length);
    return { mean: Math.round(mean * 1000) / 1000, std: Math.round(std * 1000) / 1000 };
  });
}

/** Latest value for a native index key */
export function latestNative(key) {
  if (!_timeseries || !_timeseries.length) return null;
  return _timeseries[_timeseries.length - 1].native[key];
}

/** Latest value for a derived key */
export function latestDerived(key) {
  if (!_timeseries || !_timeseries.length) return null;
  return _timeseries[_timeseries.length - 1].derived[key];
}

/** Current value's percentile rank within last windowSize records for a derived key */
export function currentPercentile1Y(key, windowSize = 252) {
  if (!_timeseries) return null;
  const arr = _timeseries.slice(-windowSize).map(r => r.derived[key]).filter(v => v !== null && v !== undefined);
  const cur = latestDerived(key);
  if (cur === null || cur === undefined || arr.length < 2) return null;
  return Math.round((arr.filter(v => v <= cur).length / arr.length) * 100);
}

/** Latest non-null native value with its date */
export function latestNativeWithDate(key) {
  if (!_timeseries) return null;
  for (let i = _timeseries.length - 1; i >= 0; i--) {
    const v = _timeseries[i].native[key];
    if (v !== null && v !== undefined) return { value: v, date: _timeseries[i].date };
  }
  return null;
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Descriptive stats (mean, sample std, min/max, percentiles) for a value array (nulls ignored) */
export function seriesStats(vals) {
  const v = vals.filter(x => x !== null && x !== undefined && !Number.isNaN(x));
  if (v.length < 2) return null;
  const n = v.length;
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const std  = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const s = [...v].sort((a, b) => a - b);
  return {
    n, mean, std, min: s[0], max: s[n - 1],
    p5: quantile(s, 0.05), p25: quantile(s, 0.25), p50: quantile(s, 0.5),
    p75: quantile(s, 0.75), p95: quantile(s, 0.95),
  };
}

/** Day-over-day % change stats (consecutive non-null observations only) */
export function dailyChangeStats(vals) {
  const pct = [];
  let prev = null;
  vals.forEach(v => {
    if (v === null || v === undefined) { prev = null; return; }
    if (prev !== null && prev !== 0) pct.push((v - prev) / prev * 100);
    prev = v;
  });
  const st = seriesStats(pct);
  if (!st) return null;
  const absSorted = pct.map(Math.abs).sort((a, b) => a - b);
  return { ...st, absP95: quantile(absSorted, 0.95), maxAbs: absSorted[absSorted.length - 1], pct };
}

/** Percentile rank (0-100) of value x within array */
export function percentileRank(vals, x) {
  const v = vals.filter(y => y !== null && y !== undefined);
  if (!v.length || x === null || x === undefined) return null;
  return Math.round(v.filter(y => y <= x).length / v.length * 100);
}
