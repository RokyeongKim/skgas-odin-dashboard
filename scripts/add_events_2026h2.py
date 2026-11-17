#!/usr/bin/env python3
"""2026-07-23 ~ 2026-11-16 이벤트 추가 + 전 이벤트에 level(1 주요 / 2 중간 / 3 세부) 부여.

level 의미 (Panel A 플래그 상세도):
  1 = 굵직한 전환점 (1Y 이상 보기에서도 표시)
  2 = 중간 뉴스 (6M·3M 보기에서 표시)
  3 = 세부 (1M·3M 보기; 데이터 감지 급변일 ⚡ 은 런타임에 panelA 가 자동 생성)
신규 이벤트는 공개 뉴스 기반 → tier 2 + flag:true (핀 표시) + source:'web'.
"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'data', 'events.json')
ev = json.load(open(P, encoding='utf-8'))

LEVEL1 = {'war_start', 'hormuz_close_1', 'ceasefire1', 'hormuz_close_2', 'mou_signed', 'mou_end', 'strait_close'}
LEVEL2 = {'hormuz_reopen_1', 'talks_fail', 'mou_news', 'qatar_damage', 'strait_open', 'iran_escalate', 'iran_mou_stop', 'houthi_ban', 'maduro_arrest'}
for e in ev:
    if 'level' in e: continue
    if e['id'] in LEVEL1: e['level'] = 1
    elif e['id'] in LEVEL2: e['level'] = 2
    elif e.get('flag'): e['level'] = 1          # 과거 JKM 급등 배경 등 (Tier2 flag)
    elif e.get('tier') == 1: e['level'] = 1
    else: e['level'] = 2                        # 핀 없는 Tier2 참조 이벤트

UP = '공급차단형'; DOWN = '수요파괴형'; REL = '유통재배치형'
def mk(id, date, label, arche, channels, level, note, type_='war', color=None):
    c = color or {UP: '#ff5555', DOWN: '#4ade80', REL: '#ff8844'}[arche]
    return dict(id=id, date=date, end_date=None, label=label, archetype=arche, channels=channels, tier=2, flag=True,
                level=level, color=c, type=type_, is_band=False, source='web', note=note)

NEW = [
  mk('brent_100_0723', '2026-07-23', 'Brent $100 재돌파 — 후티 홍해 사우디 유조선 공격 + 트럼프 "대규모 공격" 위협', UP, ['brent', 'lpg'], 1,
     'Brent 100.69 (5/26 이후 첫 100 상회, 전일比 +7%). FEI 809.5 로 동반 상승. 출처: CNBC 7/23.'),
  mk('strikes_pause_0727', '2026-07-27', '美·이란, 호르무즈 교전 일시 중지 → Brent −8.7%', DOWN, ['brent', 'lpg'], 1,
     'Brent 96.78→88.36, FEI −7.6%(717.5). 전면전 재격화(7/18) 열흘 만의 숨고르기. 출처: Euronews 7/27.', 'ceasefire'),
  mk('bessent_deal_0804', '2026-08-04', '베센트 "호르무즈 합의 이번 주 가능" → Brent 이틀간 −12%', DOWN, ['brent', 'lpg'], 1,
     '8/3 −7.0%, 8/4 −5.3% (79.36). 합의 불발 → 8/10 +5% 반등(87.72). 이후 "합의 임박 발언 → 급락 → 불발 → 반등" 패턴 반복의 시작. 출처: CNBC 8/4, 8/10.', 'ceasefire'),
  mk('deal_doubt_0810', '2026-08-10', '호르무즈 합의 불확실 → Brent +5% 반등 (87.72)', UP, ['brent'], 2,
     '이란 "조건 충족 전 해협 개방 없다". 8/11 WTI 83 상회. 출처: CNBC 8/10·8/11, Al Jazeera 8/10.'),
  mk('blockade_indef_0814', '2026-08-14', '美 "이란 항만 해상봉쇄 무기한 지속" → Brent 88.5', UP, ['brent'], 2,
     '美 국무부, 이란 "경제적 고립" 위협. 출처: CNBC 8/14.', 'sanction'),
  mk('sanctions_0820', '2026-08-20', '베센트 "경제 압박으로 이란 붕괴" — 사상 최강 제재 패키지 → Brent 93.8', UP, ['brent'], 2,
     '8/20 +2.4%(93.78). 8/24 제재 공식 발표 후 오히려 −2.5%(92.06) "재료 소진". 출처: CNBC 8/20·8/24.', 'sanction'),
  mk('kuwait_missile_0903', '2026-09-03', '이란, 쿠웨이트에 미사일 발사 — 걸프 교전 재개', UP, ['brent', 'lpg'], 2,
     'Brent 95 근처. 8월 "합의 기대" 국면 종료. 출처: CNBC 9/3.'),
  mk('tanker_sink_0910', '2026-09-10', '美, 이란 유조선 5척 격침 → 걸프 교전 격화, Brent 107 (+6.3%)', UP, ['brent', 'lpg', 'lng'], 1,
     '9/9 Brent 101(5월 이후 최고) → 9/10 107.63. 美 군함 공격 시도에 대한 보복. 골드만 "Brent 120 상회 확률 상승". FEI 895, JKM 28.8. 출처: CNBC 9/9.'),
  mk('hormuz_clearing_0914', '2026-09-14', '美 "호르무즈 통항 정리 중" 주장에도 Brent 107 유지 — 선박·사우디 인프라 공격 지속', UP, ['brent', 'lpg'], 2,
     '전문가 "통항은 여전히 극히 제한적". 출처: Al Jazeera 9/14.'),
  mk('trump_reject_0928', '2026-09-28', '트럼프, 이란 "7일 내 호르무즈 재개방" 제안 거부 → Brent +3% (107)', UP, ['brent', 'lpg'], 2,
     '이란 측 제안: 7일 내 해협 재개방. 거부 후 10월 "중간선거 후 공습" 리스크 프리미엄 축적 시작. 출처: Al Jazeera 9/28.'),
  mk('houthi_saudi_1005', '2026-10-05', '후티, 2022년 이후 첫 사우디 본토 공격 — 리야드 동부 펌프장 피해로 원유 흐름 중단', UP, ['brent', 'lpg'], 2,
     '사우디 연합군의 사나 공습에 대한 보복. 10/4 리야드 남부 아람코 시설 화재. 출처: ABC 10/4, The National.'),
  mk('tanker_hurricane_1008', '2026-10-08', '이란 유조선 공격 확대 + 美 걸프 허리케인 → Brent +4% (104.3), MB +5%', UP, ['brent', 'lpg'], 2,
     '호르무즈 통과 950만 b/d(전쟁 전 대비 −30%, Kpler). 10/9 트럼프 "중간선거 전 이란 공습 없다" → 103.5. 출처: CNBC 10/8, Vantage 10/9.'),
  mk('houthi_aramco_1013', '2026-10-13', '후티, 아람코 시설 타격 (사우디 연합군 사나 유류시설 공습 수시간 후)', UP, ['brent', 'lpg'], 2,
     '후티 "아람코 시설·공항 계속 공격" 경고. 출처: Al Jazeera 10/13.'),
  mk('shaybah_1022', '2026-10-22', '샤이바 유전 인근 후티 드론 공격 → Brent $110 돌파 (113.2)', UP, ['brent', 'lpg'], 2,
     'FEI 968, JKM 30.8. 출처: The National 10/22.'),
  mk('brent_117_1023', '2026-10-23', '후티 사우디 연쇄 공격 + 이란 유조선 공격 → Brent 117 (4월 이후 최고)', UP, ['brent', 'lpg', 'lng'], 1,
     'Brent 116.72 (6개월 최고). 10월 한 달 +10% 이상 — 시장이 "중간선거 후 대규모 공습" 을 선반영. 출처: The National 10/23, EnergyNow.'),
  mk('saudi_tehran_1026', '2026-10-26', '사우디 국방장관 테헤란 방문 (긴장 완화 모색) — Brent 115.8 로 소폭 하락', DOWN, ['brent'], 2,
     '메카 방위동맹(사우디·파키스탄·튀르키예) 중재 시도. 장중 117 터치 후 반락. 출처: CNBC 10/26·10/27.', 'ceasefire'),
  mk('houthi_refinery_1028', '2026-10-28', '후티, 라스타누라·라빅 정유시설 + 아브카이크 타격 주장 → Brent 115.5', UP, ['brent', 'lpg'], 2,
     '사우디 미확인. 美, 사우디 내 비필수 정부인력 철수 명령. 출처: CNBC 10/28, OilPrice.'),
  mk('fei_record_1030', '2026-10-30', '후티 사우디 6건 동시 공격 주장 — FEI 1,113 사상 최고, JKM 34.1, Brent 117.6', UP, ['brent', 'lpg', 'lng'], 1,
     '12월물 만기일 겹침. 아시아 LPG 현물(FEI)·MB 동반 +6~7%: 중동 LPG 수출 전쟁 전 대비 절반 이하 상태에서 사우디 리스크까지 가세. 출처: Al Jazeera 10/30, Alupetra.'),
  mk('peace_draft_1102', '2026-11-02', '美·이란 종전 초안 회람 → Brent −7.6% (중간선거 전날)', DOWN, ['brent', 'lpg', 'lng'], 1,
     '이란 협상단 카타르 출국 후 초안 유출. 동일 계약 기준 −7.6%(104.77), 12→1월물 롤 포함 시 −11%. FEI 1,107 로 유가와 달리 아직 미반응(LPG 공급 차질은 미해소). 출처: CNBC·Bloomberg·OilPrice 11/2.', 'ceasefire'),
  mk('qeshm_1103', '2026-11-03', '美, 이란 케슘섬 타격 보도 — 그래도 Brent 2일 연속 하락 (103.6)', DOWN, ['brent'], 2,
     '시장이 군사 뉴스보다 협상 뉴스에 반응하기 시작. 11/3 美 중간선거. 출처: CNBC 11/3.', 'ceasefire'),
  mk('brent_sub100_1104', '2026-11-04', 'Brent $100 하회 (94.6, −8.7%) — 합의 기대가 EIA 재고 감소 상쇄', DOWN, ['brent', 'lpg'], 2,
     '중간선거 직후. 10월에 쌓인 "선거 후 공습" 프리미엄 소멸. MB −8%, FEI는 11/5 −6.6% 로 하루 늦게 반응. 출처: Invezz 11/4.', 'ceasefire'),
  mk('brent_below90_1110', '2026-11-10', 'Brent $90 하회 (8월 이후 처음) — 주간 −16%, 2020년 이후 최대 낙폭', DOWN, ['brent', 'lpg', 'lng'], 1,
     '11/9 −5.8%(92.57) 루비오 "돌파구 가능성 낮다" 에도 하락 지속. FEI 962 (10/30 고점 대비 −14%), JKM 27.9. 출처: CNBC 11/10, Bloomberg 11/9.', 'ceasefire'),
  mk('iran_deny_1111', '2026-11-11', '이란 안보수장 "美와 협상 없다" → Brent +1.4% 반등 (92.8)', UP, ['brent'], 2,
     '"농축 물질 단 한 톨도 반출 불가". 출처: OilPrice·Reuters 11/11.'),
  mk('trump_nodeal_1112', '2026-11-12', '트럼프 "이란과 딜 필요 없다, 해협은 우리가 쥐고 있다" → 유가 반등 (11/13 Brent 95.8)', UP, ['brent', 'lpg'], 2,
     '같은 날 우크라이나 평화협상 기대로 장중 −1% 후 반전. 11/16 Brent 92.4, FEI 975, JKM 29.3. 출처: CNBC 11/12, Rigzone 11/13.'),
]
ids = {e['id'] for e in ev}
added = 0
for n in NEW:
    if n['id'] in ids: continue
    ev.append(n); added += 1
ev.sort(key=lambda e: (e['date'], e['id']))
json.dump(ev, open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
from collections import Counter
print(f'added {added}, total {len(ev)}, levels', Counter(e["level"] for e in ev))
