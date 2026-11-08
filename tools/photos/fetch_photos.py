"""Fetch a representative, freely licensed photo per sight/hike from Wikipedia + Wikimedia Commons.

Usage: python3 -I tools/photos/fetch_photos.py
Writes tools/research/photos.json: id -> {src, page, credit, license}. Uses the official APIs only.
"""
import json, pathlib, re, time, urllib.error, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "tools" / "research" / "photos.json"
UA = {"User-Agent": "boothies-hk-guide/1.0 (https://boothies-hk.vercel.app; class travel guide)"}
TITLES = {
    "stanley-main-beach-dragon-boat-venue": "Stanley, Hong Kong",
    "murray-house-stanley-plaza": "Murray House",
    "blake-pier-at-stanley-sunset-spot": "Blake Pier at Stanley",
    "tin-hau-temple-stanley": "Stanley Main Street",
    "stanley-military-cemetery": "Stanley Military Cemetery",
    "tai-tam-waterworks-heritage-trail": "Tai Tam Waterworks Heritage Trail",
    "tai-tam-waterworks-heritage-trail-2": "Tai Tam Waterworks Heritage Trail",
    "repulse-bay-beach": "Repulse Bay",
    "deep-water-bay-beach": "Deep Water Bay",
    "big-wave-bay-beach": "Big Wave Bay, Hong Kong",
    "shek-o-beach": "Shek O",
    "temple-street-yau-ma-tei-neon-walk-incl-": "Temple Street, Hong Kong",
    "mong-kok-neon-streets-portland-st-tung-c": "Mong Kok",
    "wan-chai-neon-bar-strip-lockhart-road": "Lockhart Road",
    "monster-building-yick-cheong-montane-man": "Yick Cheong Building",
    "hsbc-main-building": "HSBC Main Building",
    "bank-of-china-tower": "Bank of China Tower (Hong Kong)",
    "lippo-centre-koala-tree": "Lippo Centre, Hong Kong",
    "the-blue-house": "Blue House (Hong Kong)",
    "choi-hung-estate-rainbow-estate-rooftop-": "Choi Hung Estate",
    "lai-tak-tsuen-round-towers": "Lai Tak Tsuen",
    "victoria-peak-the-peak-tram": "Victoria Peak",
    "star-ferry": "Star Ferry",
    "ding-ding-tram-kennedy-town-to-shau-kei-": "Hong Kong Tramways",
    "tai-kwun": "Tai Kwun",
    "pmq-a-mahjong-lesson": "PMQ (Hong Kong)",
    "man-mo-temple-hollywood-road-cat-street": "Man Mo Temple (Hong Kong)",
    "lan-kwai-fong-lkf": "Lan Kwai Fong",
    "happy-valley-racecourse-wednesday-night-": "Happy Valley Racecourse",
    "m-museum-west-kowloon-waterfront": "M+",
    "stanley-repulse-bay": "Stanley Market",
    "kennedy-town-waterfront-sunset": "Kennedy Town",
    "central-western-district-promenade-sun-y": "Sun Yat Sen Memorial Park",
    "dried-seafood-street-des-voeux-road-west": "Des Voeux Road West",
    "possession-street-tai-ping-shan-pak-sing": "Tai Ping Shan Street",
    "wet-market-walk-sai-ying-pun-market-cent": "Sai Ying Pun Market",
    "tram-through-chun-yeung-street-market": "Chun Yeung Street Market",
    "yuen-po-street-bird-garden-flower-market": "Yuen Po Street Bird Garden",
    "central-harbourfront-tamar-park-observat": "Hong Kong Observation Wheel",
    "tsim-sha-tsui-promenade-avenue-of-stars-": "Avenue of Stars, Hong Kong",
    "red-incense-burner-summit-braemar-hill": "Braemar Hill",
    "siu-ma-shan": "Siu Ma Shan",
    "wan-chai-to-the-peak-wan-chai-green-trai": "Wan Chai Gap",
    "hku-to-victoria-peak-via-lung-fu-shan": "Lung Fu Shan",
    "dragon-s-back": "Dragon's Back",
    "peak-circle-walk-lugard-road-harlech-roa": "Lugard Road",
    "mount-davis-path-jubilee-battery": "Mount Davis, Hong Kong",
    "violet-hill-the-twins-wilson-trail-stage": "Violet Hill (Hong Kong)",
    "bowen-road-fitness-trail-lovers-rock": "Bowen Road",
    "hong-kong-museum-of-art": "Hong Kong Museum of Art",
    "big-buddha-ngong-ping-360-cable-car": "Tian Tan Buddha",
    "tai-o-fishing-village": "Tai O",
    "cheung-chau-island": "Cheung Chau",
    "hong-kong-disneyland": "Hong Kong Disneyland",
    "ocean-park-giant-pandas": "Ocean Park Hong Kong",
    "ladies-market-tung-choi-street": "Tung Choi Street",
    "hong-kong-palace-museum": "Hong Kong Palace Museum",
    "stanley-waterfront-promenade-stanley-mai": "Stanley, Hong Kong",
    "stanley-ma-hang-park-pak-tai-temple": "Ma Hang",
    "ma-hang-park-to-chung-hom-kok-coastal-wa": "Chung Hom Kok",
    "k11-musea": "K11 Musea",
    "ifc-mall": "Two International Finance Centre",
    "pacific-place": "Pacific Place (Hong Kong)",
    "times-square": "Times Square (Hong Kong)",
    "harbour-city": "Harbour City (Hong Kong)",
    "chi-lin-nunnery-nan-lian-garden": "Chi Lin Nunnery",
    "wong-tai-sin-temple": "Wong Tai Sin Temple (Hong Kong)",
    "kowloon-walled-city-park": "Kowloon Walled City Park",
    "1881-heritage": "1881 Heritage",
    "ping-shek-estate": "Ping Shek Estate",
    "sham-shui-po-apliu-street-fuk-wing-street": "Apliu Street",
    "graham-street-mural": "Graham Street",
}


