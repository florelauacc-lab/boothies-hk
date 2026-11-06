(() => {
  const { HOME, PLACES, PLAN, TASTE = [], TIPS = [] } = window.HK;

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
        { k: "beach", label: "Beaches", em: "🏖️", c: C.cyan },
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
    ["cwb", "near the Park Lane"], ["south", "in Stanley 🛶"], ["kowloon", "across the harbour"],
  ];
  function whereOf(p) {
    const a = `${p.area} ${p.addressEn || ""}`.toLowerCase();
    if (/kennedy town|sai ying pun|shek tong tsui|sai wan|mount davis|pok fu lam|hku/.test(a)) return "saiwan";
    if (/tsim sha tsui|tst|jordan|mong kok|yau ma tei|kowloon|prince edward|sham shui po|hung hom|to kwa wan/.test(a)) return "kowloon";
    if (/causeway|wan chai|north point|tai hang|happy valley|quarry|braemar|tin hau|jardine|fortress hill|tai koo|shau kei/.test(a)) return "cwb";
    if (/stanley|repulse|tai tam|chung hom|deep water bay/.test(a)) return "south";
    if (/central|soho|sheung wan|admiralty|mid-levels|lan kwai|lkf|noho|tai kwun|peak|hollywood/.test(a)) return "central";
    return "other";
  }
  const FOOD_STYLES = [["any", "any style"], ["local", "a local favourite 🏮"], ["veg", "vegetarian-friendly 🥬"], ["cheap", "cheap & cheerful $"], ["fancy", "a bit fancy $$$"]];
  const WHAT = [
    ["food:all", "anything to eat or drink"], ["food:coffee", "☕ good coffee"], ["food:lunch", "🍜 lunch"], ["food:dinner", "🥘 dinner"], ["food:dessert", "🍧 dessert"],
    ["food:drinks", "🍸 drinks"], ["food:late-night", "🌙 a late-night bite"],
    ["sights:all", "📸 something to see"], ["hikes:all", "🥾 a hike"], ["shop:all", "🛍️ shopping"],
  ];

  const KIND_EMOJI = {
    "Dim sum": "🥟", "Roast meats & noodles": "🍜", "Cha chaan teng & cafés": "🧋", "Cantonese & seafood": "🥢",
    "Dessert & sweets": "🍧", "Japanese": "🍣", "Korean": "🥩", "Thai & SE Asian": "🌶️", "Western & Med": "🍝",
    "Vegan & vegetarian": "🥬", "Cocktails": "🍸", "Wine bars": "🍷", "Beer & pubs": "🍺", "Jazz & live music": "🎷",
    "Rooftops & views": "🌃", "Clubbing": "🪩",
  };
  let lastKinds = { list: [], counts: {} };
  // Six big groups for the map legend (the detailed kinds still power search)
  const GROUP_OF = {
    "Dim sum": "Local HK", "Roast meats & noodles": "Local HK", "Cha chaan teng & cafés": "Local HK", "Cantonese & seafood": "Local HK",
    "Japanese": "Asian", "Korean": "Asian", "Thai & SE Asian": "Asian",
    "Western & Med": "Western",
    "Dessert & sweets": "Dessert",
    "Cocktails": "Bars", "Wine bars": "Bars", "Beer & pubs": "Bars", "Jazz & live music": "Bars", "Rooftops & views": "Bars", "Clubbing": "Bars",
    "Vegan & vegetarian": "Veggie",
  };
  const GROUP_EMOJI = { "Local HK": "🥢", "Asian": "🍜", "Western": "🍝", "Dessert": "🍧", "Bars": "🍸", "Veggie": "🥬" };
  const GROUP_ORDER = Object.keys(GROUP_EMOJI);
  const GROUP_SHORT = { "Local HK": "Local", "Asian": "Asian", "Western": "Western", "Dessert": "Sweets", "Bars": "Bars", "Veggie": "Veggie" };
  const groupsOf = (p) => uniq((p.kinds || []).map((k) => GROUP_OF[k]));

  const LS = "hk-shortlist-v1";
  const loved = new Set(JSON.parse(localStorage.getItem(LS) || "[]"));
  const state = { tab: "saiwan", mood: "all", area: "all", section: "all", q: "", shortlist: false, active: null, local: false, boothies: false, all: false, more: false, limit: 6, kinds: new Set(), where: "saiwan", style: "any" };

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
    localStorage.setItem(LS, JSON.stringify([...loved]));
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
  const startLimit = (tab) => (tab === "sights" || tab === "hikes" ? 9 : 6);
  let me = null; // the user's location once they tap "Near me"
  const rank = (p) => (p.essential ? 0 : p.picked ? 1 : p.lite ? 3 : 2);
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
      }
      if (state.boothies && !p.boothies) return false;
      if (state.kinds.size && !groupsOf(p).some((g) => state.kinds.has(g))) return false;
      if (q) {
        const hay = [p.name, p.zh, p.cuisine, p.area, p.section, p.intro, p.reviews, p.classmateNote, ...(p.order || []), ...(p.kinds || []), ...p.category].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => me && a.lat != null && b.lat != null ? km(me, a) - km(me, b) : rank(a) - rank(b));
  }
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];

  /* ---------- rendering ---------- */
  function renderMoods() {
    document.body.classList.toggle("no-picker", !TABS[state.tab] && !state.shortlist);
    const isFood = FOOD.has(state.tab);
    const whatVal = isFood ? `food:${state.mood}` : TABS[state.tab] ? `${state.tab}:all` : "food:all";
    const styles = isFood ? FOOD_STYLES : [["all", "any kind"], ...(TABS[state.tab]?.moods || []).map((m) => [m.k, `${m.label.toLowerCase()} ${m.em}`])];
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
    const id = e.target.id, v = e.target.value;
    if (id === "b-what") {
      const [t, m] = v.split(":");
      if (t === "food") setTab("city", { mood: m, keepWhere: true });
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
      .forEach((p) => groupsOf(p).forEach((g) => { kindCounts[g] = (kindCounts[g] || 0) + 1; }));
    [...state.kinds].forEach((k) => { if (!kindCounts[k]) state.kinds.delete(k); });
    const kinds = GROUP_ORDER.filter((g) => kindCounts[g]);
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

  function card(p, i = 0) {
    const tab = TABS[p.tab];
    const tags = uniq([p.section, ...p.category.map((c) => moodOf(c, p.tab)?.label)]).map((t) => `<span class="tag">${esc(t)}</span>`).join("")
      + (p.veg ? `<span class="tag badge-veg">🥬 ${esc(p.veg)}</span>` : "") + (p.boothies ? `<span class="tag badge-boothies">👥 Boothies map</span>` : "") + (p.local ? `<span class="tag badge-local">🏮 Local favourite</span>` : "") + (p.picked ? `<span class="tag badge-pick">★ Class pick</span>` : "") + (p.flags || []).map((f) => `<span class="tag warn">${esc(f)}</span>`).join("");
    const meta = [
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
    ].filter(Boolean).join("");
    return `<article class="card${state.active === p.id ? " active open" : ""}" data-id="${p.id}" style="--c:${colorOf(p)};animation-delay:${Math.min(i, 12) * 30}ms">
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
      const extra = allCount() - pool().filter((p) => !p.lite).length;
      const curated = !state.all && !state.boothies && !state.q.trim();
      countHtml = `${items.length} ${curated ? "hand-picked " : ""}place${items.length === 1 ? "" : "s"}`
        + (extra > 0 && curated ? ` · <a href="#" data-all="1">+ ${extra} classmate picks from the Boothies map</a>` : "")
        + (state.all ? ` · <a href="#" data-all="0">Back to hand-picked only</a>` : "");
    }
    $("#count").innerHTML = countHtml;
    const shown = items.slice(0, state.limit);
    const rest = items.length - shown.length;
    $("#grid").innerHTML = items.length ? shown.map(card).join("") + (rest > 0 ? `<button class="show-more" data-showmore="1">Show ${Math.min(rest, startLimit(state.tab))} more <small>(${rest} more to see)</small></button>` : "")
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
      chips = ordered.filter((k) => k !== "Veggie").map((k) => `<button class="lg${state.kinds.has(k) ? " on" : ""}" data-kind="${esc(k)}" aria-pressed="${state.kinds.has(k)}"><span class="li">${GROUP_EMOJI[k] || "•"}</span><span class="ll"><span class="long">${esc(k)}</span><span class="short">${esc(GROUP_SHORT[k] || k)}</span></span></button>`).join("")
        ;
    } else if (TABS[state.tab] && !state.shortlist) {
      chips = TABS[state.tab].moods.filter((m) => pool().some((p) => p.category.includes(m.k)))
        .map((m) => `<button class="lg${state.mood === m.k ? " on" : ""}" data-mood="${m.k}"><span class="li">${m.em}</span><span class="ll">${esc(m.label)}</span></button>`).join("")
        + (state.mood !== "all" ? `<button class="lg clear" data-mood="all"><span class="li">✕</span><span class="ll">All</span></button>` : "");
    }
    $("#legend").innerHTML = `<span class="lg home">${homeLbl}</span>${chips}`;
  }

  function focus(id, { fromMap = false, open = true } = {}) {
    const prev = state.active;
    state.active = id;
    document.querySelectorAll(".card.active").forEach((c) => c.classList.remove("active"));
    let el = document.querySelector(`.cards .card[data-id="${id}"]`);
    if (!el && filtered().some((p) => p.id === id)) {
      state.limit = Math.max(state.limit, filtered().findIndex((p) => p.id === id) + 1);
      render({ fit: false }); el = document.querySelector(`.cards .card[data-id="${id}"]`);
    }
    if (el) { el.classList.add("active"); if (open) el.classList.add("open"); }
    if ((byId[id] && byId[id].pins) || (prev && byId[prev] && byId[prev].pins)) drawMarkers(filtered().slice(0, state.limit), false);
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
  function renderPlan() {
    const today = new Date().toISOString().slice(0, 10);
    if (planDay == null) planDay = Math.max(0, PLAN.findIndex((d) => d.iso === today));
    const dayBtns = PLAN.map((d, i) => `<button class="pd${i === planDay ? " on" : ""}" data-planday="${i}"><b>${esc(d.day)}</b><span>${esc(d.date.split(" ")[0])}</span></button>`).join("");
    const dayCard = (d, i) => `<li class="${i === planDay ? "sel" : ""}">
      <div class="day"><small>${esc(d.date)}</small>${esc(d.day)}</div>
      ${d.slots.map(([t, v, kind]) => `<div class="slotrow ${kind === "ours" ? "ours" : "school"}"><span>${esc(t)}</span>${kind === "ours" ? "🎉 " : ""}${esc(v)}</div>`).join("")}
      ${[d.go, d.go2].filter(Boolean).map((g) => `<button class="go" data-go='${esc(JSON.stringify(g))}'>${esc(g.label)} →</button>`).join(" ")}
    </li>`;
    $("#plan").innerHTML = PLAN.map(dayCard).join("");
    $("#plandays").innerHTML = dayBtns;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-planday]");
    if (!b) return;
    planDay = +b.dataset.planday; renderPlan();
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
    $("#tips").innerHTML = TIPS.map((g) => `<div><h3>${esc(g.title)}</h3><ul>${g.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("");
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
    else if (w == null) w = keepWhere && FOOD.has(state.tab) ? state.where : FOOD.has(tab) ? (q ? "all" : "saiwan") : "all";
    if (!FOOD.has(tab) && !where) w = "all";
    state.where = w;
    if (!FOOD.has(tab)) state.style = "any";
    state.tab = tab; state.mood = mood; state.area = "all"; state.kinds = new Set(); state.all = false; state.boothies = false; state.limit = startLimit(tab); state.section = "all"; state.shortlist = false; state.active = null; state.q = q;
    $("#search").value = q;
    $("#shortlist-btn").classList.remove("on");
    syncTabs(tab);
    const isWeek = !TABS[tab];
    $("#finder").hidden = isWeek;
    $("#week").hidden = tab !== "week";
    $("#start").hidden = tab !== "start";
    if (!isWeek) { render({ fit: false }); requestAnimationFrame(() => { map.invalidateSize(); drawMarkers(filtered().slice(0, state.limit), true); }); } else renderMoods();
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
      document.querySelectorAll(`[data-love="${id}"]`).forEach((b) => b.classList.toggle("on", loved.has(id)));
      if (markers[id]) markers[id].setIcon(pinIcon(byId[id]));
      if (state.shortlist) render({ fit: false });
      return;
    }
    if (e.target.closest("[data-go-list]")) { window.scrollTo({ top: contentTop(), behavior: "smooth" }); return; }
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
      state.limit = startLimit(state.tab);
      if (t.dataset.tab) {
        if (t.dataset.group === "explore" && EXPLORE.has(state.tab)) return;
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
    if (c && !e.target.closest("a")) {
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
  renderStart();
  const start = location.hash.slice(1);
  setTab(["saiwan", "start", "city", "sights", "hikes", "shop", "week"].includes(start) ? start : "city");
  booted = true;
  if (shared) { $("#shortlist-btn").click(); toast("Showing the shortlist someone shared with you"); }
})();
