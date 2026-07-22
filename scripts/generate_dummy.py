#!/usr/bin/env python3
"""
generate_dummy.py — Odin 실데이터 연결 전까지 사용하는 dummy 시계열 생성.
실데이터 준비 시 data/timeseries.json 및 data/prices_native.json을 직접 교체하면 됨.
"""
import json
import math
import random
from datetime import date, timedelta

random.seed(42)

def business_days(start: date, end: date):
    """Returns list of business days (Mon-Fri) between start and end inclusive."""
    days = []
    cur = start
    while cur <= end:
        if cur.weekday() < 5:  # 0=Mon ... 4=Fri
            days.append(cur.isoformat())
        cur += timedelta(days=1)
    return days

def random_walk(start_val, days_count, volatility=0.012, mean_reversion=0.01, mean_val=None):
    """Mean-reverting random walk."""
    if mean_val is None:
        mean_val = start_val
    vals = [start_val]
    for _ in range(days_count - 1):
        shock = random.gauss(0, volatility) * vals[-1]
        revert = mean_reversion * (mean_val - vals[-1])
        vals.append(max(vals[-1] + shock + revert, mean_val * 0.4))
    return vals

def add_event_impact(vals, dates, event_date_str, impact, decay=0.05):
    """Add price spike/drop at an event date with exponential decay."""
    try:
        idx = dates.index(event_date_str)
    except ValueError:
        return vals
    result = list(vals)
    direction = 1 if impact > 0 else -1
    magnitude = abs(impact)
    for i in range(idx, min(idx + 30, len(result))):
        result[i] *= (1 + direction * magnitude * math.exp(-decay * (i - idx)))
    return result

START = date(2023, 7, 1)
END   = date(2026, 7, 23)
dates = business_days(START, END)
n = len(dates)

# ---- Base price series (native units) ----
# FEI: $/ton  (~500-650)
fei  = random_walk(560, n, 0.010, 0.008, 560)
# CP: $/ton   (~480-630)
cp   = random_walk(530, n, 0.010, 0.008, 530)
# MOPJ: $/ton (~600-850, naphtha)
mopj = random_walk(700, n, 0.012, 0.008, 700)
# MB: ¢/gal   (~80-120)
mb   = random_walk(95, n, 0.011, 0.008, 95)
# Brent: $/bbl (~65-90)
brent = random_walk(75, n, 0.013, 0.009, 75)
# JKM: $/mmbtu (~10-20)
jkm   = random_walk(13, n, 0.015, 0.010, 13)
# TTF: $/mmbtu (~9-18)
ttf   = random_walk(11, n, 0.015, 0.010, 11)
# HH: $/mmbtu (~2-4)
hh    = random_walk(2.8, n, 0.015, 0.012, 2.8)

# ---- Apply geopolitical event impacts ----
# war_start 2026-02-28: Brent +15%, JKM +12%, FEI +8%
brent = add_event_impact(brent, dates, '2026-02-28', +0.15)
jkm   = add_event_impact(jkm,   dates, '2026-02-28', +0.12)
ttf   = add_event_impact(ttf,   dates, '2026-02-28', +0.10)
fei   = add_event_impact(fei,   dates, '2026-02-28', +0.08)
cp    = add_event_impact(cp,    dates, '2026-02-28', +0.08)

# ceasefire1 2026-04-08: Brent -8%, JKM -7%
brent = add_event_impact(brent, dates, '2026-04-08', -0.08)
jkm   = add_event_impact(jkm,   dates, '2026-04-08', -0.07)

# mou_signed 2026-06-17: Brent -10%, JKM -9%
brent = add_event_impact(brent, dates, '2026-06-17', -0.10)
jkm   = add_event_impact(jkm,   dates, '2026-06-17', -0.09)
ttf   = add_event_impact(ttf,   dates, '2026-06-17', -0.07)

