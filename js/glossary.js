// js/glossary.js — 지표 설명(마우스 오버 툴팁) 정본 + 공용 툴팁 유틸
// 설명은 사내 용어 기준으로 작성. (추정) 표시는 Odin 원본 정의 확인 전 잠정 설명.

export const INDEX_DESC = {
  Brent: {
    name: 'Brent (브렌트 원유)', unit: '$/bbl',
    what: '북해 브렌트 원유 선물 근월물 가격. 글로벌 유가 벤치마크.',
    use: 'CV(FEI/Brent)·NV(MB/Brent)의 분모, 산업체 판가(Brent×3.75+α) 기준. LPG 환산 시 ÷8.2.',
  },
  WTI: {
    name: 'WTI (서부텍사스 중질유)', unit: '$/bbl',
    what: '미국 쿠싱 인도 WTI 원유 선물 근월물. 미국 내륙 유가 벤치마크.',
    use: 'Brent−WTI 스프레드가 벌어지면 미국 원유·NGL 수출 경쟁력 상승 → MB 약세 요인.',
  },
  MOPJ: {
    name: 'MOPJ (Mean of Platts Japan, 납사)', unit: '$/ton',
    what: 'Platts 일본 도착(C+F) 납사 평가가격. 아시아 석유화학 원료 벤치마크.',
    use: 'FEI/MOPJ 85% 이하면 석화가 납사 대신 LPG 투입(소싱 기회), 90% 이상이면 판매·Tolerance 활용.',
  },
  FO380: {
    name: 'MOPS F/O 380cst (싱가포르 고유황 연료유)', unit: '$/ton',
    what: 'Mean of Platts Singapore 380센티스토크 고유황 연료유 FOB 가격. 선박 벙커유 벤치마크.',
    use: 'VLGC 운임 원가(연료비)와 중질유 시황을 읽는 보조 지표. 참고 환산 ÷40.5 mmbtu/ton.',
  },
  CP: {
    name: 'CP C3 (Saudi Aramco Contract Price, 프로판)', unit: '$/ton',
    what: 'Aramco가 매월 말 발표하는 익월 중동 FOB 프로판 계약가. 중동 장기계약 LPG의 기준.',
    use: '일별 파일은 발표일부터 익월 CP로 전환. FEI−CP 스프레드 = 중동 대비 아시아 현물 프리미엄.',
  },
  CP_C4: {
    name: 'CP C4 (Aramco Contract Price, 부탄)', unit: '$/ton',
    what: 'Aramco 월간 부탄 계약가.',
    use: 'CP C4−C3 차이로 중동 부탄 수급(석화·블렌딩 수요) 확인.',
  },
  FEI: {
    name: 'FEI C3 (Argus Far East Index, 프로판)', unit: '$/ton',
    what: 'Argus 극동(일본 도착 CFR) 프로판 현물 평가가격. 아시아 LPG 현물 벤치마크.',
    use: 'CV = FEI ÷ (Brent×8.2) → 90% 미만이면 소싱 적정. FEI/MOPJ·FEI−CP·JKM−FEI의 기준.',
  },
  FEI_C4: {
    name: 'FEI C4 (Argus Far East Index, 부탄)', unit: '$/ton',
    what: 'Argus 극동 부탄 현물 평가가격.',
    use: 'C4−C3 스프레드가 커지면 석화 부탄 선호·부탄 공급 부족 신호.',
  },
  MB: {
    name: 'MB TET C3 (Mont Belvieu TET 프로판)', unit: '¢/gal',
    what: '미국 텍사스 Mont Belvieu의 Enterprise TET 저장소 인웰 프로판 가격. 미국 LPG 벤치마크(수출터미널 연계로 가장 유동적).',
    use: 'NV = MB×0.42 ÷ Brent → 38.5% 이하면 경쟁력 있는 조달. ×5.208 = $/ton, ×0.1089 = $/mmbtu. 기존 대시보드의 MB와 동일 계열.',
  },
  MB_nC4: {
    name: 'MB TET nC4 (노말부탄)', unit: '¢/gal',
    what: 'Mont Belvieu TET 노말부탄 인웰 가격.',
    use: '겨울철 휘발유 블렌딩(RVP) 수요에 민감. 프로판 대비 프리미엄은 미국 부탄 수급 지표.',
  },
  MB_iC4: {
    name: 'MB iC4 (이소부탄)', unit: '¢/gal',
    what: 'Mont Belvieu 이소부탄 인웰 가격(TET·non-TET 동일 호가).',
    use: '알킬레이트(고옥탄 휘발유 성분) 원료. 정제 마진 국면 확인용.',
  },
  MB_nonTET_C3: {
    name: 'MB non-TET C3 (Mont Belvieu 비TET 프로판)', unit: '¢/gal',
    what: 'TET 외 저장시스템(주로 Energy Transfer LST) 인웰 프로판 가격. 통상 TET 대비 디스카운트.',
    use: 'TET−non-TET 프리미엄이 커지면 수출터미널·저장 병목(수출 호조) 신호. 2026년 평균 +3.4¢.',
  },
  MB_nonTET_nC4: {
    name: 'MB non-TET nC4 (비TET 노말부탄)', unit: '¢/gal',
    what: '비TET 저장시스템 노말부탄 인웰 가격.',
    use: 'TET nC4와 비교해 미국 부탄 물류 병목 확인.',
  },
  MB_nonTET_iC4: {
    name: 'MB non-TET iC4 (비TET 이소부탄)', unit: '¢/gal',
    what: '비TET 이소부탄 인웰 가격. 원 파일에서 TET iC4와 사실상 동일.',
    use: '참고용.',
  },
  C2: {
    name: 'Purity C2 (Mont Belvieu 순도 에탄)', unit: '¢/gal',
    what: '에탄(Ethane). E/P mix(에탄·프로판 혼합)와 구분되는 순도 에탄 인웰 가격.',
    use: '미국 크래커 원료 경제성과 에탄 수출 유인 지표. 에탄 약세 → 크래커가 에탄 선호 → 미국 프로판 석화 수요 감소.',
  },
  ARA_C3: {
    name: 'ARA C3 (Amsterdam·Rotterdam·Antwerp 프로판)', unit: '$/ton',
    what: '북서유럽 ARA 항만 인도 프로판 대형화물(CIF) 가격. 유럽 LPG 벤치마크.',
    use: 'FEI−ARA 스프레드 = 아시아 프리미엄. 벌어지면 미국·중동 화물이 아시아로 쏠리고 좁아지면 유럽으로 회귀.',
  },
  ARA_C4: {
    name: 'ARA C4 (북서유럽 부탄)', unit: '$/ton',
    what: 'ARA 인도 부탄 대형화물 가격.',
    use: '유럽 석화의 납사·부탄 대체 수요 확인.',
  },
  JKM: {
    name: 'JKM (Japan Korea Marker, LNG)', unit: '$/mmbtu',
    what: 'Platts 동북아(일본·한국) 도착 LNG 현물 평가가격. 아시아 LNG spot 벤치마크.',
    use: 'JKM−FEI(M−2) 스프레드로 LNG↔LPG 대체 경제성 판단. $1/mmbtu 변동 ≈ ₩15억.',
  },
  TTF: {
    name: 'TTF (Title Transfer Facility, 유럽 가스)', unit: '$/mmbtu',
    what: '네덜란드 TTF 가스 허브 선물 가격. 유럽 가스 벤치마크.',
    use: 'JKM−TTF 스프레드로 LNG 카고의 아시아 vs 유럽 유인 비교. 일별 파일 미제공(구 월 참조값만 2026-07까지).',
  },
  HH: {
    name: 'HH (Henry Hub, 미국 가스)', unit: '$/mmbtu',
    what: '미국 Henry Hub 천연가스 선물 가격. 미국 LNG 수출 원가의 기준.',
    use: 'JKM−HH로 미국 LNG 넷백 확인. 일별 파일 미제공(구 월 참조값만 2026-07까지).',
  },
  FRT_BALTIC: {
    name: 'Freight Baltic (발틱거래소 VLGC 운임)', unit: '$/ton',
    what: 'Baltic Exchange LPG 운임 평가. 라스타누라(중동)→치바(일본) 44kt VLGC 항로(BLPG1, 추정).',
    use: '중동→극동 운임. FOB CP + 운임 ≈ CFR 원가이므로 FEI−CP 스프레드와 함께 봐야 함.',
  },
  FRT_RIM: {
    name: 'Freight RIM (RIM Intelligence 운임)', unit: '$/ton',
    what: '일본 RIM Intelligence의 VLGC 운임 평가(항로 정의는 Odin 원본 확인 필요).',
    use: 'Baltic 운임과 교차 확인용. 2026년 Baltic 대비 변동폭이 작음.',
  },
};

