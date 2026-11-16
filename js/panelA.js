// js/panelA.js — Panel A: Index 시계열 ($/mmbtu 환산) + 이벤트 플래그(클릭 → Panel F 연동)

import { INDEX_META } from './config.js';
import { getEvents } from './data.js';
import { openEventInPanelF } from './panelF.js';
import { descHtml } from './glossary.js';

let chart = null;
let visibleSet = new Set(Object.entries(INDEX_META).filter(([, m]) => m.defaultOn !== false).map(([k]) => k));
let _events = [];
let _handlerBound = false;

export function initPanelA(dom) {
  chart = echarts.init(dom, 'dark');
}

export function renderPanelA(records) {
  if (!chart || !records.length) return;

  _events = getEvents() || [];
  const dates  = records.map(r => r.date);
  const dateSet = new Set(dates);

  const series = Object.entries(INDEX_META).map(([key, meta]) => ({
    name: meta.label,
    type: 'line',
    data: records.map(r => r.mmbtu[key] ?? null),
    showSymbol: false,
    lineStyle: { width: 1.5, color: meta.color },
    itemStyle: { color: meta.color },
  }));

  // 이벤트 vertical lines (Tier1=진하게, Tier2=옅게)
  const markLineData = _events
    .filter(ev => !ev.is_band && dateSet.has(ev.date))
    .map(ev => {
      const isTier2 = ev.tier === 2;
      return [
        {
          xAxis: ev.date,
          name: ev.id,
          lineStyle: {
            color: isTier2 ? '#555' : ev.color,
            type: isTier2 ? 'dotted' : 'dashed',
            width: isTier2 ? 1 : 1.5,
          },
          label: { show: false },
        },
        { xAxis: ev.date, name: ev.id },
      ];
    });

  // 클릭 가능한 flag markPoint (상단 고정) — Tier1 전부 + flag:true 로 표시 지정한 Tier2(과거 JKM 급등 배경 등)
  const tier1Events = _events.filter(ev => !ev.is_band && dateSet.has(ev.date) && (ev.tier === 1 || ev.flag === true));
  const flagPoints = tier1Events.map((ev, i) => ({
    coord: [ev.date, 'max'],
    name: ev.id,
    value: ev.label,
    symbol: 'pin',
    symbolSize: ev.tier === 1 ? [26, 32] : [20, 26],
    symbolOffset: [0, i % 2 === 0 ? -6 : -30], // 라벨 겹침 완화용 세로 stagger
    itemStyle: { color: ev.color, borderColor: ev.tier === 1 ? '#fff' : '#8b949e', borderWidth: 1, opacity: ev.tier === 1 ? 1 : 0.85 },
    label: {
      show: true,
      position: 'top',
      distance: 4,
      formatter: () => ev.label.length > 18 ? ev.label.slice(0, 18) + '…' : ev.label,
      color: ev.color,
      fontSize: 9.5,
      fontWeight: 600,
      backgroundColor: 'rgba(13,17,23,0.85)',
      padding: [2, 4],
      borderRadius: 3,
    },
    tooltip: {
      formatter: () => `<div style="max-width:340px;font-size:11px;white-space:normal">
        <b style="color:${ev.color}">${ev.label}</b><br/>
        <span style="color:#8b949e">${ev.date}${ev.tier === 2 ? ' · Tier 2 (공개 참조)' : ''}</span><br/>
        <span style="color:#c9d1d9">${ev.note || ''}</span><br/>
        <span style="color:#00d4ff;font-size:10px">▶ 클릭 → Panel F 상세보기</span>
      </div>`,
    },
  }));

  if (series.length > 0) {
    series[0].markLine = { symbol: 'none', data: markLineData, silent: true };
    series[0].markPoint = {
      data: flagPoints,
      silent: false,
      z: 100,
    };
  }

  // Band events as markArea
  const bandAreas = _events
    .filter(ev => ev.is_band && ev.end_date)
    .map(ev => ([
      { xAxis: ev.date,     itemStyle: { color: `${ev.color}18` }, label: { show: true, position: 'insideTopLeft', formatter: ev.label.slice(0, 10), color: ev.color, fontSize: 8 } },
      { xAxis: ev.end_date },
    ]));

  if (bandAreas.length > 0 && series.length > 0) {
    series[0].markArea = { silent: true, data: bandAreas };
  }

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', lineStyle: { color: '#444' } },
      confine: true,
      extraCssText: 'max-width:420px;white-space:normal;',
      formatter: params => {
        const date = params[0]?.axisValue;
        let html = `<div style="font-size:11px;line-height:1.5">`;
        // 해당 날짜의 이벤트(플래그·밴드 시작일) 전체 이름 + 배경을 가격 위에 표시
        const dayEvents = _events.filter(ev => ev.date === date);
        if (dayEvents.length) {
          dayEvents.forEach(ev => {
            html += `<div style="margin-bottom:6px;padding:6px 8px;border-left:3px solid ${ev.color};background:rgba(255,255,255,0.04);border-radius:3px">
              <div style="font-weight:700;color:${ev.color};font-size:12px">📍 ${ev.label}</div>
              <div style="color:#8b949e;font-size:10px">${ev.date} · ${ev.archetype || ''}${ev.tier === 2 ? ' · Tier 2 (공개 참조)' : ' · Tier 1 (Odin)'}</div>
              ${ev.note ? `<div style="color:#c9d1d9;margin-top:3px">${ev.note}</div>` : ''}
            </div>`;
          });
        }
        html += `<b>${date}</b>`;
        params.forEach(p => {
          if (p.seriesType === 'line' && p.data !== null && p.data !== undefined) {
            html += `<br/><span style="color:${p.color}">●</span> ${p.seriesName}: <b>$${Number(p.data).toFixed(2)}</b>`;
          }
        });
        return html + '</div>';
      },
    },
    legend: {
      top: 5,
      textStyle: { color: '#8b949e', fontSize: 11 },
      tooltip: {
        show: true,
        formatter: params => {
          const key = Object.keys(INDEX_META).find(k => INDEX_META[k].label === params.name);
          return key ? descHtml(key) : params.name;
        },
      },
      selected: Object.fromEntries(Object.entries(INDEX_META).map(([k, m]) => [m.label, visibleSet.has(k)])),
    },
    grid: { left: 55, right: 20, top: 80, bottom: 50 },
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

  // 플래그 클릭 → Panel F 연동 (한 번만 바인딩)
  if (!_handlerBound) {
    chart.on('click', params => {
      if (params.componentType === 'markPoint' && params.name) {
        openEventInPanelF(params.name);
      }
    });
    _handlerBound = true;
  }
}

export function toggleIndex(key, visible) {
  if (visible) visibleSet.add(key); else visibleSet.delete(key);
  if (!chart) return;
  const meta = INDEX_META[key];
  chart.dispatchAction({ type: visible ? 'legendSelect' : 'legendUnSelect', name: meta.label });
}

export function resizePanelA() { chart?.resize(); }
