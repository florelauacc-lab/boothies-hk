"""Look up full Chinese addresses for the taxi card via the HK Government Address Lookup Service (als.gov.hk).

Usage: python3 -I tools/zh_addresses.py
Reads data.js, queries ALS for places that have no Chinese address yet, and caches results in
tools/research/zh_addr.json (id -> {"zh": ..., "dist_m": ...}). A result is only kept when the building
ALS returns is close to the place's own map pin, so a wrong match never reaches a taxi driver.
"""
import json, math, pathlib, re, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / "research" / "zh_addr.json"
MAX_M = 130

data = json.loads((ROOT / "data.js").read_text()[len("window.HK = "):-2])
cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}


def fmt(chi):
    st = chi.get("ChiStreet") or {}
    no = st.get("BuildingNoFrom", "")
    if st.get("BuildingNoTo"):
        no += "-" + st["BuildingNoTo"]
    parts = [(chi.get("ChiDistrict") or {}).get("DcDistrict", "")]
    if st.get("StreetName"):
        parts.append(st["StreetName"] + (no + "號" if no else ""))
    if chi.get("ChiVillage"):
        v = chi["ChiVillage"]; parts.append(v.get("VillageName", "") + (v.get("BuildingNoFrom", "") and v["BuildingNoFrom"] + "號"))
    est = (chi.get("ChiEstate") or {}).get("EstateName")
    if est:
        parts.append(est)
    if chi.get("BuildingName"):
        parts.append(chi["BuildingName"])
    blk = chi.get("ChiBlock") or {}
    if blk.get("BlockNo") and not chi.get("BuildingName"):
        parts.append(blk["BlockNo"] + blk.get("BlockDescriptor", ""))
    return "".join(p for p in parts if p)


def dist(lat1, lng1, lat2, lng2):
    dy = (lat1 - lat2) * 111000
    dx = (lng1 - lng2) * 111000 * math.cos(math.radians(22.3))
    return math.hypot(dx, dy)


def query(text):
    url = "https://www.als.gov.hk/lookup?" + urllib.parse.urlencode({"q": text, "n": 3})
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "boothies-hk-guide/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


def lookup(p):
    qs = []
    if p.get("addressEn"):
        # drop shop/floor prefixes, ALS matches buildings and street numbers
        a = re.sub(r"^(shop|unit|flat)\s*[\w-]+,?\s*", "", p["addressEn"], flags=re.I)
        a = re.sub(r"\b(G/F|[0-9]+/F|LG/F|UG/F|B/F|Level \d+|Basement)\b,?", "", a, flags=re.I)
        qs.append(a)
    qs.append(f'{p["name"]} {p["area"]}')
    best = None
    for q in qs:
        try:
            res = query(q)
        except Exception as e:  # network hiccup: skip, next run retries
            return p["id"], {"error": str(e)[:80]}
        for s in res.get("SuggestedAddress", []):
            pa = s["Address"]["PremisesAddress"]
            g = pa.get("GeospatialInformation") or {}
            try:
                d = dist(p["lat"], p["lng"], float(g["Latitude"]), float(g["Longitude"]))
            except (KeyError, ValueError, TypeError):
                continue
            if d <= MAX_M and (best is None or d < best["dist_m"]):
                best = {"zh": fmt(pa["ChiPremisesAddress"]), "dist_m": round(d), "q": q}
        if best:
            break
        time.sleep(0.2)
    return p["id"], best or {"none": True}


todo = [p for p in data["PLACES"] if p.get("lat") is not None and not p.get("addressZh")
        and p["tab"] not in ("hikes",) and p["id"] not in cache]
print(f"looking up {len(todo)} places…")
with ThreadPoolExecutor(max_workers=4) as ex:
    for pid, res in ex.map(lookup, todo):
        cache[pid] = res
CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1))
ok = sum(1 for v in cache.values() if v.get("zh"))
print(f"cached {len(cache)} · with Chinese address: {ok}")
