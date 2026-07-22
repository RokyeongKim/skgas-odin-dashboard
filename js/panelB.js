// js/panelB.js — Panel B: Spread 시계열 (±1σ 밴드, 현재 백분위)

import { EVENTS } from './config.js';
import { computeSpread, rollingStats } from './data.js';

let chart = null;

export function initPanelB(dom) {
  chart = echarts.init(dom, 'dark');
}

export function renderPanelB(records, spreadPairId) {
  if (!chart || !records.length) return;
  const [keyA, keyB] = spreadPairId.split('_');
  const dates  = records.map(r => r.date);
  const vals   = computeSpread(records, keyA, keyB);
  const stats  = rollingStats(vals, 252);
  const means  = stats.map(s => s.mean);
  const upper  = stats.map(s => s.mean !== null && s.std !== null ? +(s.mean + s.std).toFixed(3) : null);
  const lower  = stats.map(s => s.mean !== null && s.std !== null ? +(s.mean - s.std).toFixed(3) : null);

  // Current percentile
  const curVal = vals[vals.length - 1];
  const sorted = [...vals].filter(v => v !== null).sort((a, b) => a - b);
  const pct = curVal !== null && sorted.length > 0
    ? Math.round(sorted.filter(v => v <= curVal).length / sorted.length * 100)
    : null;
  const badge = document.getElementById('spread-pct');
  if (badge) badge.textContent = pct !== null ? `현재 ${pct}%ile` : '';

  const eventMarkLineData = EVENTS.map(ev => ([
    { xAxis: ev.date, lineStyle: { color: ev.color, type: 'dashed', width: 1 }, label: { show: false } },
    { xAxis: ev.date },
  ]));

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { top: 5, textStyle: { color: '#8b949e', fontSize: 11 } },
    grid: { left: 55, right: 20, top: 40, bottom: 40 },
    xAxis: {
      type: 'category', data: dates, boundaryGap: false,
      axisLabel: { color: '#8b949e', fontSize: 10 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8b949e', fontSize: 10, formatter: v => `$${v.toFixed(2)}` },
      splitLine: { lineStyle: { color: '#1e2430', type: 'dashed' } },
    },
    series: [
      {
        name: 'Spread', type: 'line', data: vals, showSymbol: false,
        lineStyle: { color: '#00d4ff', width: 1.8 },
        markLine: { symbol: 'none', data: eventMarkLineData, silent: true },
      },
      { name: '평균', type: 'line', data: means, showSymbol: false, lineStyle: { color: '#8b949e', type: 'dashed', width: 1 } },
      {
        name: '+1σ', type: 'line', data: upper, showSymbol: false,
        lineStyle: { color: 'rgba(248,81,73,0.5)', width: 1 },
        areaStyle: { color: 'rgba(248,81,73,0.05)' },
      },
      {
        name: '-1σ', type: 'line', data: lower, showSymbol: false,
        lineStyle: { color: 'rgba(63,185,80,0.5)', width: 1 },
        areaStyle: { color: 'rgba(63,185,80,0.05)' },
      },
    ],
  }, true);
}

export function resizePanelB() { chart?.resize(); }
