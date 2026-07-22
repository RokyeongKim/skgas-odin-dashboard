// js/panelD.js — Panel D: 이벤트 플래그별 Native 가격 표

const EVENT_COLUMNS = [
  { id: 'current',       label: '현재' },
  { id: 'iran_escalate', label: '재격화(7/18)' },
  { id: 'strait_open',   label: '봉쇄복원(7/15)' },
  { id: 'strait_close',  label: '봉쇄(7/11)' },
  { id: 'mou_end',       label: 'MOU종료(7/8)' },
  { id: 'mou_signed',    label: 'MOU서명(6/17)' },
  { id: 'mou_news',      label: 'MOU뉴스(6/12)' },
  { id: 'ceasefire1',    label: '1차휴전(4/8)' },
  { id: 'war_start',     label: '개전(2/28)' },
];

const INDEX_ROWS = [
  { key: 'Brent', label: 'Brent',       unit: '$/bbl' },
  { key: 'FEI',   label: 'FEI',         unit: '$/ton' },
  { key: 'CP',    label: 'CP',          unit: '$/ton' },
  { key: 'MOPJ',  label: 'MOPJ (납사)', unit: '$/ton' },
  { key: 'MB',    label: 'MB',          unit: '¢/gal' },
  { key: 'JKM',   label: 'JKM',         unit: '$/mmbtu' },
  { key: 'TTF',   label: 'TTF',         unit: '$/mmbtu' },
  { key: 'HH',    label: 'HH',          unit: '$/mmbtu' },
];

export function renderPanelD(pricesNative, container) {
  if (!pricesNative || !container) return;
  const curPrices = pricesNative['current'] || {};

  let html = '<table class="price-table"><thead><tr><th>Index (단위)</th>';
  EVENT_COLUMNS.forEach(col => { html += `<th>${col.label}</th>`; });
  html += '<th>개전 대비 변화율</th></tr></thead><tbody>';

  INDEX_ROWS.forEach(row => {
    html += `<tr><td>${row.label}<br><small style="color:#8b949e">${row.unit}</small></td>`;
    EVENT_COLUMNS.forEach(col => {
      const evData = pricesNative[col.id];
      const val = evData?.[row.key];
      html += `<td>${val !== null && val !== undefined ? Number(val).toFixed(2) : '—'}</td>`;
    });
    // Change from war_start to current
    const curVal  = curPrices[row.key];
    const warVal  = pricesNative['war_start']?.[row.key];
    if (curVal != null && warVal != null && warVal !== 0) {
      const chg = (curVal - warVal) / warVal * 100;
      const cls = chg > 0.5 ? 'val-up' : chg < -0.5 ? 'val-down' : 'val-neutral';
      const sign = chg > 0 ? '+' : '';
      html += `<td class="${cls}">${sign}${chg.toFixed(1)}%</td>`;
    } else {
      html += '<td class="val-neutral">—</td>';
    }
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}
