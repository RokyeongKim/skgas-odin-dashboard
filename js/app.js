// js/app.js — 앱 초기화 + 이벤트 핸들러

import { loadAll, filterByDays, getEvents } from './data.js';
import { INDEX_META } from './config.js';
import { initPanelA, renderPanelA, resizePanelA, toggleIndex } from './panelA.js';
import { initPanelB, renderPanelB, resizePanelB, loadForwardData, getForwardMonths } from './panelB.js';
import { initPanelC, renderPanelC, resizePanelC } from './panelC.js';
import { renderPanelD } from './panelD.js';
import { renderPanelE } from './panelE.js';
import { renderPanelF } from './panelF.js';

let currentDays = 365;
let currentMonth = '2026-12';
let currentRelTab = 'buy';

async function init() {
  const [{ timeseries, pricesNative }] = await Promise.all([
    loadAll(),
    loadForwardData(),
  ]);

  // Data date display
  const latest = timeseries[timeseries.length - 1];
  document.getElementById('data-date').textContent =
    `기준일: ${latest.date} | 총 ${timeseries.length}개 관측일`;

  // Init ECharts panels
  initPanelA(document.getElementById('chart-A'));
  initPanelB(document.getElementById('chart-B'));
  initPanelC(document.getElementById('chart-C'));

  // Build index toggle buttons
  const togglesEl = document.getElementById('index-toggles');
  Object.entries(INDEX_META).forEach(([key, meta]) => {
    const btn = document.createElement('button');
    btn.className = 'toggle-btn';
    btn.textContent = meta.label;
    btn.style.borderColor = meta.color;
    btn.style.color = meta.color;
    btn.dataset.key = key;
    btn.addEventListener('click', () => {
      btn.classList.toggle('off');
      toggleIndex(key, !btn.classList.contains('off'));
    });
    togglesEl.appendChild(btn);
  });

  // Populate spread-select with forward contract months
  const spreadSel = document.getElementById('spread-select');
  getForwardMonths().forEach(month => {
    const opt = document.createElement('option');
    opt.value = month;
    opt.textContent = month;
    if (month === currentMonth) opt.selected = true;
    spreadSel.appendChild(opt);
  });

  // Initial render
  renderAll(timeseries, pricesNative);

  // Period filter buttons
  document.querySelectorAll('.btn-period').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.btn-period.active')?.classList.remove('active');
      btn.classList.add('active');
      currentDays = Number(btn.dataset.days);
      renderCharts();
    });
  });

  // Spread selector → change contract month
  spreadSel.addEventListener('change', e => {
    currentMonth = e.target.value;
    renderPanelB(currentMonth);
  });

  // Relative price tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.tab-btn.active')?.classList.remove('active');
      btn.classList.add('active');
      currentRelTab = btn.dataset.tab;
      renderPanelC(filterByDays(currentDays), currentRelTab);
    });
  });

  // Resize handler
  window.addEventListener('resize', () => {
    resizePanelA(); resizePanelB(); resizePanelC();
  });
}

function renderCharts() {
  const records = filterByDays(currentDays);
  renderPanelA(records);
  renderPanelB(currentMonth);
  renderPanelC(records, currentRelTab);
}

function renderAll(timeseries, pricesNative) {
  renderCharts();
  renderPanelD(pricesNative, document.getElementById('table-D'));
  renderPanelE(document.getElementById('optionality-cards'));
  renderPanelF(getEvents(), document.getElementById('panel-F-content'));
}

init().catch(err => {
  console.error('Dashboard init failed:', err);
  document.body.innerHTML = `<div style="color:red;padding:40px">로딩 실패: ${err.message}</div>`;
});
