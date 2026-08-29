// js/panelF.js — Panel F: Flag Factor 라이브러리 (§5-1A 전체 플래그)

const ARCHETYPE_LABELS = {
  '수요파괴형':   { icon: '↓', color: '#4ade80', desc: '수요 기대 삭감, 물리 공급 유지' },
  '공급차단형':   { icon: '⛔', color: '#ff4444', desc: '물리 공급·물류 실제 차단' },
  '유통재배치형': { icon: '↔', color: '#ffaa00', desc: '총량 불변, 무역 지도만 재편' },
  '정책마감형':   { icon: '⏱', color: '#c77dff', desc: '마감시한 인위적 수요 스파이크' },
};

const CHANNEL_LABELS = {
  brent: { label: 'Brent', color: '#ff6b6b' },
  lpg:   { label: 'LPG',   color: '#00d4ff' },
  lng:   { label: 'LNG',   color: '#4ade80' },
};

let currentFilter = { archetype: 'all', tier: 'all', channel: 'all' };
let allEvents = [];

function renderBadge(text, color) {
  return `<span class="ev-badge" style="background:${color}22;color:${color};border:1px solid ${color}44">${text}</span>`;
}

function buildRow(ev) {
  const arch = ARCHETYPE_LABELS[ev.archetype] || { icon: '?', color: '#8b949e', desc: '' };
  const tier1 = ev.tier === 1;

  const channelBadges = (ev.channels || [])
    .map(ch => CHANNEL_LABELS[ch])
    .filter(Boolean)
    .map(c => renderBadge(c.label, c.color))
    .join(' ');

  const dateStr = ev.end_date
    ? `${ev.date} ~ ${ev.end_date}`
    : ev.date;

  return `
    <tr class="ev-row ${tier1 ? 'tier1' : 'tier2'}" data-id="${ev.id}" data-archetype="${ev.archetype}" data-tier="${ev.tier}" data-channels="${(ev.channels || []).join(',')}">
      <td class="col-date">${dateStr}${ev.is_band ? '<span class="band-tag">구간</span>' : ''}</td>
      <td class="col-label">
        <span style="color:${ev.color}">●</span> ${ev.label}
        ${tier1 ? '' : '<span class="tier2-tag">Tier2</span>'}
      </td>
      <td class="col-arch">
        <span style="color:${arch.color}" title="${arch.desc}">${arch.icon} ${ev.archetype}</span>
      </td>
      <td class="col-channels">${channelBadges}</td>
      <td class="col-note">${ev.note || '—'}</td>
    </tr>
    <tr class="ev-detail-row" id="detail-${ev.id}" style="display:none">
      <td colspan="5">
        <div class="ev-detail-card">
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Archetype 해설</span>
              <span class="detail-val">${arch.desc}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">영향 계열</span>
              <span class="detail-val">${(ev.channels || []).map(ch => CHANNEL_LABELS[ch]?.label || ch).join(' / ')}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">데이터 Tier</span>
              <span class="detail-val">${ev.tier === 1 ? 'Tier 1 (Odin 실측)' : 'Tier 2 (공개 참조)'}</span>
            </div>
          </div>
          <div class="detail-note">
            <span class="detail-label">분석 메모</span>
            <p>${ev.note || '—'}</p>
          </div>
          <div class="detail-archetype-table">
            <b>Archetype별 예상 반응 패턴 (${ev.archetype})</b>
            ${getArchetypePattern(ev.archetype)}
          </div>
        </div>
      </td>
    </tr>`;
}

function getArchetypePattern(archetype) {
  const patterns = {
    '수요파괴형': `<table class="pattern-table">
      <tr><th></th><th>Brent</th><th>LPG(FEI)</th><th>LNG(JKM)</th><th>HH</th><th>커브</th></tr>
      <tr><td>방향</td><td class="val-down">급락</td><td class="val-down">후행 하락</td><td class="val-down">하락 (유가>)</td><td class="val-neutral">무반응</td><td>백워데이션 확대</td></tr>
      <tr><td>주의</td><td colspan="5">Brent·FEI 동반 하락 → CV 변화 소폭. "유가 떨어졌으니 지금 소싱"은 CV 기준으로 오판일 수 있음</td></tr>
    </table>`,
    '공급차단형': `<table class="pattern-table">
      <tr><th></th><th>Brent</th><th>LPG(FEI)</th><th>LNG(JKM)</th><th>HH</th><th>커브</th></tr>
      <tr><td>방향</td><td class="val-up">급등</td><td class="val-up">급등</td><td class="val-up">폭등</td><td class="val-neutral">무반응</td><td>백워데이션 급확대 후 붕괴</td></tr>
      <tr><td>주의</td><td colspan="5">Ras Laffan 피격 시 FEI·CP 직접 타격 (LNG 전용 아님). 커브 전이도(③)가 낮으면 근월 스파이크로 끝날 수 있음</td></tr>
    </table>`,
    '유통재배치형': `<table class="pattern-table">
      <tr><th></th><th>Brent</th><th>LPG(FEI)</th><th>LNG(JKM)</th><th>HH</th><th>커브</th></tr>
      <tr><td>방향</td><td class="val-neutral">소폭</td><td class="val-neutral">원산지별 분리</td><td class="val-neutral">원산지별 분리</td><td class="val-neutral">무반응</td><td>지역간 스프레드 확대</td></tr>
      <tr><td>주의</td><td colspan="5">동일 분자도 원산지에 따라 US/ME 가격 분리. MB↓/FEI 유지 같은 비대칭은 수급이 아니라 서류상 원산지 때문</td></tr>
    </table>`,
    '정책마감형': `<table class="pattern-table">
      <tr><th></th><th>Brent</th><th>LPG(FEI)</th><th>LNG(JKM)</th><th>HH</th><th>커브</th></tr>
      <tr><td>방향</td><td class="val-neutral">소폭</td><td class="val-up">근월 급등 후 급락</td><td class="val-neutral">—</td><td class="val-neutral">무반응</td><td>마감 전 백워데이션↑, 후 붕괴</td></tr>
      <tr><td>주의</td><td colspan="5">마감일을 점 하나로 찍으면 사재기 스파이크와 공백이 뭉개짐. 구간(shaded band)으로 표시 필요</td></tr>
    </table>`,
  };
  return patterns[archetype] || '<p>패턴 정보 없음</p>';
}

