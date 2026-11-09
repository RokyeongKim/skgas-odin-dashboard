#!/usr/bin/env python3
"""scripts/parse_odin_tsv.py — Odin 일별 가격표(TSV) → data/timeseries.json & data/prices_native.json

사용법:
    python3 scripts/parse_odin_tsv.py data/raw/odin_daily_*.tsv     # 여러 파일 → 날짜 기준 병합
    python3 scripts/parse_odin_tsv.py                               # 인자 없으면 data/raw/odin_daily_*.tsv 전부

입력 TSV 컬럼(헤더 없음, 탭 구분, 결측 '-'):
    Date | Brent | WTI | CP C3 | CP C4 | FEI C3 | FEI C4 | Purity C2 |
    MB non-TET C3 | nC4 | iC4 | MB TET C3 | nC4 | iC4 | ARA C3 | ARA C4 |
    Freight Baltic | Freight RIM | MOPJ | MOPS F/O 380cst | JKM

규칙 (CLAUDE.md):
  - 결측은 결측으로 둔다 (보간·캐리포워드 금지). 모든 값이 결측인 날짜는 제외.
  - 기존 timeseries.json 에만 있는 TTF/HH(월 단위 참조값)는 같은 날짜에 한해 그대로 유지.
  - 파일 > Notion 우선: 같은 날짜의 기존 값은 TSV 값으로 대체.
  - 여러 TSV 에 같은 날짜가 있으면 나중에 지정된(파일명 정렬상 뒤) 파일 값이 우선.
"""
import json, sys, os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_TS     = os.path.join(ROOT, 'data', 'timeseries.json')
OUT_NATIVE = os.path.join(ROOT, 'data', 'prices_native.json')
EVENTS     = os.path.join(ROOT, 'data', 'events.json')

# TSV 컬럼 순서 → native 키
COLS = ['Brent', 'WTI', 'CP', 'CP_C4', 'FEI', 'FEI_C4', 'C2',
        'MB_nonTET_C3', 'MB_nonTET_nC4', 'MB_nonTET_iC4',
        'MB', 'MB_nC4', 'MB_iC4',
        'ARA_C3', 'ARA_C4', 'FRT_BALTIC', 'FRT_RIM', 'MOPJ', 'FO380', 'JKM']
LEGACY_KEYS = ['TTF', 'HH']   # 기존 파일에서만 유지되는 키

# ─── 환산계수 ────────────────────────────────────────────────────────────────
LPG_MMBTU = 47.84      # KB 정본: LPG 1 ton = 47.84 mmbtu
LPG_BBL   = 8.2        # KB 정본: LPG 1 ton = 8.2 bbl
MB_TO_TON = 5.208      # KB 정본: 프로판 ¢/gal × 5.208 = $/ton
NV_COEF   = 0.42       # KB 정본: ¢/gal × 0.42 = $/bbl
# 참고 환산 (KB 정본 아님 — 발열량 기준, Panel A 표시용)
CPG_TO_MMBTU = {
    'MB': MB_TO_TON / LPG_MMBTU,   # 0.1089 (KB 정본)
    'MB_nonTET_C3': MB_TO_TON / LPG_MMBTU,
    'MB_nC4': 0.0971,              # n-butane ≈ 103,000 Btu/gal
    'MB_nonTET_nC4': 0.0971,
    'MB_iC4': 0.1010,              # isobutane ≈ 99,000 Btu/gal
    'MB_nonTET_iC4': 0.1010,
    'C2': 0.1517,                  # purity ethane ≈ 65,900 Btu/gal
}
FO_MMBTU_PER_TON = 40.5            # HSFO 380cst ≈ 6.35 bbl/ton × 6.38 mmbtu/bbl (참고)

def num(s):
    s = s.strip().replace(',', '')
    if s in ('', '-'):
        return None
    try:
        return float(s)
    except ValueError:
        return None

def r(v, d=3):
    return None if v is None else round(v, d)

def to_mmbtu(key, v):
    if v is None:
        return None
    if key in ('Brent', 'WTI'):
        return r(v / LPG_BBL)
    if key in ('FEI', 'FEI_C4', 'CP', 'CP_C4', 'ARA_C3', 'ARA_C4', 'MOPJ'):
        return r(v / LPG_MMBTU)
    if key in CPG_TO_MMBTU:
        return r(v * CPG_TO_MMBTU[key])
    if key == 'FO380':
        return r(v / FO_MMBTU_PER_TON)
    if key in ('JKM', 'TTF', 'HH'):
        return r(v)
    return None   # 운임 등 에너지 환산 불가