/** 지표 설명 HTML (툴팁·카드 공용) */
export function descHtml(key, { compact = false } = {}) {
  const d = INDEX_DESC[key];
  if (!d) return '';
  const unit = d.unit ? `<span style="color:#8b949e"> · ${d.unit}</span>` : '';
  if (compact) return `<b>${d.name}</b>${unit}<br/>${d.what}`;
  return `<div style="max-width:320px;line-height:1.5">
    <div style="font-weight:700;margin-bottom:4px">${d.name}${unit}</div>
    <div style="color:#c9d1d9">${d.what}</div>
    <div style="color:#8b949e;margin-top:4px"><span style="color:#00d4ff">활용</span> ${d.use}</div>
  </div>`;
}

/** 지표 설명 plain text (title 속성·select option 용) */
export function descText(key) {
  const d = INDEX_DESC[key];
  return d ? `${d.name} (${d.unit})\n${d.what}\n활용: ${d.use}` : '';
}

// ── 공용 커스텀 툴팁 (data-tip-key 또는 data-tip-html 속성을 가진 요소에 자동 적용) ──
let tipEl = null;
function ensureTip() {
  if (tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = 'kb-tip';
  document.body.appendChild(tipEl);
  return tipEl;
}
function show(html, x, y) {
  const el = ensureTip();
  el.innerHTML = html;
  el.style.display = 'block';
  move(x, y);
}
function move(x, y) {
  if (!tipEl) return;
  const pad = 14, w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  let left = x + pad, top = y + pad;
  if (left + w > window.innerWidth - 8)  left = x - w - pad;
  if (top + h > window.innerHeight - 8)  top = y - h - pad;
  tipEl.style.left = `${Math.max(4, left)}px`;
  tipEl.style.top  = `${Math.max(4, top)}px`;
}
function hide() { if (tipEl) tipEl.style.display = 'none'; }

/** 문서 전체에 위임 방식으로 툴팁 바인딩 (한 번만 호출) */
export function initTooltips() {
  document.addEventListener('mouseover', e => {
    const t = e.target.closest('[data-tip-key],[data-tip-html]');
    if (!t) return;
    const html = t.dataset.tipHtml || descHtml(t.dataset.tipKey);
    if (html) show(html, e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', e => {
    if (tipEl && tipEl.style.display === 'block') move(e.clientX, e.clientY);
  });
  document.addEventListener('mouseout', e => {
    const t = e.target.closest('[data-tip-key],[data-tip-html]');
    if (t && !t.contains(e.relatedTarget)) hide();
  });
}
