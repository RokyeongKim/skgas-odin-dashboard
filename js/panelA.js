// js/panelA.js — Panel A: 8종 Index 시계열 (ECharts, 이벤트 플래그 수직선)

import { INDEX_META, EVENTS } from './config.js';

let chart = null;
let visibleSet = new Set(Object.keys(INDEX_META));

export function initPanelA(dom) {
  chart = echarts.init(dom, 'dark');
}

export function renderPanelA(records) {
  if (!chart || !records.length) return;

  const dates = records.map(r => r.date);
  const series = Object.entries(INDEX_META).map(([key, meta]) => ({
    name: meta.label,
    type: 'line',
    data: records.map(r => r.mmbtu[key] ?? null),
    showSymbol: false,
    lineStyle: { width: 1.5, color: meta.color },
    itemStyle: { color: meta.color },
  }));

  // Event flag vertical lines via markLine on first series
  const markLineData = EVENTS.map(ev => ([
    {
      xAxis: ev.date,
      lineStyle: { color: ev.color, type: 'dashed', width: 1.5 },
      label: {
        show: true,
        position: 'insideEndTop',
        formatter: ev.label.slice(0, 6),
        color: ev.color,
        fontSize: 9,
      },
    },
    { xAxis: ev.date },
  ]));

  if (series.length > 0) {
    series[0].markLine = {
      symbol: 'none',
      data: markLineData,
      silent: true,
    };
  }

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', lineStyle: { color: '#444' } },
      formatter: params => {
        let html = `<div style="font-size:11px"><b>${params[0]?.axisValue}</b>`;
        params.forEach(p => {
          if (p.data !== null && p.data !== undefined) {
            html += `<br/><span style="color:${p.color}">●</span> ${p.seriesName}: <b>$${Number(p.data).toFixed(2)}</b>`;
          }
        });
        return html + '</div>';
      },
    },
    legend: {
      top: 5,
      textStyle: { color: '#8b949e', fontSize: 11 },
      selected: Object.fromEntries(Object.entries(INDEX_META).map(([k, m]) => [m.label, visibleSet.has(k)])),
    },
    grid: { left: 55, right: 20, top: 50, bottom: 50 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLabel: { color: '#8b949e', fontSize: 10 },
      axisLine: { lineStyle: { color: '#30363d' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: '$/mmbtu',
      nameTextStyle: { color: '#8b949e', fontSize: 10 },
      axisLabel: { color: '#8b949e', fontSize: 10, formatter: v => `$${v.toFixed(1)}` },
      splitLine: { lineStyle: { color: '#1e2430', type: 'dashed' } },
    },
    series,
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      {
        type: 'slider',
        bottom: 2,
        height: 20,
        borderColor: '#30363d',
        fillerColor: 'rgba(0,212,255,0.1)',
        handleStyle: { color: '#00d4ff' },
      },
    ],
  }, true);
}

export function toggleIndex(key, visible) {
  if (visible) visibleSet.add(key); else visibleSet.delete(key);
  if (!chart) return;
  const meta = INDEX_META[key];
  chart.dispatchAction({ type: visible ? 'legendSelect' : 'legendUnSelect', name: meta.label });
}

export function resizePanelA() { chart?.resize(); }