def read_tsv(path):
    rows = {}
    for line in open(path, encoding='utf-8'):
        parts = line.rstrip('\n').split('\t')
        if len(parts) < len(COLS) + 1:
            continue
        date = parts[0].strip()
        if not date or not date[:4].isdigit():
            continue
        native = {k: num(v) for k, v in zip(COLS, parts[1:len(COLS) + 1])}
        if all(v is None for v in native.values()):
            continue   # 공휴일 등 전부 결측 → 제외
        rows[date] = native
    return rows

def main(tsv_paths):
    legacy = {}
    if os.path.exists(OUT_TS):
        for rec in json.load(open(OUT_TS, encoding='utf-8')):
            legacy[rec['date']] = {k: rec['native'].get(k) for k in LEGACY_KEYS}

    merged = {}
    for path in sorted(tsv_paths):
        rows = read_tsv(path)
        print(f'{os.path.basename(path)}: {len(rows)} rows')
        merged.update(rows)

    records = []
    for date in sorted(merged):
        native = dict(merged[date])
        for k in LEGACY_KEYS:
            native[k] = legacy.get(date, {}).get(k)

        mmbtu = {k: to_mmbtu(k, v) for k, v in native.items()}
        brent, fei, mb, cp, mopj = (native[k] for k in ('Brent', 'FEI', 'MB', 'CP', 'MOPJ'))
        derived = {
            'CV':        r(fei / (brent * LPG_BBL), 4) if fei is not None and brent else None,
            'NV':        r(mb * NV_COEF / brent, 4)    if mb is not None and brent else None,
            'FEI_MOPJ':  r(fei / mopj, 4)              if fei is not None and mopj else None,
            'JKM_FEI_M2': None,                        # data.js 에서 43 영업일 lag 로 계산
            'MB_FEI':    r(mb * MB_TO_TON - fei, 1)    if mb is not None and fei is not None else None,
            'FEI_CP':    r(fei - cp, 1)                if fei is not None and cp is not None else None,
            'JKM_FEI_ODIN': None,                      # 일별 파일에는 미제공
            'CP_Brent':  r(cp / (brent * LPG_BBL), 4)  if cp is not None and brent else None,
            'FEI_C4_C3': r(native['FEI_C4'] - fei, 1)  if native['FEI_C4'] is not None and fei is not None else None,
            'MB_TET_PREM': r(mb - native['MB_nonTET_C3'], 4) if mb is not None and native['MB_nonTET_C3'] is not None else None,
        }
        records.append({
            'date': date, 'baseMonth': date[:7], 'source': 'file', 'tier': 1,
            'native': native, 'mmbtu': mmbtu, 'derived': derived,
        })

    records.sort(key=lambda x: x['date'])
    json.dump(records, open(OUT_TS, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'timeseries.json: {len(records)} records ({records[0]["date"]} ~ {records[-1]["date"]})')

    # ─── prices_native.json: 이벤트 시점 스냅샷 (가장 가까운 관측일) ────────────
    from datetime import date as D
    def dd(s): return D.fromisoformat(s)
    def nearest(target):
        return min(records, key=lambda rec: abs((dd(rec['date']) - dd(target)).days))
    last = records[-1]
    snap = {'current': {'date': last['date'], **last['native']}}
    events = json.load(open(EVENTS, encoding='utf-8')) if os.path.exists(EVENTS) else []
    lo, hi = records[0]['date'], records[-1]['date']
    for ev in events:
        if lo <= ev['date'] <= hi:
            rec = nearest(ev['date'])
            snap[ev['id']] = {'date': rec['date'], **rec['native']}
    json.dump(snap, open(OUT_NATIVE, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'prices_native.json: {len(snap) - 1} event snapshots + current')

if __name__ == '__main__':
    paths = sys.argv[1:] or glob.glob(os.path.join(ROOT, 'data', 'raw', 'odin_daily_*.tsv'))
    if not paths:
        sys.exit(__doc__)
    main(paths)