# Hand-picked "postcard" shots where the article's lead image isn't what visitors come for
OVERRIDE = {
    "victoria-peak-the-peak-tram": "Hong Kong Skyline view from the peak 2017.jpg",
    "star-ferry": "Star Ferry (Night Star) 20180409.jpg",
    "tsim-sha-tsui-promenade-avenue-of-stars-": "Hong Kong Harbour Night 2019-06-11.jpg",
    "tai-kwun": "Tai Kwun Parade Ground 201806.jpg",
    "temple-street-yau-ma-tei-neon-walk-incl-": "Temple Street Night Market viewed from above November 2016.jpg",
    "shek-o-beach": "Playa de Shek o beach.jpg",
    "tin-hau-temple-stanley": "Stanley Tin Hau Temple.jpg",
    "stanley-main-beach-dragon-boat-venue": "Stanley Main Beach 201307.jpg",
    "stanley-waterfront-promenade-stanley-mai": "Stanley Promenade 2.JPG",
    "stanley-ma-hang-park-pak-tai-temple": "Stanley Plaza Ma Hang Park Entrance 201307.jpg",
    "repulse-bay-beach": "Repulse Bay Beach.jpeg",
    "ocean-park-giant-pandas": "Panda Hongkong.jpg",
    "dragon-s-back": "Dragon's Back Trail.jpg",
    "peak-circle-walk-lugard-road-harlech-roa": "Lugard panorama cropped.jpg",
    "m-museum-west-kowloon-waterfront": "M+, West Kowloon (Hong Kong).jpg",
    "happy-valley-racecourse-wednesday-night-": "Happy Valley Racecourse.jpg",
    "stanley-repulse-bay": "Stanley Market View1 201007.jpg",
}


def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code != 429 or i == tries - 1:
                raise
            time.sleep(5 * (i + 1))


def strip(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()


def chunks(xs, n=40):
    for i in range(0, len(xs), n):
        yield xs[i:i + n]


# 1) lead image of each Wikipedia article, batched (follows redirects)
titles = sorted(set(TITLES.values()))
lead = {}
for part in chunks(titles):
    q = get("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "titles": "|".join(part), "prop": "pageimages", "piprop": "name",
        "redirects": 1, "format": "json", "formatversion": 2}))
    alias = {}
    for k in ("normalized", "redirects"):
        for m in q["query"].get(k, []):
            alias[m["to"]] = alias.get(m["from"], m["from"])
    for pg in q["query"]["pages"]:
        orig = pg["title"]
        while orig in alias and alias[orig] != orig:
            orig = alias[orig]
        if pg.get("pageimage"):
            lead[orig] = pg["pageimage"]
            lead[pg["title"]] = pg["pageimage"]
    time.sleep(1)

for pid, fn in OVERRIDE.items():
    lead["__" + pid] = fn
# 2) licence + author from Commons (non-free images on Wikipedia simply won't be found there, so they're skipped)
files = sorted(set(lead.values()))
meta = {}
for part in chunks(files):
    q = get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "titles": "|".join("File:" + x for x in part), "prop": "imageinfo",
        "iiprop": "url|extmetadata", "iiurlwidth": 800, "format": "json", "formatversion": 2}))
    norm = {m["to"]: m["from"] for m in q["query"].get("normalized", [])}
    for pg in q["query"]["pages"]:
        ii = (pg.get("imageinfo") or [None])[0]
        if not ii:
            continue
        md = ii.get("extmetadata") or {}
        name = norm.get(pg["title"], pg["title"]).split(":", 1)[1].replace(" ", "_")
        meta[name] = {"src": ii.get("thumburl"), "page": ii.get("descriptionurl"),
                      "credit": strip((md.get("Artist") or {}).get("value"))[:60] or "Wikimedia Commons",
                      "license": strip((md.get("LicenseShortName") or {}).get("value"))}
    time.sleep(1)

out = {}
for pid, title in TITLES.items():
    fn = OVERRIDE.get(pid) or lead.get(title)
    m = meta.get(fn.replace(" ", "_")) if fn else None
    out[pid] = {**m, "title": title} if m and m.get("src") and m.get("license") else {"none": True, "title": title, "file": fn}
OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1))
print("photos:", sum(1 for v in out.values() if v.get("src")), "of", len(TITLES))
for k, v in out.items():
    if not v.get("src"):
        print("  none:", k, "|", v.get("title"), "|", v.get("file"))
