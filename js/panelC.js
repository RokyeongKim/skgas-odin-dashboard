// js/panelC.js — Panel C: 상대가 시계열 (CV, NV, FEI/MOPJ, JKM vs FEI(M-2))

import { RELATIVE_PAIRS, EVENTS } from './config.js';

let chart = null;
let _currentTab = 'buy';

export function initPanelC(dom) {
  chart = echarts.init(dom, 'dark');
}

export function renderPanelC(records, tab) {
  _currentTab = tab || _currentTab;
  if (!chart || !records.length) return;
  const dates = records.map(r => r.date);
  const pairs = RELATIVE_PAIRS.filter(p => p.group === _currentTab);

  const colors = ['#00d4ff', '#4ade80', '#f0a500', '#c77dff'];

  const eventMarkLineData = EVENTS.map(ev => ([
    { xAxis: ev.date, lineStyle: { color: ev.color, type: 'dashed', width: 1 }, label: { show: false } },
    { xAxis: ev.date },
  ]));

  const series = pairs.map((p, idx) => {
    const vals = records.map(r => r.derived[p.id] ?? null);
    const s = {
      name: p.label,
      type: 'line',
      data: vals,
      showSymbol: false,
      lineStyle: { width: 1.8, color: colors[idx % colors.length] },
      itemStyle: { color: colors[idx % colors.length] },
    };
    if (idx === 0) {
      s.markLine = {
        symbol: 'none',
        data: [
          ...eventMarkLineData,
          ...(p.target !== null ? [[
            {
              yAxis: p.target,
              lineStyle: { color: '#d29922', type: 'dotted', width: 2 },
              label: {
                show: true,
                formatter: `目標 ${(p.target * 100).toFixed(0)}%`,
                color: '#d29922',
                fontSize: 10,
              },
            },
            { yAxis: p.target },
          ]] : []),
        ],
        silent: true,
      };
    }
    return s;
  });

  const isBuy = _currentTab === 'buy';
  chart.setOption({
    backgroundColor: 'transparent',
    legend: { top: 5, textStyle: { color: '#8b949e', fontSize: 11 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 65, right: 20, top: 50, bottom: 40 },
    xAxis: {
      type: 'category', data: dates, boundaryGap: false,
      axisLabel: { color: '#8b949e', fontSize: 10 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#8b949e', fontSize: 10,
        formatter: isBuy ? v => `${(v * 100).toFixed(0)}%` : v => `$${v.toFixed(2)}`,
      },
      splitLine: { lineStyle: { color: '#1e2430', type: 'dashed' } },
    },
    series,
  }, true);
}

export function resizePanelC() { chart?.resize(); }