# strait_close 2026-07-11: Brent +20%, JKM +15%, FEI +12%
brent = add_event_impact(brent, dates, '2026-07-11', +0.20)
jkm   = add_event_impact(jkm,   dates, '2026-07-11', +0.15)
fei   = add_event_impact(fei,   dates, '2026-07-11', +0.12)
cp    = add_event_impact(cp,    dates, '2026-07-11', +0.12)
ttf   = add_event_impact(ttf,   dates, '2026-07-11', +0.12)

# strait_open 2026-07-15: partial reversal
brent = add_event_impact(brent, dates, '2026-07-15', -0.08)
jkm   = add_event_impact(jkm,   dates, '2026-07-15', -0.06)

# iran_escalate 2026-07-18: Brent +18%, JKM +13%
brent = add_event_impact(brent, dates, '2026-07-18', +0.18)
jkm   = add_event_impact(jkm,   dates, '2026-07-18', +0.13)
fei   = add_event_impact(fei,   dates, '2026-07-18', +0.10)

# ---- Convert to $/mmbtu for timeseries.json ----
LPG_MMBTU = 47.84
LNG_MMBTU = 51.876
MB_TO_TON  = 5.208
LPG_TO_BBL = 8.2

def r(v, d=2):
    return round(v, d)

records = []
for i, d in enumerate(dates):
    records.append({
        "date":  d,
        "native": {
            "Brent": r(brent[i], 2),
            "FEI":   r(fei[i], 2),
            "CP":    r(cp[i], 2),
            "MOPJ":  r(mopj[i], 2),
            "MB":    r(mb[i], 2),
            "JKM":   r(jkm[i], 3),
            "TTF":   r(ttf[i], 3),
            "HH":    r(hh[i], 3),
        },
        "mmbtu": {
            "Brent": r(brent[i] / LPG_TO_BBL, 3),
            "FEI":   r(fei[i] / LPG_MMBTU, 3),
            "CP":    r(cp[i] / LPG_MMBTU, 3),
            "MOPJ":  r(mopj[i] / LPG_MMBTU, 3),
            "MB":    r(mb[i] * MB_TO_TON / LPG_MMBTU, 3),
            "JKM":   r(jkm[i], 3),
            "TTF":   r(ttf[i], 3),
            "HH":    r(hh[i], 3),
        },
        "derived": {
            "CV":          r(fei[i] / (brent[i] * LPG_TO_BBL), 4),
            "NV":          r((mb[i] * 0.42) / brent[i], 4),
            "FEI_MOPJ":    r(fei[i] / mopj[i], 4),
            "JKM_FEI_M2":  None,  # requires 2-month lag, computed in data.js
        }
    })

print(f"Generated {len(records)} records from {records[0]['date']} to {records[-1]['date']}")
with open("data/timeseries.json", "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False)
print("Saved data/timeseries.json")

# ---- prices_native.json: index price at each event date ----
event_dates = [
    ("war_start",    "2026-02-28"),
    ("ceasefire1",   "2026-04-08"),
    ("mou_news",     "2026-06-12"),
    ("mou_signed",   "2026-06-17"),
    ("mou_end",      "2026-07-08"),
    ("strait_close", "2026-07-11"),
    ("strait_open",  "2026-07-15"),
    ("iran_escalate","2026-07-18"),
]

prices_native = {}
for ev_id, ev_date in event_dates:
    # find closest business day
    try:
        idx = dates.index(ev_date)
    except ValueError:
        # find nearest
        target = date.fromisoformat(ev_date)
        nearest = min(dates, key=lambda d: abs(date.fromisoformat(d) - target))
        idx = dates.index(nearest)
    rec = records[idx]
    prices_native[ev_id] = {
        "date": rec["date"],
        **rec["native"]
    }

# also add "current" (last record)
prices_native["current"] = {
    "date": records[-1]["date"],
    **records[-1]["native"]
}

with open("data/prices_native.json", "w", encoding="utf-8") as f:
    json.dump(prices_native, f, ensure_ascii=False, indent=2)
print("Saved data/prices_native.json")