function applyFilter() {
  const rows = document.querySelectorAll('.ev-row');
  let visible = 0;
  rows.forEach(row => {
    const arch  = row.dataset.archetype;
    const tier  = String(row.dataset.tier);
    const chs   = row.dataset.channels;
    const fArch = currentFilter.archetype === 'all' || arch === currentFilter.archetype;
    const fTier = currentFilter.tier === 'all' || tier === currentFilter.tier;
    const fCh   = currentFilter.channel === 'all' || chs.includes(currentFilter.channel);
    const show  = fArch && fTier && fCh;
    row.style.display = show ? '' : 'none';
    const detailRow = document.getElementById(`detail-${row.dataset.id}`);
    if (detailRow) detailRow.style.display = 'none';
    if (show) visible++;
  });
  const countEl = document.getElementById('ev-count');
  if (countEl) countEl.textContent = `${visible}개 표시 중 (전체 ${allEvents.length}개)`;
}

export function renderPanelF(events, container) {
  if (!events || !container) return;
  allEvents = events;

  container.innerHTML = `
    <div class="panel-F-filters">
      <div class="filter-group">
        <label>Archetype</label>
        <select id="f-arch">
          <option value="all">전체</option>
          ${Object.keys(ARCHETYPE_LABELS).map(a => `<option value="${a}">${a}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label>계열</label>
        <select id="f-channel">
          <option value="all">전체</option>
          <option value="brent">Brent(유가)</option>
          <option value="lpg">LPG</option>
          <option value="lng">LNG</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Tier</label>
        <select id="f-tier">
          <option value="all">전체</option>
          <option value="1">Tier 1 (Odin)</option>
          <option value="2">Tier 2 (참조)</option>
        </select>
      </div>
      <span id="ev-count" class="ev-count">${events.length}개 표시 중</span>
    </div>
    <div class="table-wrap-f">
      <table class="ev-table">
        <thead>
          <tr>
            <th>날짜</th>
            <th>이벤트</th>
            <th>Archetype</th>
            <th>영향 계열</th>
            <th>분석 메모</th>
          </tr>
        </thead>
        <tbody id="ev-tbody">
          ${events.map(buildRow).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Filter change handlers
  ['f-arch', 'f-channel', 'f-tier'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', e => {
      const key = id === 'f-arch' ? 'archetype' : id === 'f-channel' ? 'channel' : 'tier';
      currentFilter[key] = e.target.value;
      applyFilter();
    });
  });

  // Row click → expand detail
  document.querySelectorAll('.ev-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.id;
      const detailRow = document.getElementById(`detail-${id}`);
      if (!detailRow) return;
      const isOpen = detailRow.style.display !== 'none';
      // close all
      document.querySelectorAll('.ev-detail-row').forEach(r => { r.style.display = 'none'; });
      if (!isOpen) detailRow.style.display = '';
    });
  });
}

/** Panel A의 플래그 클릭 시 호출 — 필터 초기화 후 해당 이벤트 상세 열기 + 스크롤 */
export function openEventInPanelF(eventId) {
  // 필터 리셋 (숨겨진 이벤트일 수 있으므로)
  currentFilter = { archetype: 'all', tier: 'all', channel: 'all' };
  ['f-arch', 'f-channel', 'f-tier'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) sel.value = 'all';
  });
  applyFilter();

  const row = document.querySelector(`.ev-row[data-id="${eventId}"]`);
  const detailRow = document.getElementById(`detail-${eventId}`);
  if (!row || !detailRow) return;

  // 다른 detail 모두 접기, 대상만 열기
  document.querySelectorAll('.ev-detail-row').forEach(r => { r.style.display = 'none'; });
  detailRow.style.display = '';

  // 강조 애니메이션
  row.classList.add('ev-row-flash');
  setTimeout(() => row.classList.remove('ev-row-flash'), 2200);

  // 스크롤
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
