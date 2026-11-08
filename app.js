(() => {
  const { HOME, PLACES, PLAN, TASTE = [], TIPS = [], OUTINGS = [] } = window.HK;

  const C = { pink: "#ff3e8a", cyan: "#2ee6ff", gold: "#ffc44d", lime: "#9dff6a", violet: "#a77bff", orange: "#ff8a3d" };
  const FOOD_MOODS = [
    { k: "coffee", label: "Coffee", em: "☕", c: C.orange },
    { k: "lunch", label: "Lunch", em: "🍜", c: C.cyan },
    { k: "dinner", label: "Dinner", em: "🥘", c: C.pink },
    { k: "dessert", label: "Dessert", em: "🍧", c: C.violet },
    { k: "drinks", label: "Drinks", em: "🍸", c: C.gold },
    { k: "late-night", label: "Late night", em: "🌙", c: C.orange },
  ];
  const TABS = {
    saiwan: { home: "campus", moods: FOOD_MOODS, orderLabel: "What to order" },
    city: { home: "parklane", moods: FOOD_MOODS, orderLabel: "What to order" },
    sights: {
      home: "parklane", orderLabel: "Highlights",
      moods: [
        { k: "iconic", label: "Iconic", em: "⭐", c: C.gold },
        { k: "views", label: "Views", em: "🏙️", c: C.cyan },
        { k: "culture", label: "Culture", em: "🏮", c: C.pink },
        { k: "night", label: "After dark", em: "🌃", c: C.violet },
        { k: "neon", label: "Neon lights", em: "🌈", c: C.pink },
        { k: "architecture", label: "Cool buildings", em: "🏢", c: C.violet },
        { k: "beach", label: "Beaches", em: "🏖️", c: C.cyan },
        { k: "daytrip", label: "Day trips", em: "⛴️", c: C.lime },
        { k: "photo", label: "Photo spots", em: "📸", c: C.pink },
        { k: "harbour", label: "Harbour walks", em: "🌊", c: C.cyan },
        { k: "hip", label: "Cool neighbourhoods", em: "🎨", c: C.violet },
        { k: "free", label: "Free", em: "🆓", c: C.lime },
        { k: "near-campus", label: "Near Booth", em: "🎓", c: C.orange },
      ],
    },
    hikes: {
      home: "parklane", orderLabel: "Highlights",
      moods: [
        { k: "easy", label: "Easy", em: "🚶", c: C.lime },
        { k: "moderate", label: "Moderate", em: "🥾", c: C.orange },
        { k: "views", label: "Big views", em: "🏙️", c: C.cyan },
        { k: "sunset", label: "Sunset", em: "🌅", c: C.pink },
        { k: "near-campus", label: "Near Booth", em: "🎓", c: C.gold },
        { k: "south", label: "Near Stanley", em: "🛶", c: C.pink },
      ],
    },
    shop: {
      home: "parklane", orderLabel: "Look for",
      moods: [
        { k: "luxury", label: "Luxury malls", em: "👜", c: C.gold },
        { k: "gifts", label: "Gifts to take home", em: "🎁", c: C.orange },
        { k: "malls", label: "Malls", em: "🛍️", c: C.violet },
        { k: "local", label: "Local finds", em: "🏮", c: C.pink },
      ],
    },
  };
  const ALL_MOODS = Object.values(TABS).flatMap((t) => t.moods);
  const moodOf = (k, tab) => (TABS[tab]?.moods || []).find((m) => m.k === k) || ALL_MOODS.find((m) => m.k === k);

  const FOOD = new Set(["saiwan", "city"]);
  const EXPLORE = new Set(["sights", "hikes", "shop"]);
  const WHERE = [
    ["all", "anywhere"], ["saiwan", "near Booth (Sai Wan)"], ["central", "in Central & Soho"],
    ["cwb", "near the Park Lane"], ["south", "in Stanley & the south 🛶"], ["kowloon", "across the harbour (TST & Kowloon)"],
  ];
  function whereOf(p) {
    const a = `${p.area} ${p.addressEn || ""}`.toLowerCase();
    if (/kennedy town|sai ying pun|shek tong tsui|sai wan|mount davis|pok fu lam|hku/.test(a)) return "saiwan";
    if (/tsim sha tsui|tst|jordan|mong kok|yau ma tei|kowloon|prince edward|sham shui po|hung hom|to kwa wan/.test(a)) return "kowloon";
    if (/causeway|wan chai|north point|tai hang|happy valley|quarry|braemar|tin hau|jardine|fortress hill|tai koo|shau kei/.test(a)) return "cwb";
    if (/stanley|repulse|tai tam|chung hom|deep water bay|ap lei chau|aberdeen|ocean park|southern district/.test(a)) return "south";
    if (/central|soho|sheung wan|admiralty|mid-levels|lan kwai|lkf|noho|tai kwun|peak|hollywood/.test(a)) return "central";
    return "other";
  }
  const FOOD_STYLES = [["any", "any style"], ["local", "a local favourite 🏮"], ["veg", "vegetarian-friendly 🥬"], ["cheap", "cheap & cheerful $"], ["fancy", "a bit fancy $$$"]];
  // When someone wants drinks, "that's…" offers kinds of bar instead of food styles
  const BAR_STYLES = [["any", "any kind of bar"], ["top", "a top cocktail bar ★"], ["fancy", "a bit fancy $$$"]];
  const WHAT = [
    ["food:all", "anything to eat or drink"], ["food:coffee", "☕ good coffee"], ["food:lunch", "🍜 lunch"], ["food:dinner", "🥘 dinner"], ["food:dessert", "🍧 dessert"],
    ["food:drinks", "🍸 drinks"], ["food:late-night", "🌙 a late-night bite"],
    ["sights:all", "📸 something to see"], ["hikes:all", "🥾 a hike"], ["shop:all", "🛍️ shopping"],
  ];

  const KIND_EMOJI = {
    "Dim sum": "🥟", "Roast meats & noodles": "🍜", "Cha chaan teng & cafés": "🧋", "Cantonese & seafood": "🥢",
    "Dessert & sweets": "🍧", "Japanese": "🍣", "Korean": "🥩", "Thai & SE Asian": "🌶️", "Western & Med": "🍝",
    "Vegan & vegetarian": "🥬", "Regional Chinese": "🥟", "Cocktails": "🍸", "Wine bars": "🍷", "Beer & pubs": "🍺", "Jazz & live music": "🎷",
    "Rooftops & views": "🌃", "Clubbing": "🪩",
  };
  let lastKinds = { list: [], counts: {} };
  // Six big groups for the map legend (the detailed kinds still power search)
  const GROUP_OF = {
    "Dim sum": "Local HK", "Roast meats & noodles": "Local HK", "Cha chaan teng & cafés": "Local HK", "Cantonese & seafood": "Local HK",
    "Japanese": "Asian", "Korean": "Asian", "Thai & SE Asian": "Asian", "Taiwanese": "Asian", "Regional Chinese": "Asian",
    "Western & Med": "Western",
    "Dessert & sweets": "Dessert",
    "Cocktails": "Bars", "Wine bars": "Bars", "Beer & pubs": "Bars", "Jazz & live music": "Bars", "Rooftops & views": "Bars", "Clubbing": "Bars",
    "Vegan & vegetarian": "Veggie",
  };
  const GROUP_EMOJI = { "Local HK": "🥢", "Asian": "🍜", "Western": "🍝", "Dessert": "🍧", "Bars": "🍸", "Veggie": "🥬" };
  const GROUP_ORDER = Object.keys(GROUP_EMOJI);
  const GROUP_SHORT = { "Local HK": "Local", "Asian": "Asian", "Western": "Western", "Dessert": "Sweets", "Bars": "Bars", "Veggie": "Veggie" };
  const groupsOf = (p) => uniq((p.kinds || []).map((k) => GROUP_OF[k]));
  // drinks get their own map filters: kinds of bar
  const BAR_GROUPS = ["Cocktails", "Rooftops & views", "Wine bars", "Beer & pubs", "Jazz & live music", "Clubbing"];
  const BAR_EMOJI = { "Cocktails": "🍸", "Rooftops & views": "🌃", "Wine bars": "🍷", "Beer & pubs": "🍺", "Jazz & live music": "🎷", "Clubbing": "🪩" };
  const BAR_SHORT = { "Cocktails": "Cocktails", "Rooftops & views": "Rooftop", "Wine bars": "Wine", "Beer & pubs": "Pubs", "Jazz & live music": "Live music", "Clubbing": "Clubs" };
  const filterKeysOf = (p) => (state.mood === "drinks" ? (p.kinds || []).filter((k) => BAR_GROUPS.includes(k)) : groupsOf(p));

  // Saved choices live in localStorage with a cookie copy, so a cleared or capped store doesn't lose them
  const store = {
    get(k) {
      try { const v = localStorage.getItem(k); if (v != null) return JSON.parse(v); } catch (e) { /* private mode */ }
      const m = document.cookie.match(new RegExp(`(?:^|; )${k}=([^;]*)`));
      try { return m ? JSON.parse(decodeURIComponent(m[1])) : null; } catch (e) { return null; }
    },
    set(k, v) {
      const j = JSON.stringify(v);
      try { localStorage.setItem(k, j); } catch (e) { /* private mode */ }
      document.cookie = `${k}=${encodeURIComponent(j)}; max-age=${60 * 60 * 24 * 400}; path=/; SameSite=Lax`;
    },
  };
  navigator.storage?.persist?.().catch(() => {});
  const LS = "hk-shortlist-v1";
  const loved = new Set(store.get(LS) || []);
  const state = { tab: "city", mood: "all", area: "all", section: "all", q: "", shortlist: false, active: null, local: false, boothies: false, all: false, more: false, limit: 10, kinds: new Set(), where: "all", style: "any" };

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const byId = Object.fromEntries(PLACES.map((p) => [p.id, p]));
  const live = PLACES.filter((p) => p.status !== "closed");

  /* ---------- helpers ---------- */
  function km(a, b) {
    const R = 6371, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function distanceNote(p) {
    if (me && p.lat != null) {
      const d = km(me, p);
      return d < 1.2 ? `📍 ${Math.max(1, Math.round((d * 1300) / 80))} min walk from you` : `📍 ${d.toFixed(1)} km from you`;
    }
    if (p.lat == null || !FOOD.has(p.tab)) return "";
    const fromBooth = whereOf(p) === "saiwan";
    const d = km(HOME[fromBooth ? "campus" : "parklane"], p);
    // rough taxi time: roads wind ~1.4x the straight line, ~22 km/h average in town, plus pick-up
    const taxi = (km) => Math.max(5, Math.round((km * 1.4 / 22) * 60 + 3));
    if (fromBooth) return `🚕 ~${taxi(d)} min by taxi from Booth`;
    // Kowloon means a cross-harbour tunnel, which is often the slow bit
    if (whereOf(p) === "kowloon") return `🚕 ~${taxi(d) + 10} min by taxi via the tunnel · or ⛴️ Star Ferry`;
    return `🚕 ~${taxi(d)} min by taxi from Park Lane`;
  }
  function colorOf(p) { return moodOf(p.category[0], p.tab)?.c || C.pink; }
  function emojiOf(p) { return p.emoji || moodOf(p.category[0], p.tab)?.em || "📍"; }
  function mapUrl(p) {
    if (p.map) return p.map;
    const q = p.address ? `${p.zh || p.name} ${p.address}` : (p.mapsQuery || `${p.name} ${p.area} Hong Kong`);
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }
  function cmUrl(p) {
    return `https://citymapper.com/directions?endcoord=${p.lat}%2C${p.lng}&endname=${encodeURIComponent(p.name)}&endaddress=${encodeURIComponent(p.area + ", Hong Kong")}`;
  }
  // where a tab's content starts (phones have the tab bar at the bottom of the screen)
  function contentTop() {
    if (window.innerWidth > 600) return $(".tabs").offsetTop;
    const sec = ["#finder", "#start", "#week"].map((q) => $(q)).find((el) => el && !el.hidden);
    return sec ? sec.offsetTop : 0;
  }
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200);
  }
  function saveLoved() {
    store.set(LS, [...loved]);
    $("#sl-count").textContent = loved.size;
  }

  /* ---------- data selection ---------- */
  function pool() {
    if (state.shortlist) return live.filter((p) => loved.has(p.id));
    const tabItems = live.filter((p) => (FOOD.has(state.tab) ? FOOD.has(p.tab) : p.tab === state.tab)
      && (state.where === "all" || whereOf(p) === state.where));
    // Curated by default: classmates' Boothies map pins only appear on request or when searching
    if (state.all || state.boothies || state.q.trim()) return tabItems;
    return tabItems.filter((p) => !p.lite);
  }
  const allCount = () => live.filter((p) => (FOOD.has(state.tab) ? FOOD.has(p.tab) : p.tab === state.tab) && (state.where === "all" || whereOf(p) === state.where)).length;
  const startLimit = () => 10;
  let me = null; // the user's location once they tap "Near me"
  const rank = (p) => (state.mood === "drinks" && p.topBar ? -1 : p.essential ? 0 : p.picked ? 1 : p.lite ? 3 : 2);
  // Popular AND well rated: Google stars weighted by how many people reviewed (a 4.6 with 3,000 reviews beats a 4.9 with 40)
  // HK locals rate harshly on Google (famous roast-goose shops sit at 3.5–4.0), so review volume counts as much as stars.
  // Places without Google numbers get a middle-of-the-pack score and our own picks decide.
  const PRIOR = 4.1, WEIGHT = 150;
  // Google and OpenRice blended, each weighted by its number of reviews
  function blend(p) {
    const g = p.gRating ? [p.gRating, p.gReviews || 0] : null, o = p.orScore ? [p.orScore, p.orReviews || 0] : null;
    if (!g && !o) return null;
    const n = (g ? g[1] : 0) + (o ? o[1] : 0);
    const r = n ? ((g ? g[0] * g[1] : 0) + (o ? o[0] * o[1] : 0)) / n : (g || o)[0];
    return [r, n];
  }
  const MED = (() => { const v = PLACES.map((p) => blend(p)?.[1]).filter(Boolean).sort((a, b) => a - b); return v[v.length >> 1] || 500; })();
  function score(p) {
    const b = blend(p);
    const v = b ? b[1] : MED, r = b ? b[0] : PRIOR;
    return (v / (v + WEIGHT)) * r + (WEIGHT / (v + WEIGHT)) * PRIOR + 0.3 * Math.log10(v + 1)
      + (p.essential ? 0.3 : 0) + (p.picked ? 0.2 : 0) + (p.classic || p.award ? 0.15 : 0)
      + (state.mood === "drinks" && p.topBar ? 0.4 : 0) - (p.lite ? 0.6 : 0);
  }
  function filtered() {
    const q = state.q.trim().toLowerCase();
    return pool().filter((p) => {
      if (!state.shortlist) {
        if (state.mood !== "all" && !p.category.includes(state.mood)) return false;
        if (state.area !== "all" && p.area !== state.area) return false;
        if (state.section !== "all" && p.section !== state.section) return false;
      }
      if (state.local && !p.local) return false;
      if (FOOD.has(state.tab) && !state.shortlist) {
        if (state.style === "local" && !p.local) return false;
        if (state.style === "veg" && !(p.veg || (p.kinds || []).includes("Vegan & vegetarian"))) return false;
        if (state.style === "cheap" && p.price !== "$") return false;
        if (state.style === "fancy" && !/\$\$\$/.test(p.price || "")) return false;
        if (state.style.startsWith("g:") && !groupsOf(p).includes(state.style.slice(2))) return false;
        if (state.style.startsWith("k:") && !(p.kinds || []).includes(state.style.slice(2))) return false;
        if (state.style === "top" && !p.topBar) return false;
      }
      if (state.boothies && !p.boothies) return false;
      if (state.kinds.size && !filterKeysOf(p).some((g) => state.kinds.has(g))) return false;
      if (q) {
        const hay = [p.name, p.zh, p.cuisine, p.area, p.section, p.intro, p.reviews, p.classmateNote, ...(p.order || []), ...(p.kinds || []), ...p.category].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => me && a.lat != null && b.lat != null ? km(me, a) - km(me, b) : score(b) - score(a) || rank(a) - rank(b) || (a.topRank ?? 99) - (b.topRank ?? 99));
  }
  // Broad picks ("dinner", "drinks", "sights") show the top few of each sub-category, so nobody has to tap "show more";
  // as soon as something narrower is chosen it's one ranked top-10 list.
  const GROUP_TABS = { sights: ["iconic", "photo", "harbour", "hip", "culture", "daytrip", "night", "neon"], hikes: ["easy", "moderate"], shop: ["luxury", "gifts", "malls", "local"] };
  function groupLabel() {
    if (FOOD.has(state.tab)) return { all: "eat & drink picks", drinks: "bars", lunch: "lunch picks", dinner: "dinner picks", dessert: "dessert picks", "late-night": "late-night picks" }[state.mood] || "picks";
    return { sights: "sights", hikes: "hikes", shop: "shopping" }[state.tab] || "picks";
  }
  function grouped(items) {
    if (state.flat || state.shortlist || state.q.trim() || me || state.kinds.size || state.style !== "any" || state.area !== "all" || state.section !== "all" || state.boothies || state.local) return null;
    let defs;
    if (FOOD.has(state.tab)) {
      if (state.mood === "all") defs = FOOD_MOODS.map((m) => ({ key: `mood:${m.k}`, label: m.label, em: m.em, has: (p) => p.category.includes(m.k) }));
      else if (state.mood === "drinks") defs = BAR_GROUPS.map((g) => ({ key: `kind:${g}`, label: g, em: BAR_EMOJI[g], has: (p) => (p.kinds || []).includes(g) }));
      else if (state.mood === "coffee") return null;
      else defs = GROUP_ORDER.filter((g) => g !== "Veggie" && g !== "Bars" && (g !== "Dessert" || state.mood === "late-night"))
        .map((g) => ({ key: `kind:${g}`, label: g === "Local HK" ? "Local Hong Kong" : g, em: GROUP_EMOJI[g], has: (p) => groupsOf(p).includes(g) }));
    } else {
      if (state.mood !== "all") return null;
      defs = (GROUP_TABS[state.tab] || []).map((k) => moodOf(k, state.tab)).filter(Boolean)
        .map((m) => ({ key: `mood:${m.k}`, label: m.label, em: m.em, has: (p) => p.category.includes(m.k) }));
    }
    defs = defs.map((d) => ({ ...d, all: items.filter(d.has) })).filter((d) => d.all.length);
    if (defs.length < 2) return null;
    const per = defs.length <= 3 ? 5 : defs.length <= 5 ? 4 : 3;
    const used = new Set();
    // one card per place, and one branch per chain (two Picis side by side looks like a mistake)
    const base = (p) => p.name.replace(/\s*\(.*\)\s*$/, "").toLowerCase();
    defs.forEach((d) => {
      d.top = [];
      for (const p of d.all) {
        if (d.top.length >= per) break;
        if (used.has(p.id) || used.has(base(p))) continue;
        d.top.push(p); used.add(p.id); used.add(base(p));
      }
    });
    return defs.filter((d) => d.top.length);
  }
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];

  /* ---------- rendering ---------- */
  function renderMoods() {
    document.body.classList.toggle("no-picker", !TABS[state.tab] && !state.shortlist);
    const isFood = FOOD.has(state.tab);
    const whatVal = isFood ? `food:${state.mood}` : TABS[state.tab] ? `${state.tab}:all` : "food:all";
    const styles = isFood ? (state.mood === "drinks" ? BAR_STYLES : FOOD_STYLES) : [["all", "any kind"], ...(TABS[state.tab]?.moods || []).map((m) => [m.k, `${m.label.toLowerCase()} ${m.em}`])];
    const styleVal = isFood ? state.style : state.mood;
    const opt = (list, v) => list.map(([k, l]) => `<option value="${esc(k)}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("");
    const n = TABS[state.tab] ? filtered().length : 0;
    $("#moods").innerHTML = `<div class="builder">
      <span>I'm looking for</span>
      <label class="pill"><select id="b-what" aria-label="What">${opt(WHAT, whatVal)}</select></label>
      <label class="pill"><select id="b-where" aria-label="Where">${opt(WHERE, state.where)}</select></label>
      <span>that's</span>
      <label class="pill"><select id="b-style" aria-label="Style">${opt(styles, styleVal)}</select></label>
    </div>`;
    setTimeout(updateMinibar, 0);
    $("#go-count").innerHTML = TABS[state.tab] ? `→ ${n} spot${n === 1 ? "" : "s"}` : "→ See places";
  }
  // slim title bar for phones once the header scrolls away
  function updateMinibar() {
    const sel = (id) => { const el = document.getElementById(id); return el ? el.options[el.selectedIndex]?.text || "" : ""; };
    const tabName = { city: "Eat & drink", sights: "Sights", hikes: "Hikes", shop: "Shopping", start: "First time in HK", week: "This week" }[state.tab] || "";
    const sum = TABS[state.tab]
      ? [sel("b-what").replace(/^anything to eat or drink$/, "Eat & drink"), sel("b-where").replace(/^anywhere$/, "")].filter(Boolean).join(" · ")
      : tabName;
    $("#mb-sum").textContent = sum.replace(/^\S+\s(?=[a-z])/u, (m) => m).replace(/^./, (c) => c.toUpperCase());
  }
  const heroEl = document.querySelector(".hero");
  new IntersectionObserver(([en]) => document.body.classList.toggle("scrolled", !en.isIntersecting), { threshold: 0 }).observe(heroEl);
  document.getElementById("mb-change").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  document.addEventListener("change", (e) => {
    if (!e.target.closest(".builder")) return;
    state.flat = false;
    const id = e.target.id, v = e.target.value;
    if (id === "b-what") {
      const [t, m] = v.split(":");
      if (t === "food") {
        const keep = (m === "drinks") === (state.mood === "drinks") ? state.style : "any";
        setTab("city", { mood: m, keepWhere: true }); state.style = keep; state.kinds = new Set(); state.limit = startLimit("city"); render();
      }
      else setTab(t, { keepWhere: true });
    } else if (id === "b-where") {
      state.where = v;
      if (FOOD.has(state.tab)) markTab("city");
      state.limit = startLimit(state.tab); render();
    } else if (id === "b-style") {
      if (FOOD.has(state.tab)) state.style = v; else state.mood = v;
      state.limit = startLimit(state.tab); render();
    }
  });

  function renderChips() {
    const items = pool();
    const areas = state.shortlist ? [] : uniq(items.map((p) => p.area));
    $("#areas").innerHTML = areas.length > 1 ? [["all", "📍 All areas"], ...areas.map((a) => [a, a])]
      .map(([k, l]) => `<button class="chip${state.area === k ? " on" : ""}" data-area="${esc(k)}">${esc(l)}</button>`).join("") : "";
    const nLocal = items.filter((p) => p.local).length;
    const localChip = nLocal ? `<button class="chip local${state.local ? " on" : ""}" data-local="1">🏮 Locals only · ${nLocal}</button>` : "";
    const nB = items.filter((p) => p.boothies).length;
    const bChip = nB ? `<button class="chip boothies${state.boothies ? " on" : ""}" data-boothies="1">👥 On the Boothies map · ${nB}</button>` : "";
    const secs = state.shortlist ? [] : uniq(items.map((p) => p.section));
    const kindCounts = {};
    // count cuisines within the chosen meal/mood so the choices always make sense (no cocktail bars under Lunch)
    items.filter((p) => state.mood === "all" || p.category.includes(state.mood))
      .forEach((p) => filterKeysOf(p).forEach((g) => { kindCounts[g] = (kindCounts[g] || 0) + 1; }));
    [...state.kinds].forEach((k) => { if (!kindCounts[k]) state.kinds.delete(k); });
    const hideForMeal = state.mood === "all" ? [] : state.mood === "dessert" ? ["Bars"] : ["Bars", "Dessert"];
    const kinds = state.mood === "coffee" ? [] : (state.mood === "drinks" ? BAR_GROUPS : GROUP_ORDER).filter((g) => kindCounts[g] && !hideForMeal.includes(g));
    lastKinds = { list: state.shortlist ? [] : kinds, counts: kindCounts };
    $("#kinds").innerHTML = "";
    if (false) $("#kinds").innerHTML = kinds.length > 1 && !state.shortlist
      ? `<span class="row-label">Looking for</span>` + kinds.map((k) => `<button class="chip kind${state.kinds.has(k) ? " on" : ""}" data-kind="${esc(k)}">${KIND_EMOJI[k] || ""} ${esc(k)} <small>${kindCounts[k]}</small></button>`).join("")

      : "";
    const active = (state.area !== "all") + (state.section !== "all") + state.boothies;
    $("#quick").innerHTML = state.shortlist ? "" : `<button class="chip more${state.more ? " on" : ""}" data-more="1">⚙️ ${state.more ? "Hide" : "More"}${active ? ` · ${active}` : ""}</button>`
      + (active || state.kinds.size ? `<button class="chip" data-reset="1">✕ Reset</button>` : "");
    $("#more-panel").hidden = !state.more || state.shortlist;
    const useSections = !kinds.length || state.tab !== "city";
    $("#sections").innerHTML = bChip + (useSections && secs.length > 1 ? [["all", "All types"], ...secs.map((s) => [s, s])]
      .map(([k, l]) => `<button class="chip sec${state.section === k ? " on" : ""}" data-section="${esc(k)}">${esc(l)}</button>`).join("") : "");
  }

  const kfmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : n);
  function card(p, i = 0) {
    const tab = TABS[p.tab];
    const tags = uniq([p.section, ...p.category.map((c) => moodOf(c, p.tab)?.label)]).map((t) => `<span class="tag">${esc(t)}</span>`).join("")
      + (p.veg ? `<span class="tag badge-veg">🥬 ${esc(p.veg)}</span>` : "") + (p.boothies ? `<span class="tag badge-boothies">👥 Boothies map</span>` : "") + (p.local ? `<span class="tag badge-local">🏮 Local favourite</span>` : "") + (p.topBar ? `<span class="tag badge-pick">★ Top bar${p.award ? ` · ${esc(p.award.split(/[;+(]/)[0].trim())}` : ""}</span>` : "") + (p.picked ? `<span class="tag badge-pick">★ Class pick</span>` : "") + (p.flags || []).map((f) => `<span class="tag warn">${esc(f)}</span>`).join("");
    const meta = [
      p.gRating && `<span class="stars" title="Google rating">★ ${p.gRating.toFixed(1)}${p.gReviews ? ` <small>(${kfmt(p.gReviews)})</small>` : ""}</span>`,
      p.orScore && `<span class="stars or" title="OpenRice, Hong Kong's local review site">OpenRice ${p.orFaces ? `😊 ${kfmt(p.orFaces[0])} · 😐 ${kfmt(p.orFaces[1])} · 😢 ${kfmt(p.orFaces[2])}` : `${p.orScore.toFixed(1)}<small>/5</small>${p.orReviews ? ` <small>(${kfmt(p.orReviews)})</small>` : ""}`}</span>`,
      p.price && `<span class="price">${esc(p.price)}</span>`,
      `<span>${esc(p.cuisine)}</span>`,
      `<span>${esc(p.area)}</span>`,
      distanceNote(p) && `<span class="walk">${distanceNote(p)}</span>`,
    ].filter(Boolean).join("");
    const block = (label, html) => html ? `<p class="label">${label}</p>${html}` : "";
    const links = [
      ...(p.pins ? p.pins.map((pin, i) => `<a${i ? "" : ' class="primary"'} href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pin.label.replace(" (landing)", "") + " Star Ferry Hong Kong")}" target="_blank" rel="noopener">📍 ${esc(pin.label)}</a>`)
        : [`<a class="primary" href="${esc(mapUrl(p))}" target="_blank" rel="noopener">📍 Google Maps</a>`]),
      p.lat != null && `<a href="${esc(cmUrl(p))}" target="_blank" rel="noopener" title="Best for HK public transport, if you have the app">🚇 Citymapper</a>`,
      p.openrice && `<a href="${esc(p.openrice)}" target="_blank" rel="noopener">OpenRice</a>`,
      p.url && `<a href="${esc(p.url)}" target="_blank" rel="noopener">🔗 Website</a>`,
      ...(p.links || []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">📖 ${esc(l.label)}</a>`),
      (p.zh || p.addressZh) && `<button class="drv" data-driver="${p.id}">🚕 Show the driver</button>`,
      p.phone && `<a href="tel:+852${esc(p.phone.replace(/\s/g, ""))}">📞 ${esc(p.phone)}</a>`,
      window.HK_ADDWEEK && window.HK_ADDWEEK({ title: `${emojiOf(p)} ${p.name}`, place: p.id }, "🗓 Add to my week"),
    ].filter(Boolean).join("");
    return `<article class="card${state.active === p.id ? " active open" : ""}" data-id="${p.id}" style="--c:${colorOf(p)};animation-delay:${Math.min(i, 12) * 30}ms">
      ${p.photo ? `<figure class="ph"><img src="${esc(p.photo.src)}" alt="${esc(p.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('figure').remove()"><figcaption><a href="${esc(p.photo.page)}" target="_blank" rel="noopener">📷 ${esc(p.photo.credit)} · ${esc(p.photo.license)}</a></figcaption></figure>` : ""}
      <div class="card-top">
        <div class="badge">${emojiOf(p)}</div>
        <div class="titles"><h3>${esc(p.name)}</h3>${p.zh && p.zh !== p.name ? `<span class="zh" lang="zh">${esc(p.zh)}</span>` : ""}</div>
        <button class="heart${loved.has(p.id) ? " on" : ""}" data-love="${p.id}" aria-label="Add to shortlist">♥</button>
      </div>
      <div class="meta">${meta}</div>
      <p class="intro">${esc(p.intro)}</p>
      <div class="tags">${tags}</div>
      <div class="more"><div>
        ${p.facts?.length ? `<div class="facts-row">${p.facts.map(([k, v]) => `<div><span>${esc(k)}</span>${esc(v)}</div>`).join("")}</div>` : ""}
        ${p.funFact ? `<p class="fact"><b>Fun fact:</b> ${esc(p.funFact)}</p>` : ""}
        ${block(tab.orderLabel, p.order?.length ? `<ul class="order">${p.order.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : "")}
        ${p.classmateNote ? `<p class="fact" style="--c:var(--gold)"><b>Classmate note:</b> ${esc(p.classmateNote)}</p>` : ""}
        ${p.priceNote ? `<p class="group">💵 ${esc(p.priceNote)}</p>` : ""}
        ${block("What people say", p.reviews && `<p class="reviews">“${esc(p.reviews)}”</p>`)}
        ${block("Getting there", p.getting && `<p class="reviews" style="font-style:normal">${esc(p.getting)}</p>`)}
        ${block("Our tip", p.tips && `<p class="reviews" style="font-style:normal">${esc(p.tips)}</p>`)}
        ${p.group ? `<p class="group">👥 ${esc(p.group)}</p>` : ""}
        ${p.hours ? `<p class="group">🕒 ${esc(p.hours)}</p>` : ""}
        <div class="links">${links}</div>
      </div></div>
      <div class="toggle-hint">Tap for what to get, reviews &amp; map ↓</div>
    </article>`;
  }

  function render({ fit = true } = {}) {
    renderMoods();
    renderChips();
    const items = filtered();
    let countHtml;
    if (state.shortlist) countHtml = `${items.length} on your shortlist${items.length ? ` · <a href="#" id="share">Copy share link</a>` : ""}`;
    else {
      const moodOk = (p) => state.mood === "all" || p.category.includes(state.mood);
      const extra = live.filter((p) => p.lite && moodOk(p) && (FOOD.has(state.tab) ? FOOD.has(p.tab) : p.tab === state.tab)
        && (state.where === "all" || whereOf(p) === state.where)).length;
      const curated = !state.all && !state.boothies && !state.q.trim();
      countHtml = `${items.length} ${curated ? "hand-picked " : ""}place${items.length === 1 ? "" : "s"}`
        + (extra > 0 && curated ? ` · <a href="#" data-all="1">+ ${extra} classmate picks from the Boothies map</a>` : "")
        + (state.all ? ` · <a href="#" data-all="0">Back to hand-picked only</a>` : "");
    }
    const groups = grouped(items);
    if (groups) countHtml = `Top picks of each kind · ${countHtml}`;
    else if (items.length && !state.shortlist && !me) countHtml = `Most popular &amp; best rated first · ${countHtml}`;
    const filtersOn = !state.shortlist && (state.kinds.size || state.style !== "any" || state.local || state.area !== "all" || state.section !== "all");
    if (filtersOn) countHtml += ` <button class="clear-f" data-clearf="1">✕ Clear filters</button>`;
    if (backTo && !groups) countHtml = `<button class="back-btn" data-back="1">← Back to all ${esc(backTo.label)}</button> ${countHtml}`;
    $("#count").innerHTML = countHtml;
    const shown = groups ? groups.flatMap((g) => g.top) : items.slice(0, state.limit);
    const rest = items.length - shown.length;
    let i = 0;
    $("#grid").innerHTML = groups
      ? groups.map((g) => `<div class="grp"><h3><span>${g.em}</span> ${esc(g.label)}</h3>${g.all.length > g.top.length ? `<button class="see-all" data-seeall="${esc(g.key)}" data-label="${esc(groupLabel())}">See top ${Math.min(10, g.all.length)} →</button>` : ""}</div>`
        + g.top.map((p) => card(p, i++)).join("")).join("")
      : items.length ? shown.map(card).join("") + (rest > 0 ? `<button class="show-more" data-showmore="1">Show ${Math.min(rest, 10)} more <small>(${rest} more to see)</small></button>` : "")
      : state.shortlist
        ? `<div class="empty"><b>♡</b>Tap the heart on any place to build a shortlist you can send to the group chat.</div>`
        : `<div class="empty"><b>🤷</b>Nothing matches. Try another mood or clear the search.</div>`;
    drawMarkers(shown, fit);
  }

  /* ---------- map ---------- */
  let booted = false;
  const map = L.map("map", { zoomControl: true, scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false, attributionControl: true }).setView([HOME.campus.lat, HOME.campus.lng], 15);
  // Vector basemap with labels forced to English (classmates don't read Chinese)
  const gl = L.maplibreGL({
    style: "https://tiles.openfreemap.org/styles/dark",
    attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  const glMap = gl.getMaplibreMap();
  glMap.once("load", () => {
    glMap.getStyle().layers.forEach((ly) => {
      if (ly.type === "symbol" && ly.layout && ly.layout["text-field"]) {
        glMap.setLayoutProperty(ly.id, "text-field", ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name:latin"], ["get", "name"]]);
      }
    });
  });
  // The page scrolls normally over the map; tap/click the map to start panning & zooming it.
  const pane = document.querySelector(".map-pane");
  function mapLive(on) {
    pane.classList.toggle("live", on);
    if (on) { map.scrollWheelZoom.enable(); map.dragging.enable(); }
    else { map.scrollWheelZoom.disable(); if (L.Browser.mobile) map.dragging.disable(); }
  }
  map.on("click", () => mapLive(true));
  map.on("popupopen", () => mapLive(true));
  pane.addEventListener("mouseleave", () => mapLive(false));
  document.addEventListener("touchstart", (e) => { if (!pane.contains(e.target)) mapLive(false); }, { passive: true });
  window.addEventListener("scroll", () => { if (!pane.matches(":hover")) mapLive(false); }, { passive: true });
  // "Near me": show where you are and sort everything by distance from you
  let meMarker = null;
  const NearMe = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
      const b = L.DomUtil.create("button", "near-me");
      b.type = "button"; b.innerHTML = "📍 Near me"; b.setAttribute("aria-label", "Show places near my location");
      L.DomEvent.disableClickPropagation(b);
      b.addEventListener("click", () => {
        if (me) { // second tap turns it off
          me = null; meMarker && map.removeLayer(meMarker); meMarker = null; b.classList.remove("on"); b.innerHTML = "📍 Near me";
          render(); return;
        }
        if (!navigator.geolocation) return toast("Location isn't available in this browser");
        b.innerHTML = "📍 Finding you…";
        navigator.geolocation.getCurrentPosition((pos) => {
          me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (km(me, HOME.campus) > 60) { toast("You're not in Hong Kong yet, so showing distances from Booth instead"); me = { lat: HOME.campus.lat, lng: HOME.campus.lng }; }
          meMarker && map.removeLayer(meMarker);
          meMarker = L.marker([me.lat, me.lng], { icon: L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), zIndexOffset: 2000 }).addTo(map);
          b.classList.add("on"); b.innerHTML = "📍 Near me ✓";
          state.where = "all"; state.limit = startLimit(state.tab); render();
          mapLive(true);
        }, () => { b.innerHTML = "📍 Near me"; toast("Couldn't get your location. Check location permission for this site."); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
      });
      return b;
    },
  });
  map.addControl(new NearMe());
  // Phones: the list matters most (NN/g), so the map can be folded away; the choice is remembered
  const mapHidden = () => document.body.classList.contains("map-off");
  function setMapHidden(off) {
    document.body.classList.toggle("map-off", off);
    $("#map-hide").textContent = off ? "🗺️ Show map" : "Hide map ▴";
    $("#map-hide").setAttribute("aria-expanded", String(!off));
    store.set("hk-mapoff-v1", off);
    if (!off) setTimeout(() => { map.invalidateSize(); drawMarkers(shownNow(), true); }, 60);
  }
  $("#map-hide").addEventListener("click", () => setMapHidden(!mapHidden()));
  if (store.get("hk-mapoff-v1")) setTimeout(() => setMapHidden(true), 0);
  const homeIcon = (em) => L.divIcon({ className: "", html: `<div class="home-pin">${em}</div>`, iconSize: [46, 46], iconAnchor: [23, 23] });
  const homes = {
    campus: L.marker([HOME.campus.lat, HOME.campus.lng], { icon: homeIcon("🎓"), zIndexOffset: 1000 })
      .bindPopup(`<b>Booth Hong Kong campus</b><small>${esc(HOME.campus.address)}</small>`),
    parklane: L.marker([HOME.parklane.lat, HOME.parklane.lng], { icon: homeIcon("🏨"), zIndexOffset: 1000 })
      .bindPopup(`<b>The Park Lane Hong Kong</b><small>${esc(HOME.parklane.address)}</small>`),
  };
  Object.values(homes).forEach((m) => m.addTo(map));
  const layer = L.layerGroup().addTo(map);
  const markers = {};

  function pinIcon(p) {
    return L.divIcon({
      className: "",
      html: `<div class="pin${state.active === p.id ? " hot" : ""}${loved.has(p.id) ? " loved" : ""}" style="--c:${colorOf(p)}"><span>${emojiOf(p)}</span></div>`,
      iconSize: [38, 38], iconAnchor: [19, 38], popupAnchor: [0, -36],
    });
  }
  function drawMarkers(items, fit) {
    layer.clearLayers();
    Object.keys(markers).forEach((k) => delete markers[k]);
    const pts = [];
    items.forEach((p) => {
      if (p.lat == null) return;
      const m = L.marker([p.lat, p.lng], { icon: pinIcon(p), riseOnHover: true })
        .bindPopup(`<b>${esc(p.name)}</b><small>${esc(p.cuisine)} · ${esc(p.area)}</small>`, { closeButton: false });
      m.on("click", () => focus(p.id, { fromMap: true }));
      if (p.pins && state.active === p.id) {
        p.pins.forEach((pin, i) => {
          const pm = L.marker([pin.lat, pin.lng], { icon: pinIcon(p), riseOnHover: true })
            .bindPopup(`<b>${esc(p.name)}</b><small>${esc(pin.label)}</small>`, { closeButton: false });
          pm.on("click", () => focus(p.id, { fromMap: true }));
          pm.addTo(layer); pts.push([pin.lat, pin.lng]);
          if (i === 0) markers[p.id] = pm;
        });
        (p.routes || []).forEach(([a, b]) => L.polyline([[p.pins[a].lat, p.pins[a].lng], [p.pins[b].lat, p.pins[b].lng]],
          { color: "#3ee8b5", weight: 3, dashArray: "6 8", opacity: 0.9 }).addTo(layer));
        return;
      }
      m.addTo(layer); markers[p.id] = m; pts.push([p.lat, p.lng]);
    });
    if (fit && pts.length) {
      const home = state.shortlist ? null : HOME[TABS[state.tab]?.home];
      if (me) pts.push([me.lat, me.lng]);
      else if (state.where === "saiwan") pts.push([HOME.campus.lat, HOME.campus.lng]);
      map.invalidateSize();
      const b = L.latLngBounds(pts).pad(0.15);
      if (map.getSize().x > 0 && booted) map.flyToBounds(b, { maxZoom: 16, duration: 0.8 });
      else if (map.getSize().x > 0) map.fitBounds(b, { maxZoom: 16 });
      else map.setView(b.getCenter(), 14);
    }
    renderLegend();
  }
  // The legend doubles as a filter: tap a type on the map to show only those pins
  function renderLegend() {
    const homeLbl = state.where === "saiwan" ? "🎓 Booth" : "🏨 Park Lane";
    let chips = "";
    if (FOOD.has(state.tab) && lastKinds.list.length) {
      const ordered = lastKinds.list;
      const EM = state.mood === "drinks" ? BAR_EMOJI : GROUP_EMOJI, SH = state.mood === "drinks" ? BAR_SHORT : GROUP_SHORT;
      chips = ordered.filter((k) => k !== "Veggie").map((k) => `<button class="lg${state.kinds.has(k) ? " on" : ""}" data-kind="${esc(k)}" aria-pressed="${state.kinds.has(k)}"><span class="li">${EM[k] || "•"}</span><span class="ll"><span class="long">${esc(k)}</span><span class="short">${esc(SH[k] || k)}</span></span></button>`).join("")
        ;
    } else if (TABS[state.tab] && !state.shortlist && !FOOD.has(state.tab)) {
      chips = TABS[state.tab].moods.filter((m) => pool().some((p) => p.category.includes(m.k)))
        .map((m) => `<button class="lg${state.mood === m.k ? " on" : ""}" data-mood="${m.k}"><span class="li">${m.em}</span><span class="ll">${esc(m.label)}</span></button>`).join("")
        + (state.mood !== "all" ? `<button class="lg clear" data-mood="all"><span class="li">✕</span><span class="ll">All</span></button>` : "");
    }
    $("#legend").innerHTML = `<span class="lg home">${homeLbl}</span>${chips}`;
  }

  let backTo = null;
  window.addEventListener("popstate", () => {
    if (!backTo) return;
    const b = backTo; backTo = null;
    setTab(b.tab, { mood: b.mood, where: b.where });
    state.style = b.style; render({ fit: true });
    window.scrollTo({ top: contentTop(), behavior: "smooth" });
  });
  const shownNow = () => { const it = filtered(), g = grouped(it); return g ? g.flatMap((x) => x.top) : it.slice(0, state.limit); };
  function focus(id, { fromMap = false, open = true } = {}) {
    const prev = state.active;
    state.active = id;
    document.querySelectorAll(".card.active").forEach((c) => c.classList.remove("active"));
    let el = document.querySelector(`.cards .card[data-id="${id}"]`);
    if (!el && filtered().some((p) => p.id === id)) {
      state.flat = true; // jumping to a place outside the grouped top picks shows the full ranked list instead
      state.limit = Math.max(state.limit, filtered().findIndex((p) => p.id === id) + 1);
      render({ fit: false }); el = document.querySelector(`.cards .card[data-id="${id}"]`);
    }
    if (el) { el.classList.add("active"); if (open) el.classList.add("open"); }
    if ((byId[id] && byId[id].pins) || (prev && byId[prev] && byId[prev].pins)) drawMarkers(shownNow(), false);
    [prev, id].forEach((k) => { if (k && markers[k] && byId[k]) markers[k].setIcon(pinIcon(byId[k])); });
    const p = byId[id];
    if (p?.pins) {
      map.flyToBounds(L.latLngBounds(p.pins.map((x) => [x.lat, x.lng])).pad(0.25), { duration: 0.7 });
    } else if (p?.lat != null) {
      map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 16), { duration: 0.7 });
      markers[id]?.openPopup();
    }
    if (fromMap && el) el.scrollIntoView({ behavior: "smooth", block: window.innerWidth <= 900 ? "end" : "center" });
  }

  /* ---------- week ---------- */
  // Week: official Becker schedule (🎓) + our own plans (🎉). Phones show one day at a time.
  let planDay = null;
  const ideaOpen = {}; // day -> idea open in its ideas grid
  let trayPick = null; // the idea or place tapped in the picks tray
  // Personal plans: day trips, ideas, places or anything typed in, kept on this phone and shown in "My week"
  const MYP = "hk-myplans-v1";
  let myPlans = store.get(MYP) || [];
  const saveMyPlans = () => store.set(MYP, myPlans);
  const dayLabel = (iso) => { const d = PLAN.find((x) => x.iso === iso); return d ? `${d.day} ${d.date}` : iso; };
  function addMyPlan(p) {
    if (!p.iso || !p.title) return;
    if (myPlans.some((x) => x.iso === p.iso && x.title === p.title)) { toast(`Already in your week on ${dayLabel(p.iso)}`); return; }
    myPlans.push({ id: Math.random().toString(36).slice(2, 9), ...p }); saveMyPlans();
    planDay = Math.max(0, PLAN.findIndex((d) => d.iso === p.iso));
    renderPlan(); toast(`⭐ Added to your week: ${dayLabel(p.iso)}`);
  }
  // a small "Add to my week" day picker that works anywhere (idea plans, place cards)
  window.HK_ADDWEEK = (item, label = "⭐ Add to my week") => `<label class="addweek"><span>${label}</span><select data-addweek="${esc(JSON.stringify(item))}" aria-label="Pick a day to add it to your week"><option value="">pick a day…</option>${PLAN.map((d) => `<option value="${d.iso}">${esc(d.day)} ${esc(d.date)}</option>`).join("")}</select></label>`;
  const MLS = "hk-myplan-v2"; // keys are day + event id (or the item text), so edits to the schedule don't shift ticks
  const slotKey = (iso, v, ev) => `${iso}|${ev || v.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;
  const mine = store.get(MLS) || {}; // "iso|slot" -> true when someone adds an optional or social item to their own plan
  let onlyMine = !!store.get("hk-onlymine-v1");
  const showHidden = new Set();
  // exact name first, then "starts with", then "contains", so "COA" doesn't match "…coastal walk"
  const findPlace = (q) => { if (!q) return null; const l = q.toLowerCase(), n = (p) => p.name.toLowerCase();
    return live.find((p) => n(p) === l) || live.find((p) => n(p).startsWith(l)) || live.find((p) => n(p).includes(l)); };

  /* ---------- weather: Hong Kong Observatory 9-day forecast, Open-Meteo for days further out ---------- */
  const WX_KEY = "hk-wx-v1";
  let wx = store.get(WX_KEY)?.days || {};
  const HKO_ICON = { 50: "☀️", 51: "🌤️", 52: "🌤️", 53: "🌦️", 54: "🌦️", 60: "☁️", 61: "☁️", 62: "🌧️", 63: "🌧️", 64: "🌧️", 65: "⛈️",
    70: "🌙", 71: "🌙", 72: "🌙", 73: "🌙", 74: "🌙", 75: "🌙", 76: "☁️", 77: "🌤️", 80: "💨", 81: "🌤️", 82: "💧", 83: "🌫️", 84: "🌫️", 85: "🌫️", 90: "🥵", 91: "🌤️", 92: "🍃", 93: "🥶" };
  const omIcon = (c) => (c === 0 ? "☀️" : c <= 2 ? "🌤️" : c === 3 ? "☁️" : c <= 48 ? "🌫️" : c <= 67 ? "🌧️" : c <= 82 ? "🌦️" : "⛈️");
  const omRain = (p) => (p == null ? "" : p < 20 ? "Low" : p < 40 ? "Medium Low" : p < 60 ? "Medium" : p < 80 ? "Medium High" : "High");
  const toF = (c) => Math.round((c * 9) / 5 + 32);
  async function loadWeather() {
    const cached = store.get(WX_KEY);
    if (cached && Date.now() - cached.t < 60 * 60e3) return; // refresh hourly
    const days = {};
    try { // backup / longer range first, so HKO can overwrite the days it covers
      const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=22.28&longitude=114.16&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=Asia%2FHong_Kong&forecast_days=16");
      const j = await r.json();
      (j.daily?.time || []).forEach((iso, i) => { const pc = j.daily.precipitation_probability_max[i], ic = omIcon(j.daily.weather_code[i]);
        days[iso] = { src: "Open-Meteo", icon: pc != null && pc < 30 && /🌧️|🌦️|⛈️/.test(ic) ? "🌥️" : ic, max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]), rain: omRain(j.daily.precipitation_probability_max[i]), pct: j.daily.precipitation_probability_max[i] }; });
    } catch (e) { /* offline */ }
    try {
      const r = await fetch("https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd&lang=en");
      const j = await r.json();
      (j.weatherForecast || []).forEach((x) => {
        const iso = `${x.forecastDate.slice(0, 4)}-${x.forecastDate.slice(4, 6)}-${x.forecastDate.slice(6, 8)}`;
        days[iso] = { src: "HKO", icon: HKO_ICON[x.ForecastIcon] || "🌤️", max: x.forecastMaxtemp?.value, min: x.forecastMintemp?.value, rain: x.PSR, text: x.forecastWeather, updated: j.updateTime };
      });
    } catch (e) { /* HKO unavailable: Open-Meteo values stay */ }
    if (Object.keys(days).length) { wx = days; store.set(WX_KEY, { t: Date.now(), days }); renderPlan(); }
  }
  const wxLine = (iso) => {
    const w = wx[iso];
    if (!w) {
      const first = PLAN.find((d) => d.iso === iso);
      const avail = new Date(new Date(`${iso}T12:00:00+08:00`).getTime() - 9 * 864e5);
      return first ? `<p class="wx muted">🌤️ Forecast from ${avail.getDate()} Nov · typical mid-November: about 19–25°C (66–77°F), mostly dry</p>` : "";
    }
    const rainy = /High|Medium$/.test(w.rain || "");
    return `<p class="wx">${w.icon} <b>${w.min}–${w.max}°C</b> <span>(${toF(w.min)}–${toF(w.max)}°F)</span> · ${rainy ? "☔ " : ""}Rain: ${esc((w.rain || "n/a").toLowerCase())}${w.pct != null && w.src !== "HKO" ? ` (${w.pct}%)` : ""}
      <small>${w.src === "HKO" ? `Hong Kong Observatory${w.text ? ` · ${esc(w.text.split(". ")[0])}` : ""}` : "Open-Meteo (the HKO forecast covers 9 days ahead)"}</small></p>`;
  };

  function renderPlan() {
    // "today" in Hong Kong time, so the week opens on the right day during the trip
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(new Date());
    if (planDay == null) planDay = Math.max(0, PLAN.findIndex((d) => d.iso === today));
    const dayBtns = PLAN.map((d, i) => `<button class="pd${i === planDay ? " on" : ""}${d.iso === today ? " today" : ""}" data-planday="${i}" aria-label="${esc(d.day)} ${esc(d.date)}${d.iso === today ? ", today" : ""}"><b>${d.iso === today ? "Today" : esc(d.day)}</b><span>${esc(d.date.split(" ")[0])}</span>${wx[d.iso] ? `<i class="pd-wx" aria-hidden="true">${wx[d.iso].icon}</i>` : ""}</button>`).join("");
    // tags under an item: a place in the guide (📍, opens its card), an event's own site (↗), or a guide search
    const goTag = (g) => {
      if (g.url) return `<a class="go" href="${esc(g.url)}" target="_blank" rel="noopener">${esc(g.label)} ↗</a>`;
      const id = g.jump || (g.q && venuePlace(g.q)?.id);
      const lab = `${esc(g.label)}${g.note ? ` <small>· ${esc(g.note)}</small>` : ""}`;
      return id ? `<button class="go" data-jump="${esc(id)}">📍 ${lab} →</button>` : `<button class="go" data-go='${esc(JSON.stringify(g))}'>${lab} →</button>`;
    };
    const row = (d, [t, v, kind, ev, go, rsvp], j) => {
      // class events follow the shared list once you've picked your name in the class corner
      const shared = ev && window.HK_CLASS?.going(ev);
      const key = slotKey(d.iso, v, ev), pickable = kind === "ours" || kind === "event" || rsvp === "rsvp", on = shared != null ? shared : !!mine[key];
      // free school items you can say you're going to (closing dinner, dragon boating): only the optional ones fold away in My week
      const folds = kind === "ours" || kind === "event" || kind === "optional";
      if (onlyMine && pickable && folds && !on && !showHidden.has(d.iso)) return "";
      return `<div class="slotrow ${kind || "school"}${pickable && folds && !on ? " off" : ""}"><span>${esc(t)}${kind === "optional" ? ' <em class="opt">Optional</em>' : kind === "event" ? ' <em class="evt">On in town</em>' : ""}</span>`
        + `<span class="sv">${kind === "ours" ? "🎉 " : kind === "event" && !/^\p{Extended_Pictographic}/u.test(v) ? "🎟️ " : ""}${esc(v)}</span>`
        + (ev ? `<span class="evinfo" data-evinfo="${ev}"></span>` : "")
        + (go ? `<span class="slotgo">${[].concat(go).map(goTag).join("")}</span>` : "")
        + (pickable ? `<button class="mine${on ? " on" : ""}" data-mine="${key}" data-ev="${ev || ""}" data-on="${on ? 1 : 0}" aria-pressed="${on}" aria-label="${on ? "Remove from" : "Add to"} my plan">${on ? "✓ Going" : "+ Me"}</button>` : "")
        + `</div>`;
    };
    const route = (r) => r ? `<details class="route" data-k="r:${esc(r.title)}"><summary>${/^day trip/i.test(r.title) ? "⛴️" : "🗺️"} ${esc(r.title)}</summary><ol>${r.steps.map(([em, text, q]) => {
      const p = q && findPlace(q);
      return `<li><span class="re">${em}</span><span>${esc(text)}${p ? ` <button class="rlink" data-jump="${p.id}">Map →</button>` : ""}</span></li>`;
    }).join("")}</ol>${window.HK_ADDWEEK({ title: `${r.em || (/^day trip/i.test(r.title) ? "⛴️" : "🗺️")} ${r.short || r.title}`, idea: r.title })}</details>` : "";
    const bus = (b) => b ? `<details class="bus" data-k="bus"><summary>🚌 Shuttle bus times</summary>
      ${b.map(([title, rows]) => `<div class="bt"><p class="bt-h">${esc(title)}</p>${rows.map(([stop, time]) => `<div class="bt-row"><span class="bt-stop">${esc(stop)}</span><span class="bt-time">${time.split(/,\s*/).map(esc).join("<br>")}</span></div>`).join("")}</div>`).join("")}
      <p class="muted small">Morning buses run every ~15 min. Times are for the first stop, and buses don't wait.</p></details>` : "";
    const dayCard = (d, i) => `<li class="${i === planDay ? "sel" : ""}" data-iso="${d.iso}">
      <div class="day"><small>${esc(d.date)}</small>${esc(d.day)}</div>
      ${wxLine(d.iso)}
      ${d.slots.map((sl, j) => row(d, sl, j)).join("")}
      ${myPlans.filter((p) => p.iso === d.iso).map((p) => `<div class="slotrow personal" data-drag="${esc(JSON.stringify({ move: p.id }))}" title="Drag to another day, or up and down to reorder"><span><span class="grip" aria-hidden="true">⠿</span> ${esc(p.when || "Anytime")} <em class="mine-tag">Mine</em></span><span class="sv">⭐ ${esc(p.title)}${p.place && byId[p.place] ? ` <button class="rlink" data-jump="${p.place}">Map →</button>` : ""}${p.idea ? ` <button class="rlink" data-idea="${esc(p.idea)}" data-iso="${d.iso}">See plan →</button>` : ""}</span><button class="cc-x" data-delmine="${p.id}" aria-label="Remove from my week">✕</button></div>`).join("")}
      ${(() => { const n = onlyMine && !showHidden.has(d.iso) ? d.slots.filter(([, v, k, ev, , r]) => (k === "ours" || k === "event" || (k === "optional" && r === "rsvp")) && !(ev && window.HK_CLASS?.going(ev)) && !mine[slotKey(d.iso, v, ev)]).length : 0;
        return n ? `<button class="hidden-n" data-showhidden="${d.iso}">+ ${n} more you haven't added · show</button>` : ""; })()}
      ${bus(d.bus)}
    </li>`;
    // keep whatever boxes (shuttle, ideas) were open: the plan redraws when the class list refreshes
    const openK = new Set([...document.querySelectorAll("#plan details[open][data-k]")].map((x) => `${x.closest("li[data-iso]")?.dataset.iso}|${x.dataset.k}`));
    const y = window.scrollY;
    $("#plan").innerHTML = PLAN.map((d) => {
      // events classmates added in the class corner show up on their day too
      // events added in the class corner show on their day too (unless already in the schedule)
      const inPlan = new Set(d.slots.map((x) => x[3]).filter(Boolean));
      const extra = customEvents.filter((e) => e.iso === d.iso && !inPlan.has(e.id)).map(customSlot);
      if (!extra.length) return d;
      // morning events go near the top of the day, the rest at the end
      const am = extra.filter(([t]) => /morning|breakfast|\bam\b|^0?[5-9](:\d\d)?\s*am|^0?[5-9]:\d\d|^1[01]:\d\d/i.test(t));
      const rest = extra.filter((x) => !am.includes(x));
      const slots = [...d.slots];
      slots.splice(Math.min(1, slots.length), 0, ...am);
      return { ...d, slots: [...slots, ...rest] };
    }).map(dayCard).join("");
    document.querySelectorAll("#plan details[data-k]").forEach((x) => { if (openK.has(`${x.closest("li[data-iso]")?.dataset.iso}|${x.dataset.k}`)) x.open = true; });
    if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
    $("#plandays").innerHTML = dayBtns;
    // picks tray: your ♥ shortlist and the ideas, as chips you drag onto a day (or tap to add to the day you're viewing)
    const key = (it) => it.idea || it.place;
    const chip = (item, label) => `<button type="button" class="dragchip${trayPick && key(trayPick) === key(item) ? " on" : ""}" data-drag="${esc(JSON.stringify(item))}" aria-expanded="${!!(trayPick && key(trayPick) === key(item))}">${esc(label)}</button>`;
    const fav = live.filter((p) => loved.has(p.id));
    const ideaItem = (o) => ({ title: `${o.em || "🗺️"} ${o.short || o.title}`, idea: o.title });
    const placeItem = (p) => ({ title: `${emojiOf(p)} ${p.name}`, place: p.id });
    // the item you tapped, so you can read it before placing it on a day
    let preview = "";
    if (trayPick) {
      const o = trayPick.idea && OUTINGS.find((x) => x.title === trayPick.idea), p = trayPick.place && byId[trayPick.place];
      const body = o ? `<b>${esc(o.em || "🗺️")} ${esc(o.title)}</b><ol>${o.steps.map(([em, text, q]) => { const pl = q && findPlace(q); return `<li><span class="re">${em}</span><span>${esc(text)}${pl ? ` <button class="rlink" data-jump="${pl.id}">Map →</button>` : ""}</span></li>`; }).join("")}</ol>`
        : p ? `<b>${esc(emojiOf(p))} ${esc(p.name)}</b><p class="small">${esc(p.intro || "")}</p><button class="rlink" data-jump="${p.id}">Open on the map →</button>` : "";
      preview = body ? `<div class="pick-preview">${body}
        <div class="pp-actions"><button type="button" class="cc-mini go" data-addpick="1">⭐ Add to ${esc(dayLabel(PLAN[planDay].iso))}</button><span class="muted small">or drag its chip onto any day</span><button type="button" class="cc-mini" data-closepick="1">Close</button></div></div>` : "";
    }
    $("#picks-body").innerHTML = `
      <p class="picks-h">🧭 Ideas to pick from</p>
      <div class="chips">${OUTINGS.map((o) => chip(ideaItem(o), `${o.em || "🗺️"} ${o.short || o.title}`)).join("")}</div>
      <p class="picks-h">♥ Your shortlist</p>
      <div class="chips">${fav.length ? fav.map((p) => chip(placeItem(p), `${emojiOf(p)} ${p.name}`)).join("") : `<span class="muted small">Tap ♥ on any place in Eat &amp; drink or Explore and it shows up here.</span>`}</div>
      ${preview}
      <p class="muted small">Tap to see what it is · drag it onto a day to add it to your week.</p>`;
    const nMine = Object.values(mine).filter(Boolean).length + myPlans.length;
    $("#plan-mode").innerHTML = `<button class="${onlyMine ? "" : "on"}" data-onlymine="0">Everything</button><button class="${onlyMine ? "on" : ""}" data-onlymine="1">⭐ My week${nMine ? ` · ${nMine}` : ""}</button>`;
    // a shortcut to the class corner (who's going, what you owe, paying Rienno), which sits below the day
    if (!$("#cc-jump")) $("#plan-mode").insertAdjacentHTML("afterend", `<div class="wk-tools"><button type="button" id="cc-jump" class="cc-jump">💸 Who's going &amp; settle up ↓</button>
      <details class="ics-menu"><summary>📅 Add to my calendar</summary><div class="ics-opts"><button type="button" class="cc-mini go" data-ics="mine">⭐ My week</button><button type="button" class="cc-mini" data-ics="all">Everything</button>
      <p class="muted small">Downloads a calendar file. On iPhone tap it and choose Add All; on Android or a computer open it with Google Calendar or Outlook.</p></div></details></div>`);
    window.HK_PRIVATE_RENDER?.();
  }
  let customEvents = [];
  // a class event added in the class corner looks like the built-in ones: "Title (Place)", with a tag that opens the place in the guide
  const venuePlace = (venue) => {
    const v = String(venue || "").toLowerCase().trim();
    if (v.length < 4) return null;
    return live.find((p) => p.name.toLowerCase() === v) || live.find((p) => { const n = p.name.toLowerCase().replace(/\s*\(.*\)$/, ""); return n.length >= 5 && (v.includes(n) || n.startsWith(v)); });
  };
  const customSlot = (e) => {
    const p = venuePlace(e.venue), short = p ? p.name.replace(/\s*\(.*\)$/, "") : "";
    // the place tag already says where, so the venue only goes in the text when it isn't a place in the guide
    return [e.when || "Anytime", `${e.title}${e.venue && !p ? ` · ${e.venue}` : ""}`, "ours", e.id, p ? { label: short, jump: p.id } : null];
  };
  let replanQueued = false; // the class corner asks for a redraw when the shared list changes
  window.HK_REPLAN = () => { if (replanQueued) return; replanQueued = true; requestAnimationFrame(() => { replanQueued = false; renderPlan(); }); };
  window.HK_CUSTOM_EVENTS = (list) => {
    const sig = JSON.stringify(list.map((e) => [e.id, e.iso, e.when, e.title, e.venue]));
    if (sig === window.HK_CUSTOM_EVENTS.sig) return;
    window.HK_CUSTOM_EVENTS.sig = sig; customEvents = list; renderPlan();
  };
  // The class corner knows which booked events you said yes to in the poll: tick those for you
  // (anything you've ticked or unticked yourself stays as you left it)
  window.HK_AUTO_MINE = (evIds) => {
    let changed = false;
    PLAN.forEach((d) => d.slots.forEach(([, v, , ev]) => {
      const k = slotKey(d.iso, v, ev);
      if (ev && evIds.includes(ev) && mine[k] === undefined) { mine[k] = true; changed = true; }
    }));
    if (changed) { store.set(MLS, mine); renderPlan(); }
  };
  document.addEventListener("click", (e) => {
    const m = e.target.closest("[data-mine]");
    if (m) {
      const k = m.dataset.mine, ev = m.dataset.ev, now = m.dataset.on !== "1";
      mine[k] = now; store.set(MLS, mine);
      if (ev && window.HK_CLASS?.going(ev) != null) window.HK_CLASS.tick(ev, now); // also ticks you on the shared list
      else if (ev && now && window.HK_CLASS?.hint) window.HK_CLASS.hint();
      renderPlan(); return;
    }
    if (e.target.closest("[data-addpick]") && trayPick) { addMyPlan({ ...trayPick, iso: PLAN[planDay].iso }); return; }
    if (e.target.closest("[data-closepick]")) { trayPick = null; renderPlan(); return; }
    const dm = e.target.closest("[data-delmine]");
    if (dm) { myPlans = myPlans.filter((p) => p.id !== dm.dataset.delmine); saveMyPlans(); renderPlan(); toast("Removed from your week"); return; }
    const id = e.target.closest("[data-idea]");
    if (id && id.classList.contains("rlink")) { trayPick = { idea: id.dataset.idea, title: id.dataset.idea }; $("#picks").open = true; renderPlan(); $("#picks").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (id) { ideaOpen[id.dataset.iso] = ideaOpen[id.dataset.iso] === id.dataset.idea ? null : id.dataset.idea; renderPlan(); return; }
    if (e.target.closest("#cc-jump")) { document.getElementById("cc")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const sh = e.target.closest("[data-showhidden]");
    if (sh) { showHidden.add(sh.dataset.showhidden); renderPlan(); return; }
    const om = e.target.closest("[data-onlymine]");
    if (om) { onlyMine = om.dataset.onlymine === "1"; store.set("hk-onlymine-v1", onlyMine); renderPlan(); return; }
    const b = e.target.closest("[data-planday]");
    if (!b) return;
    planDay = +b.dataset.planday; renderPlan();
  });

  /* ---------- drag & drop planning (works with touch and mouse) ---------- */
  let drag = null;
  const dropTarget = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el?.closest(".pd") || el?.closest("#plan .slotrow.personal") || el?.closest("#plan > li.sel");
  };
  const isoOf = (t) => (t.classList.contains("pd") ? PLAN[+t.dataset.planday].iso : t.closest("li[data-iso]")?.dataset.iso);
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest("[data-drag]");
    if (!el || e.button > 0 || e.target.closest(".cc-x, .rlink")) return;
    drag = { el, item: JSON.parse(el.dataset.drag), x: e.clientX, y: e.clientY, on: false, over: null };
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
      drag.on = true;
      const g = drag.ghost = drag.el.cloneNode(true);
      g.className = "drag-ghost"; g.removeAttribute("data-drag");
      document.body.appendChild(g); document.body.classList.add("dragging"); drag.el.classList.add("lifted");
    }
    e.preventDefault();
    drag.ghost.style.transform = `translate(${e.clientX + 8}px, ${e.clientY + 8}px)`;
    const t = dropTarget(e.clientX, e.clientY);
    if (t !== drag.over) { drag.over?.classList.remove("drop-ok"); drag.over = t; t?.classList.add("drop-ok"); }
    // nudge the page when dragging near the top or bottom edge
    if (e.clientY < 70) window.scrollBy(0, -12); else if (e.clientY > innerHeight - 90) window.scrollBy(0, 12);
  }, { passive: false });
  const endDrag = (e, cancel) => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.on) { // a tap: show what it is, so they can read it before placing it
      if (!cancel && !d.item.move) { const k = (it) => it.idea || it.place; trayPick = trayPick && k(trayPick) === k(d.item) ? null : d.item; renderPlan(); }
      return;
    }
    d.ghost.remove(); document.body.classList.remove("dragging"); d.el.classList.remove("lifted"); d.over?.classList.remove("drop-ok");
    const t = !cancel && dropTarget(e.clientX, e.clientY);
    if (!t) return;
    const iso = isoOf(t);
    if (!iso) return;
    if (d.item.move) { // move an existing plan to another day, or reorder within the day
      const i = myPlans.findIndex((p) => p.id === d.item.move);
      if (i < 0) return;
      const [p] = myPlans.splice(i, 1); p.iso = iso;
      const before = t.classList.contains("personal") ? myPlans.findIndex((x) => x.id === JSON.parse(t.dataset.drag).move) : -1;
      myPlans.splice(before >= 0 ? before : myPlans.length, 0, p);
      saveMyPlans(); renderPlan(); toast(`Moved to ${dayLabel(iso)}`);
    } else addMyPlan({ ...d.item, iso });
  };
  document.addEventListener("pointerup", (e) => endDrag(e, false));
  document.addEventListener("pointercancel", (e) => endDrag(e, true));

  document.addEventListener("change", (e) => {
    const sel = e.target.closest("[data-addweek]");
    if (!sel || !sel.value) return;
    addMyPlan({ ...JSON.parse(sel.dataset.addweek), iso: sel.value });
    sel.value = "";
  });


  /* ---------- add the week to your own calendar (.ics works with iPhone, Android/Google and Outlook) ---------- */
  const SLOT_TIMES = { morning: ["08:00", "10:00"], lunch: ["12:00", "14:00"], afternoon: ["14:00", "17:00"], evening: ["19:00", "22:00"] };
  function slotWhen(t) {
    const m = String(t).match(/(\d{1,2}):(\d{2})(?:\s*[–-]\s*(\d{1,2}):(\d{2}))?/);
    if (m) {
      const a = `${m[1].padStart(2, "0")}:${m[2]}`;
      const b = m[3] ? `${m[3].padStart(2, "0")}:${m[4]}` : `${String(Math.min(23, +m[1] + 1)).padStart(2, "0")}:${m[2]}`;
      return [a, b];
    }
    const k = Object.keys(SLOT_TIMES).find((x) => String(t).toLowerCase().includes(x));
    return k ? SLOT_TIMES[k] : null; // null = all day
  }
  const icsEsc = (x) => String(x || "").replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  function buildIcs(onlyMineMode) {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Boothies in HK//Becker week//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Boothies in HK", "X-WR-TIMEZONE:Asia/Hong_Kong",
      "BEGIN:VTIMEZONE", "TZID:Asia/Hong_Kong", "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0800", "TZOFFSETTO:+0800", "TZNAME:HKT", "END:STANDARD", "END:VTIMEZONE"];
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    let n = 0;
    const add = (iso, when, title, desc, loc) => {
      const d = iso.replace(/-/g, ""), w = slotWhen(when);
      lines.push("BEGIN:VEVENT", `UID:boothies-${d}-${n++}@boothies-hk.vercel.app`, `DTSTAMP:${stamp}`);
      if (w) lines.push(`DTSTART;TZID=Asia/Hong_Kong:${d}T${w[0].replace(":", "")}00`, `DTEND;TZID=Asia/Hong_Kong:${d}T${w[1].replace(":", "")}00`);
      else { const nx = new Date(`${iso}T12:00:00Z`); nx.setUTCDate(nx.getUTCDate() + 1); lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${nx.toISOString().slice(0, 10).replace(/-/g, "")}`); }
      lines.push(`SUMMARY:${icsEsc(title)}`);
      if (desc) lines.push(`DESCRIPTION:${icsEsc(desc)}`);
      if (loc) lines.push(`LOCATION:${icsEsc(loc)}`);
      lines.push("END:VEVENT");
    };
    PLAN.forEach((d) => {
      const inPlan = new Set(d.slots.map((x) => x[3]).filter(Boolean));
      const extra = customEvents.filter((e) => e.iso === d.iso && !inPlan.has(e.id)).map(customSlot);
      [...d.slots, ...extra].forEach(([t, v, kind, ev, , rsvp]) => {
        if (/^(next day|all day)$/i.test(t) && /check-out|free day|meals on your own/i.test(v)) return; // skip filler lines
        const shared = ev && window.HK_CLASS?.going(ev);
        const picked = kind === "ours" || kind === "event" || (kind === "optional" && rsvp === "rsvp") ? (shared != null ? shared : !!mine[slotKey(d.iso, v, ev)]) : true;
        if (onlyMineMode && !picked) return;
        const icon = kind === "ours" ? "🎉 " : kind === "event" ? "🎟️ " : kind === "optional" ? "(Optional) " : "";
        add(d.iso, t, `${icon}${v.replace(/^\p{Extended_Pictographic}\s*/u, "")}`, kind === "school" || kind === "optional" ? "Becker schedule" : "", "");
      });
      myPlans.filter((p) => p.iso === d.iso).forEach((p) => {
        const o = p.idea && OUTINGS.find((x) => x.title === p.idea), pl = p.place && byId[p.place];
        add(d.iso, p.when || "", `⭐ ${p.title.replace(/^\p{Extended_Pictographic}\s*/u, "")}`, o ? o.steps.map(([, x]) => `• ${x}`).join("\n") : pl ? `${pl.intro || ""}\n${mapUrl(pl)}` : "", pl ? `${pl.name}${pl.addressEn ? `, ${pl.addressEn}` : ""}` : "");
      });
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ics]");
    if (!b) return;
    const blob = new Blob([buildIcs(b.dataset.ics === "mine")], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = b.dataset.ics === "mine" ? "boothies-my-week.ics" : "boothies-whole-week.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("Calendar file ready: open it to add the events");
  });

  /* ---------- start here ---------- */
  const TLS = "hk-taste-v1";
  const tried = new Set(JSON.parse(localStorage.getItem(TLS) || "[]"));
  let openTaste = null;
  function renderStart() {
    const ess = PLACES.filter((p) => p.essential && p.status !== "closed").sort((a, b) => a.essential - b.essential);
    $("#essentials").innerHTML = ess.map((p, i) => `<button class="ess" data-jump="${p.id}" style="--c:${colorOf(p)}">
      <span class="n">${i + 1}</span><span class="em">${emojiOf(p)}</span>
      <h3>${esc(p.essentialTitle || p.name)}</h3><p>${esc(p.essentialWhy || "")}</p></button>`).join("");
    $("#taste").innerHTML = TASTE.map((t) => {
      const byDist = (t.where || []).filter((w) => w.lat != null).sort((a, b) => km(HOME.campus, a) - km(HOME.campus, b));
      const near = byDist[0] && km(HOME.campus, byDist[0]) < 4 ? byDist[0] : null;
      const famous = (t.where || []).filter((w) => w.famous && w !== near).slice(0, 2);
      const gm = (w) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${w.place} ${w.address || w.area} Hong Kong`)}`;
      return `<div class="taste${tried.has(t.name) ? " done" : ""}${openTaste === t.name ? " open" : ""}" data-tasteopen="${esc(t.name)}">
        <div class="row"><span class="em">${t.emoji}</span><h3>${esc(t.name)}</h3>
        <button class="check" data-taste="${esc(t.name)}" aria-label="Mark as tried">✓</button></div>
        <div class="taste-more">
          <p>${esc(t.what)}</p>
          ${t.fun_fact ? `<p class="fact"><b>Fun fact:</b> ${esc(t.fun_fact)}</p>` : ""}
          <div class="spots">
            ${near ? `<a target="_blank" rel="noopener" href="${gm(near)}">📍 Near Booth: ${esc(near.place)}</a>` : ""}
            ${famous.map((w) => `<a target="_blank" rel="noopener" href="${gm(w)}">⭐ Famous: ${esc(w.place)} · ${esc(w.area)}</a>`).join("")}
          </div>
        </div>
      </div>`;
    }).join("");
    const n = TASTE.filter((t) => tried.has(t.name)).length;
    $("#taste-score").textContent = `${n} of ${TASTE.length}`;
    $("#taste-bar").style.width = TASTE.length ? `${(n / TASTE.length) * 100}%` : "0";
    // tips may carry [label](https://…) links, e.g. App Store / Google Play
    const linkify = (t) => esc(t).replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, (m, l, u) => `<a href="${u}" target="_blank" rel="noopener">${l}</a>`);
    $("#tips").innerHTML = TIPS.map((g) => `<div><h3>${esc(g.title)}</h3><ul>${g.items.map((x) => `<li>${linkify(x)}</li>`).join("")}</ul></div>`).join("");
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-taste]");
    if (t) {
      const k = t.dataset.taste;
      if (tried.has(k)) tried.delete(k); else { tried.add(k); toast(tried.size === TASTE.length ? "🏆 Full Hong Kong food passport!" : "😋 Nice. One more off the list"); }
      localStorage.setItem(TLS, JSON.stringify([...tried]));
      renderStart();
      return;
    }
    const to = e.target.closest("[data-tasteopen]");
    if (to) { openTaste = openTaste === to.dataset.tasteopen ? null : to.dataset.tasteopen; renderStart(); return; }
    const j = e.target.closest("[data-jump]");
    if (j) {
      const p = byId[j.dataset.jump];
      setTab(p.tab, { where: FOOD.has(p.tab) ? whereOf(p) : "all" });
      window.scrollTo({ top: contentTop(), behavior: "smooth" });
      setTimeout(() => focus(p.id, { fromMap: true }), 350);
    }
  });

  /* ---------- tabs ---------- */
  function syncTabs(tab) {
    document.querySelectorAll(".tab").forEach((b) => {
      const on = b.dataset.group === "explore" ? EXPLORE.has(tab) : b.dataset.tab === tab;
      b.classList.toggle("active", on); b.setAttribute("aria-selected", on);
    });
    $("#seg").hidden = !EXPLORE.has(tab);
    document.body.classList.toggle("explore-tab", EXPLORE.has(tab));
    document.querySelectorAll("#seg button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  }
  function markTab(tab) {
    state.tab = tab;
    syncTabs(tab);
    history.replaceState(null, "", `#${tab}`);
  }
  // "Sai Wan" is no longer its own tab: it's Eat & drink with where = near Booth (fewer tabs, less to scan)
  function setTab(tab, { mood = "all", q = "", keepWhere = false, where } = {}) {
    let w = null;
    if (tab === "saiwan") { tab = "city"; w = "saiwan"; }
    if (where) w = where;
    else if (w == null) w = keepWhere && FOOD.has(state.tab) ? state.where : "all";
    if (!FOOD.has(tab) && !where) w = "all";
    state.where = w;
    if (!FOOD.has(tab)) state.style = "any";
    state.tab = tab; state.mood = mood; state.area = "all"; state.kinds = new Set(); state.all = false; state.boothies = false; state.limit = startLimit(tab); state.flat = false; state.section = "all"; state.shortlist = false; state.active = null; state.q = q;
    $("#search").value = q;
    $("#shortlist-btn").classList.remove("on");
    syncTabs(tab);
    const isWeek = !TABS[tab];
    $("#finder").hidden = isWeek;
    $("#week").hidden = tab !== "week";
    $("#start").hidden = tab !== "start";
    if (!isWeek) { render({ fit: false }); requestAnimationFrame(() => { map.invalidateSize(); drawMarkers(shownNow(), true); }); } else renderMoods();
    history.replaceState(null, "", `#${tab}`);
  }

  /* ---------- dice ---------- */
  let lastPick = null;
  function pick() {
    let items = TABS[state.tab] ? filtered() : live.filter((p) => p.tab === "saiwan");
    if (!items.length) items = live.filter((p) => p.tab === (TABS[state.tab] ? state.tab : "saiwan"));
    if (items.length > 1) items = items.filter((p) => p !== lastPick);
    const choice = items[Math.floor(Math.random() * items.length)];
    lastPick = choice;
    const dlg = $("#picked"), slot = $("#slot"), txt = $("#slot-text");
    $("#picked-card").innerHTML = "";
    if (!dlg.open) dlg.showModal();
    slot.classList.add("rolling");
    let n = 0; const total = 16;
    (function tick() {
      const r = n < total - 1 ? items[Math.floor(Math.random() * items.length)] : choice;
      txt.textContent = `${emojiOf(r)} ${r.name}`;
      if (++n < total) setTimeout(tick, 40 + n * n * 1.1);
      else {
        slot.classList.remove("rolling");
        $("#picked-card").innerHTML = card({ ...choice }).replace('class="card', 'class="card open');
      }
    })();
  }

  /* ---------- events ---------- */
  document.addEventListener("click", (e) => {
    const love = e.target.closest("[data-love]");
    if (love) {
      e.stopPropagation();
      const id = love.dataset.love;
      if (loved.has(id)) { loved.delete(id); toast("Removed from shortlist"); } else { loved.add(id); toast("♥ Added to shortlist"); }
      saveLoved();
      renderPlan(); // keep the week's picks tray in step with the shortlist
      document.querySelectorAll(`[data-love="${id}"]`).forEach((b) => b.classList.toggle("on", loved.has(id)));
      if (markers[id]) markers[id].setIcon(pinIcon(byId[id]));
      if (state.shortlist) render({ fit: false });
      return;
    }
    if (e.target.closest("[data-go-list]")) { window.scrollTo({ top: contentTop(), behavior: "smooth" }); return; }
    if (e.target.closest("[data-back]")) { history.back(); return; }
    if (e.target.closest("[data-clearf]")) { state.kinds = new Set(); state.style = "any"; state.local = false; state.area = "all"; state.section = "all"; state.limit = 10; render(); return; }
    const sa = e.target.closest("[data-seeall]");
    if (sa) {
      // remember where we came from so "← Back" (and the phone's back gesture) returns to the grouped view
      backTo = { tab: state.tab, mood: state.mood, where: state.where, style: state.style, label: sa.dataset.label || "" };
      history.pushState({ seeall: 1 }, "", location.hash);
      const [t, v] = sa.dataset.seeall.split(/:(.*)/);
      if (t === "mood" && FOOD.has(state.tab)) { setTab("city", { mood: v, keepWhere: true }); }
      else if (t === "mood") { state.mood = v; state.limit = 10; render(); }
      else { state.kinds = new Set([v]); state.limit = 10; render(); }
      window.scrollTo({ top: contentTop(), behavior: "smooth" });
      return;
    }
    if (e.target.closest("[data-showmore]")) { state.limit += startLimit(state.tab); render({ fit: false }); return; }
    const all = e.target.closest("[data-all]");
    if (all) { e.preventDefault(); state.all = all.dataset.all === "1"; render(); return; }
    if (e.target.closest("[data-more]")) { state.more = !state.more; render({ fit: false }); return; }
    if (e.target.closest("[data-reset]")) {
      state.area = "all"; state.section = "all"; state.kinds = new Set(); state.local = false; state.boothies = false; render(); return;
    }
    if (e.target.id === "share") {
      e.preventDefault();
      const url = `${location.origin}${location.pathname}?s=${[...loved].join(",")}`;
      (navigator.clipboard?.writeText(url) || Promise.reject()).then(() => toast("Link copied. Paste it in the group chat!"), () => prompt("Copy this link:", url));
      return;
    }
    const go = e.target.closest("[data-go]");
    if (go) { const g = JSON.parse(go.dataset.go); setTab(g.tab, g); window.scrollTo({ top: contentTop(), behavior: "smooth" }); return; }
    const t = e.target.closest("[data-mood],[data-area],[data-section],[data-tab],[data-local],[data-kind],[data-boothies]");
    if (t) {
      state.limit = startLimit(state.tab); state.flat = false;
      if (t.dataset.tab) {
        if (t.dataset.group === "explore" && EXPLORE.has(state.tab)) return;
        backTo = null;
        setTab(t.dataset.tab);
        const top = contentTop();
        if (window.scrollY > top + 5 || window.scrollY < top - 5) window.scrollTo({ top, behavior: "smooth" });
        return;
      }
      if (t.dataset.mood) {
        if (!TABS[state.tab] || state.shortlist) setTab(!TABS[state.tab] ? "saiwan" : state.tab);
        state.mood = t.dataset.mood; state.active = null;
      }
      if (t.dataset.area) state.area = t.dataset.area;
      if (t.dataset.section) state.section = t.dataset.section;
      if (t.dataset.local) state.local = !state.local;
      if (t.dataset.boothies) state.boothies = !state.boothies;
      if (t.dataset.kind !== undefined) {
        const k = t.dataset.kind;
        if (!k) state.kinds.clear(); else if (state.kinds.has(k)) state.kinds.delete(k); else state.kinds.add(k);
      }
      render();
      return;
    }
    const c = e.target.closest(".cards .card");
    if (c && !e.target.closest("a, .addweek, select")) {
      const open = c.classList.contains("open") && state.active === c.dataset.id;
      if (open) { c.classList.remove("open"); return; }
      focus(c.dataset.id);
    }
  });
  document.addEventListener("click", (e) => {
    const d = e.target.closest("[data-driver]");
    if (!d) return;
    e.stopPropagation();
    const p = byId[d.dataset.driver];
    $("#driver-body").innerHTML = `<div class="big" lang="zh">${esc(p.zh || p.name)}</div>
      ${p.addressZh ? `<div class="addr" lang="zh">${esc(p.addressZh)}</div>` : ""}
      <p class="en">${esc(p.name)}${p.addressEn ? ` · ${esc(p.addressEn)}` : ""}</p>`;
    $("#driver").showModal();
  }, true);
  $("#driver-close").addEventListener("click", () => $("#driver").close());
  $("#driver").addEventListener("click", (e) => { if (e.target.id === "driver") e.target.close(); });
  let hoverId = null;
  $("#grid").addEventListener("mouseover", (e) => {
    const c = e.target.closest(".card"); const id = c?.dataset.id || null;
    if (id === hoverId) return;
    const prev = hoverId; hoverId = id;
    [prev, id].forEach((k) => { if (k && markers[k]) { const el = markers[k].getElement()?.querySelector(".pin"); el?.classList.toggle("hot", k === hoverId || k === state.active); } });
  });
  $("#grid").addEventListener("mouseleave", () => {
    if (hoverId && markers[hoverId] && hoverId !== state.active) markers[hoverId].getElement()?.querySelector(".pin")?.classList.remove("hot");
    hoverId = null;
  });
  $("#search").addEventListener("input", (e) => { state.q = e.target.value; state.limit = startLimit(state.tab); render(); });
  $("#pick").addEventListener("click", pick);
  $("#reroll").addEventListener("click", pick);
  $("#close").addEventListener("click", () => $("#picked").close());
  $("#goto").addEventListener("click", () => {
    $("#picked").close();
    if (!lastPick) return;
    setTab(lastPick.tab, { where: FOOD.has(lastPick.tab) ? whereOf(lastPick) : "all" });
    if (!filtered().includes(lastPick)) { state.mood = "all"; state.area = "all"; state.section = "all"; state.q = ""; $("#search").value = ""; render({ fit: false }); }
    window.scrollTo({ top: contentTop(), behavior: "smooth" });
    setTimeout(() => focus(lastPick.id, { fromMap: true }), 300);
  });
  $("#picked").addEventListener("click", (e) => { if (e.target.id === "picked") e.target.close(); });
  $("#shortlist-btn").addEventListener("click", () => {
    if (state.shortlist) return setTab(!TABS[state.tab] ? "saiwan" : state.tab);
    if (!TABS[state.tab]) setTab("saiwan");
    state.shortlist = true; state.active = null;
    $("#shortlist-btn").classList.add("on");
    render();
    window.scrollTo({ top: contentTop(), behavior: "smooth" });
  });

  /* ---------- boot ---------- */
  const shared = new URLSearchParams(location.search).get("s");
  if (shared) shared.split(",").filter((id) => byId[id]).forEach((id) => loved.add(id));
  saveLoved();
  renderPlan();
  loadWeather();
  setInterval(loadWeather, 30 * 60e3);
  // phones pause background tabs, so check again when someone comes back to the site (still at most hourly)
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") loadWeather(); });
  renderStart();
  const start = location.hash.slice(1);
  setTab(["saiwan", "start", "city", "sights", "hikes", "shop", "week"].includes(start) ? start : "city");
  booted = true;
  if (shared) { $("#shortlist-btn").click(); toast("Showing the shortlist someone shared with you"); }
})();
