"""Turn the research JSON files into data.js for the site.

Usage: python3 -I tools/build_data.py <research-folder>
Reads city.json, saiwan.json, sights.json, outdoors_shop.json, taste.json (any missing are skipped)
and the hand-written extras in tools/extras.json, then writes data.js next to index.html.
"""
import json, re, sys, pathlib

SRC = pathlib.Path(sys.argv[1])
ROOT = pathlib.Path(__file__).resolve().parent.parent
EXTRAS = json.loads((ROOT / "tools" / "extras.json").read_text())


def load(name):
    p = SRC / name
    return json.loads(p.read_text()) if p.exists() else None


def slug(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s[:40] or "x"


def clean(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip()
        return None if v.lower() in ("", "unknown", "n/a", "none") else v
    if isinstance(v, list):
        out = [clean(x) for x in v]
        return [x for x in out if x]
    return v


def cats(raw, allowed):
    out = []
    for c in raw or []:
        c = {"brunch": "lunch"}.get(c, c)
        if c in allowed and c not in out:
            out.append(c)
    return out or [allowed[0]]


FOOD = ["dinner", "lunch", "dessert", "drinks", "late-night"]
SHOP_CATS = ["luxury", "jewellery", "malls", "gifts", "tax-free", "local", "design"]
places, seen = [], set()


def add(p):
    base = p["id"] = slug(p["name"])
    n = 2
    while p["id"] in seen:
        p["id"] = f"{base}-{n}"; n += 1
    seen.add(p["id"])
    for k in list(p):
        p[k] = clean(p[k])
        if p[k] is None:
            del p[k]
    places.append(p)


CJK = re.compile(r"[\u3000-\u9fff\uff00-\uffef]")


def split_addr(a):
    """'Shop 1, ... Sai Ying Pun (西營盤...)' -> (english, chinese)"""
    if not a:
        return None, None
    m = re.search(r"[(（]([^()（）]*[\u4e00-\u9fff][^()（）]*)[)）]\s*$", a)
    if m:
        return a[: m.start()].strip(), m.group(1).strip()
    return (None, a) if CJK.search(a) else (a, None)


def split_name(n):
    """'Drunk N' Jump 跳海酒館（香港中環店）' -> ('Drunk N' Jump', '跳海酒館（香港中環店）')"""
    m = CJK.search(n)
    if not m or m.start() == 0:
        return n.strip(), None
    return n[: m.start()].strip(" -·|"), n[m.start():].strip()


def norm(n):
    return re.sub(r"[^a-z0-9]", "", split_name(n)[0].lower().replace("the ", ""))


def short_area(a):
    return re.split(r"\s*[(（]", a or "")[0].strip() or "Hong Kong"


LINK_NAMES = [("droneandslr", "Drone & DSLR guide"), ("hongkonghike", "HongKongHike guide"), ("alltrails", "AllTrails map"),
              ("discoverhongkong", "Discover HK guide"), ("metrotrekker", "MetroTrekker guide"), ("hikerhero", "HikerHero guide"),
              ("localiiz", "Localiiz guide"), ("beckyexploring", "Becky Exploring guide"), ("hellohongkong", "Hello HK guide"),
              ("roundislandtrail", "Official trail guide"), ("afcd.gov", "Country park info"), ("lcsd.gov", "Official trail guide"),
              ("mstravelsolo", "Travel blog"), ("hjkhiking", "Hiking blog"), ("wikipedia", "Wikipedia")]
def guide_links(urls):
    out = []
    for u in urls or []:
        if not u.startswith("http") or u.endswith(".pdf") or "/zh/" in u:
            continue
        label = next((n for k, n in LINK_NAMES if k in u), None)
        if label and label not in [l["label"] for l in out]:
            out.append({"label": label, "url": u})
    return out[:3]


# ---------- Sai Wan ----------
sw = load("saiwan.json") or []
sw_names = set()
for x in sw:
    name = clean(x.get("name_en")) or clean(x.get("name_zh"))
    sw_names.add(name.lower())
    if x.get("lat") is None:
        continue
    c = cats(x.get("category"), FOOD)
    add({
        "tab": "saiwan", "name": name, "zh": x.get("name_zh"), "area": short_area(x.get("area")),
        "section": x.get("section") or ("Drinks" if c[0] == "drinks" else "Dessert" if c[0] == "dessert" else "Eat"),
        "cuisine": x.get("cuisine"), "category": c, "price": x.get("price"),
        "intro": x.get("intro"), "order": x.get("must_order"), "reviews": x.get("reviews"),
        "group": x.get("group_friendly"), "hours": x.get("hours_note"), "status": x.get("status"),
        "phone": x.get("phone"), "openrice": x.get("openrice_url") or x.get("openrice"),
        "addressZh": split_addr(x.get("address"))[1], "addressEn": split_addr(x.get("address"))[0],
        "priceNote": x.get("price_note"),
        "flags": ["Check it's open first"] if x.get("status") == "unclear" else None,
        "lat": x.get("lat"), "lng": x.get("lng"), "local": bool(x.get("local")), "emoji": x.get("emoji"),
        "mapsQuery": x.get("maps_query"),
    })

# ---------- Citywide eat & drink ----------
for x in load("city.json") or []:
    if x.get("lat") is None:
        continue
    sec = re.sub(r"^(EAT|DRINK)\s*[–-]\s*", "", x.get("section", ""))
    is_drink = x.get("section", "").startswith("DRINK")
    area = short_area(x.get("area"))
    tab = "saiwan" if area.startswith(("Sai Ying Pun", "Kennedy Town", "Shek Tong Tsui")) else "city"
    if tab == "saiwan" and any(w in x["name"].lower() for w in ["ping pong"]) and any("ping pong" in n for n in sw_names):
        continue  # already in the Sai Wan list
    c = cats(x.get("category"), FOOD)
    if is_drink and "drinks" in c:
        c.remove("drinks"); c.insert(0, "drinks")
    add({
        "tab": tab, "name": x["name"], "zh": x.get("name_zh"), "area": area,
        "section": {"Seafood / Tai Pai Dong": "Seafood & dai pai dong", "LKF/Soho bar hopping": "LKF & Soho bars",
                    "Clubbing/Dancing": "Clubbing", "Closing dinner venue": "Closing dinner"}.get(sec, sec),
        "cuisine": x.get("cuisine"), "category": c, "price": x.get("price"),
        "intro": x.get("intro"), "order": x.get("must_order"), "reviews": x.get("reviews"),
        "group": x.get("group_friendly"), "status": x.get("status"), "phone": x.get("phone"),
        "addressEn": x.get("area"), "lat": x.get("lat"), "lng": x.get("lng"),
        "mapsQuery": x.get("maps_query"), "local": sec in ("Local eats", "Seafood / Tai Pai Dong"),
    })

# ---------- Sour fish (酸菜魚) ----------
for x in load("sourfish.json") or []:
    if x.get("lat") is None or x.get("status") == "closed":
        continue
    area = short_area(x.get("area"))
    add({
        "tab": "saiwan" if area.startswith(("Sai Ying Pun", "Kennedy Town", "Shek Tong Tsui")) else "city",
        "name": x["name"], "zh": x.get("name_zh"), "area": area, "section": "Sour fish", "cuisine": x.get("cuisine"),
        "category": cats(x.get("category"), FOOD), "price": x.get("price"), "intro": x.get("intro"), "order": x.get("must_order"),
        "reviews": x.get("reviews"), "tips": x.get("tips"), "addressEn": x.get("address_en"), "addressZh": x.get("address_zh"),
        "lat": x["lat"], "lng": x["lng"], "emoji": "🐟",
        "flags": ["Check it's open first"] if x.get("status") == "unclear" else None,
    })

# ---------- Coffee ----------
for x in load("coffee.json") or []:
    if x.get("lat") is None or x.get("status") == "closed":
        continue
    if any(norm(p["name"]) == norm(x["name"]) for p in places):
        continue
    area = short_area(x.get("area"))
    add({
        "tab": "saiwan" if area.startswith(("Sai Ying Pun", "Kennedy Town", "Shek Tong Tsui")) else "city",
        "name": x["name"], "zh": x.get("name_zh"), "area": area, "section": "Coffee", "cuisine": x.get("cuisine") or "Specialty coffee",
        "category": ["coffee"] + cats(x.get("category"), FOOD), "price": x.get("price"), "intro": x.get("intro"), "order": x.get("must_order"),
        "reviews": x.get("reviews"), "tips": x.get("tips"), "hours": x.get("hours"), "addressEn": x.get("address_en"),
        "addressZh": x.get("address_zh"), "lat": x["lat"], "lng": x["lng"], "emoji": "☕",
        "flags": ["Check it's open first"] if x.get("status") == "unclear" else None,
    })

# ---------- Iconic local institutions ----------
UNSOURCED_FACTS = {"mak's noodle", "yuen kee dessert", "yee shun milk company", "kung wo beancurd factory"}
for x in load("locals.json") or []:
    if x.get("lat") is None or x.get("status") == "closed":
        continue
    if any(norm(p["name"])[:8] == norm(x["name"])[:8] for p in places):
        continue  # already covered (e.g. Kwan Kee, Sun Hing in the Sai Wan list)
    if x["name"].lower() in UNSOURCED_FACTS:
        x["fun_fact"] = None
    area = short_area(x.get("area"))
    add({
        "tab": "saiwan" if area.startswith(("Sai Ying Pun", "Kennedy Town", "Shek Tong Tsui")) else "city",
        "flags": ["Check it's open first"] if x.get("status") == "unclear" else None, "name": x["name"], "zh": x.get("name_zh"), "area": area,
        "section": "Local legends", "cuisine": x.get("cuisine"), "category": cats(x.get("category"), FOOD),
        "price": x.get("price"), "intro": x.get("intro"), "funFact": x.get("fun_fact"), "order": x.get("must_order"),
        "reviews": x.get("reviews"), "tips": x.get("tips"), "hours": x.get("hours"),
        "addressEn": x.get("address_en"), "addressZh": x.get("address_zh"), "lat": x["lat"], "lng": x["lng"],
        "mapsQuery": x.get("maps_query"), "local": True, "status": x.get("status"),
    })

# ---------- Vegan / vegetarian ----------
veg = load("veg.json") or {}
for x in veg.get("places", []):
    if x.get("lat") is None or not str(x.get("status")).lower().startswith("open"):
        continue
    area = short_area(x.get("area"))
    add({
        "tab": "saiwan" if area.startswith(("Sai Ying Pun", "Kennedy Town", "Shek Tong Tsui")) else "city",
        "name": x["name"], "zh": x.get("name_zh"), "area": area, "section": "Vegan & vegetarian",
        "cuisine": x.get("cuisine"), "category": cats(x.get("category"), FOOD), "price": x.get("price"),
        "intro": x.get("intro"), "order": x.get("must_order"), "reviews": x.get("reviews"),
        "addressEn": x.get("address_en"), "addressZh": x.get("address_zh"), "lat": x["lat"], "lng": x["lng"],
        "mapsQuery": x.get("maps_query"), "veg": x.get("vegan") or "vegetarian", "emoji": "🥬",
    })

# ---------- Round 2: TST picks, Thursday dinner, diamond jewellers ----------
r2 = load("round2.json") or {}
before_r2 = list(places)
for x in r2.get("places", []):
    if x.get("lat") is None or x.get("group") == "A" or str(x.get("status", "")).lower().startswith(("closed", "unclear")):
        continue
    shop = x.get("group") == "B"
    area = short_area(x.get("area"))
    dup = next((p for p in before_r2 if norm(p["name"])[:6] == norm(x["name"])[:6] and p["tab"] in ("city", "shop")), None)
    if dup:  # newer research wins for the fields it has
        for k, v in (("intro", x.get("intro")), ("order", x.get("must_order")), ("addressZh", x.get("address_zh")), ("addressEn", x.get("address_en"))):
            if clean(v):
                dup[k] = v
        continue
    add({
        "tab": "shop" if shop else "city", "name": x["name"], "zh": x.get("name_zh"), "area": area,
        "section": {"C": "Across the harbour", "D": "Class dinner"}.get(x.get("group"), None),
        "cuisine": x.get("cuisine"), "category": cats(x.get("category"), SHOP_CATS if shop else FOOD),
        "price": x.get("price"), "intro": x.get("intro"), "order": x.get("must_order"), "reviews": x.get("reviews"),
        "tips": x.get("tips"), "phone": x.get("phone"), "addressEn": x.get("address_en"), "addressZh": x.get("address_zh"),
        "lat": x["lat"], "lng": x["lng"], "mapsQuery": x.get("maps_query"), "picked": x.get("group") == "D",
    })

# ---------- Classic HK foods near Booth ----------
for x in load("saiwan_classics.json") or []:
    if x.get("lat") is None or x.get("status") == "closed":
        continue
    if any(norm(p["name"])[:8] == norm(x["name"])[:8] for p in places):
        continue
    add({
        "tab": "saiwan", "name": x["name"], "zh": x.get("name_zh"), "area": short_area(x.get("area")),
        "section": "HK classics", "cuisine": x.get("cuisine"), "category": cats(x.get("category"), FOOD),
        "price": x.get("price"), "intro": x.get("intro"), "order": x.get("must_order"), "reviews": x.get("reviews"),
        "tips": x.get("tips"), "addressEn": x.get("address_en"), "addressZh": x.get("address_zh"),
        "lat": x["lat"], "lng": x["lng"], "local": True, "classic": x.get("food"),
        "flags": ["Check it's open first"] if x.get("status") == "unclear" else None,
    })

# ---------- Souvenir shops ----------
for x in load("souvenirs.json") or []:
    if x.get("lat") is None or x.get("status") == "closed":
        continue
    if any(norm(p["name"])[:8] == norm(x["name"])[:8] for p in places):
        continue
    add({
        "tab": "shop", "name": x["name"], "zh": x.get("name_zh"), "area": short_area(x.get("area")),
        "cuisine": x.get("cuisine") or "Souvenirs", "category": ["gifts"] + [c for c in cats(x.get("category"), SHOP_CATS) if c != "gifts"],
        "intro": x.get("intro"), "order": x.get("must_order"), "tips": x.get("tips"), "hours": x.get("hours"),
        "addressEn": x.get("address_en"), "addressZh": x.get("address_zh"), "lat": x["lat"], "lng": x["lng"], "emoji": "🎁",
        "flags": ["Check it's open first"] if x.get("status") == "unclear" else None,
    })

# ---------- Stanley (Monday's dragon boating) ----------
for x in load("stanley.json") or []:
    if x.get("lat") is None or x.get("status") == "closed":
        continue
    if any(norm(p["name"]) == norm(x["name"]) for p in places):
        continue
    food = x.get("kind") == "food"
    if x.get("kind") == "hike":
        facts = [[k, v] for k, v in (("Distance", f'{x["distance_km"]} km' if clean(x.get("distance_km")) else None),
                                      ("Time", x.get("duration")), ("Level", x.get("difficulty"))) if clean(v)]
        lvl = (x.get("difficulty") or "").lower()
        add({"tab": "hikes", "name": x["name"], "zh": x.get("name_zh"), "area": short_area(x.get("area") or "Stanley"),
             "cuisine": f'{x.get("difficulty") or "Short"} hike', "category": ["easy" if lvl.startswith("easy") else "moderate", "views", "south"],
             "intro": x.get("intro"), "getting": x.get("getting_there"), "tips": x.get("tips"), "facts": facts,
             "lat": x["lat"], "lng": x["lng"], "links": guide_links(x.get("sources")), "emoji": "🥾", "stanley": True})
        continue
    if x.get("kind") == "beach":
        add({"tab": "sights", "name": x["name"], "zh": x.get("name_zh"), "area": short_area(x.get("area") or "South side"),
             "cuisine": "Beach", "category": ["beach", "views", "free"], "intro": x.get("intro"), "funFact": x.get("fun_fact"),
             "getting": x.get("getting_there"), "tips": " ".join(t for t in (x.get("facilities"), x.get("tips")) if clean(t)) or None,
             "addressEn": x.get("address_en"), "addressZh": x.get("address_zh"), "lat": x["lat"], "lng": x["lng"], "emoji": "🏖️"})
        continue
    add({
        "tab": "city" if food else "sights", "name": x["name"], "zh": x.get("name_zh"), "area": "Stanley",
        "section": "Stanley" if food else None, "cuisine": x.get("cuisine"),
        "category": cats(x.get("category"), FOOD if food else ["iconic", "views", "culture", "night", "free", "near-campus", "local", "walk", "beach"]),
        "price": x.get("price"), "intro": x.get("intro"), "funFact": x.get("fun_fact"), "order": x.get("must_order"),
        "tips": x.get("tips"), "addressEn": x.get("address_en"), "addressZh": x.get("address_zh"),
        "lat": x["lat"], "lng": x["lng"], "stanley": True,
        "flags": ["Check it's open first"] if x.get("status") == "unclear" else None,
    })

# ---------- Sights ----------
SIGHT = ["iconic", "views", "culture", "night", "free", "near-campus", "local", "walk"]
for x in load("sights.json") or []:
    if x.get("lat") is None:
        continue
    c = cats(x.get("category"), SIGHT)
    if x.get("local") and "local" not in c:
        c.append("local")
    facts = [[k, x.get(f)] for k, f in (("Cost", "cost"), ("Time", "time_needed"), ("Hours", "hours")) if clean(x.get(f))]
    add({
        "tab": "sights", "name": x["name"], "zh": x.get("zh"), "area": short_area(x.get("area")),
        "cuisine": "Sightseeing", "category": c, "intro": x.get("intro"), "funFact": x.get("fun_fact"),
        "tips": x.get("tip"), "getting": x.get("getting_there"), "facts": facts,
        "lat": x["lat"], "lng": x["lng"], "mapsQuery": x.get("maps_query"), "local": bool(x.get("local")),
        "status": x.get("status"), "emoji": x.get("emoji"),
    })

# ---------- Hikes & shopping ----------
os_ = load("outdoors_shop.json") or {}
HIKE = ["easy", "moderate", "views", "sunset", "near-campus", "south"]

for x in os_.get("hikes", []):
    if x.get("lat") is None:
        continue
    facts = [[k, v] for k, v in (("Distance", f'{x["distance_km"]} km' if clean(x.get("distance_km")) else None),
                                  ("Time", x.get("duration")), ("Level", x.get("difficulty"))) if clean(v)]
    add({
        "tab": "hikes", "name": x["name"], "zh": x.get("zh"), "area": short_area(x.get("area")),
        "cuisine": f'{x.get("difficulty") or "Hike"} hike', "category": cats(x.get("category"), HIKE),
        "intro": x.get("intro"), "order": x.get("highlights"), "getting": x.get("getting_there"),
        "tips": x.get("tips"), "facts": facts, "lat": x["lat"], "lng": x["lng"],
        "mapsQuery": x.get("maps_query"), "picked": bool(x.get("picked")), "links": guide_links(x.get("sources")),
        "emoji": "🥾" if (x.get("difficulty") or "").lower().startswith("mod") else "🚶",
    })
SHOP = SHOP_CATS = ["luxury", "jewellery", "malls", "gifts", "tax-free", "local", "design"]
for x in os_.get("shopping", []):
    if x.get("lat") is None:
        continue
    add({
        "tab": "shop", "name": x["name"], "zh": x.get("zh"), "area": short_area(x.get("area")),
        "cuisine": (x.get("category") or ["Shopping"])[0].replace("-", " ").title(),
        "category": cats(x.get("category"), SHOP), "intro": x.get("intro"), "order": x.get("highlights"),
        "getting": x.get("getting_there"), "tips": x.get("tips"), "hours": x.get("hours"),
        "lat": x["lat"], "lng": x["lng"], "mapsQuery": x.get("maps_query"), "picked": bool(x.get("picked")),
    })

# ---------- Boothies in HK shared Google Maps list ----------
import math
def near(a, b, m=80):
    dy = (a["lat"] - b["lat"]) * 111000
    dx = (a["lng"] - b["lng"]) * 111000 * math.cos(math.radians(22.3))
    return math.hypot(dx, dy) < m

added_b = merged_b = skipped_b = 0
for x in load("boothies.json") or []:
    st = str(x.get("status") or "")
    typ = (x.get("type") or "").lower()
    if x.get("lat") is None or "closed" in st or "unverified" in st or "campus" in typ or "residence" in typ:
        skipped_b += 1; continue
    en, zh = split_name(x["name"])
    if not re.search(r"[A-Za-z]", en):
        skipped_b += 1; continue
    key = norm(x["name"])
    hit = next((p for p in places if p["tab"] in ("saiwan", "city") and p.get("lat") is not None
                and (norm(p["name"]) == key or (key and key[:6] == norm(p["name"])[:6] and near(p, x)))), None)
    if hit:
        hit["boothies"] = True
        if x.get("note"):
            hit["classmateNote"] = x["note"]
        merged_b += 1; continue
    unchecked = st.startswith("not searched")
    if not x.get("note") or unchecked:
        skipped_b += 1; continue  # keep the guide focused: only classmate-annotated, checked pins
    area = short_area(x.get("area"))
    c = cats(x.get("category"), FOOD)
    add({
        "tab": "saiwan" if area.startswith(("Sai Ying Pun", "Kennedy Town", "Shek Tong Tsui", "Sai Wan")) else "city",
        "name": en, "zh": zh, "area": area, "section": "Boothies map",
        "cuisine": (x.get("type") or "Classmate pick").replace(" (inferred)", "").capitalize(), "category": c,
        "intro": None if unchecked else x.get("intro"), "classmateNote": x.get("note"),
        "lat": x["lat"], "lng": x["lng"], "mapsQuery": f'{en} {x.get("address") or area}',
        "addressEn": None if CJK.search(x.get("address") or "") else x.get("address"),
        "addressZh": x.get("address") if CJK.search(x.get("address") or "") else None,
        "boothies": True, "lite": True,
    })
    if unchecked:
        places[-1]["intro"] = "Pinned on the Boothies map by a classmate. We haven't checked this one yet, so look at Google reviews first."
    added_b += 1
print(f"boothies: added {added_b}, merged {merged_b}, skipped {skipped_b}")

# ---------- drop places found to be closed/moved ----------
drop = {n.lower() for n in EXTRAS.get("drop", [])}
places[:] = [p for p in places if p["name"].lower() not in drop]

# ---------- hand-written extras: essentials, picks, fixes ----------
for x in EXTRAS.get("add", []):
    add(dict(x))
by_name = {p["name"].lower(): p for p in places}
for name, patch in EXTRAS.get("patch", {}).items():
    p = by_name.get(name.lower())
    if p:
        patch = dict(patch)
        if "name_override" in patch:
            p["name"] = patch.pop("name_override")
        p.update(patch)
    else:
        print("  ! patch target not found:", name)

home = EXTRAS["home"]
for k in ("campus", "parklane"):
    v = os_.get(k) or {}
    if v.get("lat"):
        home[k].update({"lat": v["lat"], "lng": v["lng"]})

taste = load("taste.json") or []
TASTE_KEYS = {"dim sum": "dim sum", "roast": "roast", "egg tart": "egg tart", "pineapple": "pineapple", "milk tea": "milk tea",
              "wonton": "wonton", "brisket": "brisket", "claypot": "claypot", "waffle": "waffle", "fish ball": "fish ball",
              "typhoon": "typhoon", "mango": "mango", "congee": "congee"}
EXTRA_FAMOUS = {"dim sum": "Maxim's Palace (City Hall)", "egg tart": "Bakehouse", "pineapple": "Kam Wah Cafe",
                "wonton": "Mak's Noodle", "typhoon": "Shun Kee Typhoon Shelter Seafood", "milk tea": "Australia Dairy Company"}
by_nm = {p["name"]: p for p in places}
for t in taste:
    for w in t.get("where", []):
        w["famous"] = True  # the checklist's own picks are the well-known names
    for k, nm in EXTRA_FAMOUS.items():
        p = by_nm.get(nm)
        if p and k in t["name"].lower() and not any(w["place"] == nm for w in t["where"]):
            t["where"].append({"place": nm, "zh": p.get("zh"), "area": p["area"], "lat": p["lat"], "lng": p["lng"], "address": p.get("addressEn"), "famous": True})
for t in taste:
    tn = t["name"].lower()
    for p in places:
        if p.get("classic") and any(k in tn and k in p["classic"].lower() for k in TASTE_KEYS):
            if not any(w.get("place") == p["name"] for w in t.get("where", [])):
                t.setdefault("where", []).insert(0, {"place": p["name"], "zh": p.get("zh"), "area": p["area"], "lat": p["lat"], "lng": p["lng"], "address": p.get("addressEn")})
tips = EXTRAS.get("tips", [])


# ---------- cuisine groups for the "shortlist by cuisine" filter ----------
KINDS = [
    ("Vegan & vegetarian", r"vegan|vegetarian|veggie|plant-based"),
    ("Dessert & sweets", r"dessert|sweet|tong sui|bakery|egg tart|waffle|pudding|mango|ice cream|taro"),
    ("Dim sum", r"dim sum|yum cha|teahouse"),
    ("Cha chaan teng & cafés", r"cha chaan|café|cafe|milk tea|breakfast|dairy"),
    ("Roast meats & noodles", r"roast|goose|noodle|wonton|brisket|congee|rice noodle|mixian|claypot|rice plate|fried rice|fast food"),
    ("Cantonese & seafood", r"cantonese|seafood|dai pai dong|typhoon|chiu chow|hotpot|hot pot|chicken pot|sichuan|sour fish|peking|beijing|shanghai|hunan"),
    ("Japanese", r"japanese|izakaya|ramen|sushi|yakitori|kushi"),
    ("Korean", r"korean"),
    ("Thai & SE Asian", r"thai|vietnam|malay|singapore|indonesian|southeast"),
    ("Western & Med", r"italian|spanish|tapas|french|mexican|pasta|steak|mediterranean|american|burger|pizza"),
    ("Cocktails", r"cocktail|speakeasy|gin|tequila|lounge|shisha|street of bars|mixology"),
    ("Wine bars", r"wine"),
    ("Beer & pubs", r"beer|pub\b|brew"),
    ("Jazz & live music", r"jazz|live band|live music"),
    ("Rooftops & views", r"rooftop|view|terrace"),
    ("Clubbing", r"club|dj|dance"),
]
for p in places:
    if p["tab"] not in ("saiwan", "city"):
        continue
    hay = " ".join(str(p.get(k, "")) for k in ("cuisine", "section", "name")).lower()
    p["kinds"] = [k for k, rx in KINDS if re.search(rx, hay)][:2]
    if not p["kinds"]:  # fall back to the description only when the cuisine label says nothing
        p["kinds"] = [k for k, rx in KINDS if re.search(rx, str(p.get("intro", "")).lower())][:1] or ["Other"]
    DRINK_KINDS = {"Cocktails", "Wine bars", "Beer & pubs", "Jazz & live music", "Rooftops & views", "Clubbing"}
    if p["category"][0] == "drinks" and "dinner" not in p["category"] and "lunch" not in p["category"]:
        p["kinds"] = [k for k in p["kinds"] if k in DRINK_KINDS] or ["Cocktails"]
    if "Wine bars" in p["kinds"]:
        p["kinds"] = ["Wine bars"] + [k for k in p["kinds"] if k in DRINK_KINDS - {"Wine bars"}]
    if "dessert" in p["category"] and "Dessert & sweets" not in p["kinds"]:
        p["kinds"].insert(0, "Dessert & sweets")

# Bars shouldn't show up as lunch options
FOODISH = re.compile(r"dim sum|tapas|restaurant|brasserie|bistro|izakaya|caf|steak|grill|kitchen|dining|taco|pasta|food|brunch|mediterranean|spanish", re.I)
for p in places:
    c = p.get("category", [])
    if "drinks" in c and "lunch" in c:
        hay = f'{p.get("cuisine", "")} {p.get("section", "")}'
        is_bar = p.get("section", "").lower().startswith(("lkf", "wine", "clubbing", "rooftop", "bar", "causeway bay", "sai ying pun", "tst")) or not FOODISH.search(hay)
        if is_bar or c[0] == "drinks":
            c.remove("lunch")

# ---------- Chinese addresses for the taxi card (from tools/zh_addresses.py) ----------
zh_addr = load("zh_addr.json") or {}
for p in places:
    v = zh_addr.get(p["id"]) or {}
    if not p.get("addressZh") and v.get("zh"):
        p["addressZh"] = v["zh"]

# ---------- food emoji: show what's on the plate, so pins are easy to tell apart ----------
EMOJI = [
    (r"vegan|vegetarian|veggie|plant", "🥬"), (r"egg tart|bakery|bakehouse|pastry", "🥧"), (r"egg waffle", "🧇"),
    (r"sugar cane|juice", "🥤"), (r"tofu|beancurd|douhua", "🍮"), (r"milk pudding|double-skin|milk company", "🍮"),
    (r"taro|tong sui|sweet soup|dessert", "🍧"), (r"afternoon tea|high tea", "🫖"),
    (r"dim sum|yum cha|teahouse|tea house", "🥟"), (r"claypot|clay pot", "🍚"), (r"chicken pot|chicken hotpot", "🍗"),
    (r"hotpot|hot pot", "🍲"), (r"roast goose|roast meat|siu mei|roasted", "🍗"), (r"typhoon|seafood|crab", "🦀"),
    (r"ramen|tsukemen", "🍜"), (r"sushi|omakase|japanese|izakaya|yakitori", "🍣"), (r"korean bbq|korean", "🥩"),
    (r"skewer|kushi|grill|bbq|barbecue", "🍢"), (r"mixian|rice noodle|wonton|noodle|brisket", "🍜"),
    (r"cha chaan|café|cafe|dairy|milk tea|breakfast", "🧋"), (r"fried rice|rice plate|fast food", "🍳"),
    (r"taiwan", "🍱"), (r"street|drinking area", "🍻"), (r"thai", "🌶️"), (r"vietnam|pho", "🍲"),
    (r"malay|indian|curry|singapore", "🍛"), (r"italian|pasta|trattoria|osteria", "🍝"), (r"pizza", "🍕"),
    (r"spanish|tapas|paella", "🥘"), (r"mexican|taco|taquer", "🌮"), (r"steak", "🥩"), (r"burger|american", "🍔"),
    (r"french|brasserie|bistro", "🥐"), (r"peking|duck|beijing", "🦆"), (r"cantonese|dai pai dong|stir-fr", "🥢"),
    (r"karaoke", "🎤"), (r"club|dj|dance", "🪩"), (r"jazz", "🎷"), (r"wine", "🍷"), (r"beer|pub|brew", "🍺"),
    (r"tequila|whisk|spirits", "🥃"), (r"rooftop|view|terrace", "🌃"), (r"shisha", "💨"), (r"gin", "🍸"),
    (r"cocktail|bar|speakeasy|lounge", "🍸"),
]
for p in places:
    if p["tab"] not in ("saiwan", "city") or p.get("emoji") in (None, "🥬") and p.get("veg"):
        if p["tab"] not in ("saiwan", "city"):
            continue
    hay = f'{p.get("cuisine", "")} {p.get("section", "")} {p["name"]}'.lower()
    for rx, em in EMOJI:
        if re.search(rx, hay):
            p["emoji"] = em
            break

SIGHT_EMOJI = [(r"dragon boat", "🛶", "Dragon boat beach"), (r"murray", "🏛️", "Heritage building"),
               (r"blake pier", "🌅", "Sunset pier"), (r"cemetery", "🪦", "War cemetery"), (r"ma hang|pak tai", "🛕", "Temple & park"),
               (r"ferry", "⛴️", "Harbour ride"), (r"peak", "🚠", "Viewpoint"), (r"chun yeung", "🚋", "Tram through a market"),
               (r"ding ding|tram", "🚋", "Tram ride"), (r"escalator", "🛗", "Hillside escalator"), (r"race", "🏇", "Horse racing night"),
               (r"temple street|night market", "🏮", "Night market"), (r"temple|man mo", "🛕", "Temple & antiques"),
               (r"m\+|museum", "🖼️", "Museum & waterfront"), (r"stanley|repulse|beach", "🏖️", "Seaside day out"),
               (r"sunset|waterfront", "🌅", "Sunset spot"), (r"promenade|avenue of stars|harbourfront", "🌊", "Harbour walk"),
               (r"mahjong|pmq", "🀄", "Design hub & mahjong"), (r"bird|flower", "🐦", "Bird & flower markets"),
               (r"lan kwai|lkf", "🍻", "Nightlife street"), (r"dried seafood", "🦑", "Old-school street"),
               (r"tai kwun", "🏛️", "Heritage & arts"), (r"wet market|market", "🐟", "Wet market walk"),
               (r"possession|tai ping shan", "🏮", "Heritage walk")]
for p in places:
    if p["tab"] == "sights" and p.get("cuisine") != "Beach":
        n = p["name"].lower()
        for rx, em, kind in SIGHT_EMOJI:
            if re.search(rx, n):
                p["emoji"], p["cuisine"] = em, kind; break
    elif p.get("classic"):
        c = p["classic"].lower()
        for k, em in (("egg tart", "🥧"), ("pineapple", "🍍"), ("milk tea", "🧋"), ("wonton", "🍜"), ("brisket", "🍜"),
                      ("roast", "🍗"), ("congee", "🥣"), ("dim sum", "🥟"), ("waffle", "🧇"), ("sago", "🥭"), ("claypot", "🍚")):
            if k in c:
                p["emoji"] = em; break
    elif p["tab"] == "hikes":
        n = p["name"].lower()
        for rx, em in ((r"dragon", "🐉"), (r"peak", "⛰️"), (r"reservoir|waterworks", "💧"), (r"lovers|bowen", "🌳"),
                       (r"davis|battery", "🏰"), (r"incense|braemar", "🌇"), (r"twins|violet", "🔥"), (r"siu ma", "🏞️")):
            if re.search(rx, n):
                p["emoji"] = em; break
    elif p["tab"] == "shop":
        n = f'{p["name"]} {p.get("cuisine", "")}'.lower()
        for rx, em in ((r"watch", "⌚"), (r"tailor", "🧵"), (r"electronic|fortress|broadway", "📷"), (r"tea", "🍵"),
                       (r"sasa|mannings|beauty", "💄"), (r"jewel|diamond|chow|lukfook|tsl|king fook", "💎"),
                       (r"stanley|market", "🧧"), (r"pmq|design", "🎨"), (r"k11|musea", "🖼️"), (r"mall|place|plaza|square|gardens|sogo|landmark|harbour city|ifc", "🛍️")):
            if re.search(rx, n):
                p["emoji"] = em; break
    elif p["name"] == "Afternoon tea at The Peninsula":
        p["emoji"] = "🫖"
    elif p["name"] == "Mountain Road Cafe":
        p["emoji"] = "🧋"

# hand-checked emoji overrides win over keyword guesses
for p in places:
    if p["name"] in EXTRAS.get("emoji", {}):
        p["emoji"] = EXTRAS["emoji"][p["name"]]

out = {"HOME": home, "PLACES": places, "PLAN": EXTRAS["plan"], "TASTE": taste, "TIPS": tips}
(ROOT / "data.js").write_text("window.HK = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n")
from collections import Counter
print("wrote data.js:", Counter(p["tab"] for p in places), "taste:", len(taste))
