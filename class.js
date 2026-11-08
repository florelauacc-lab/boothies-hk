// Class corner: who's going to what, bills split evenly, extra events, settling up and study groups.
// Live: a shared list on the server (/api/class) that anyone with the class passcode can edit.
// Fallback: the encrypted snapshot (private.enc.js), read-only, decrypted in the browser with the passcode.
(() => {
  const root = document.getElementById("cc");
  if (!root) return;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // remembered on this phone (localStorage, with a cookie copy in case the browser clears one of them)
  const get = (k) => {
    try { const v = localStorage.getItem(k); if (v != null) return JSON.parse(v); } catch (e) { /* private mode */ }
    const m = document.cookie.match(new RegExp(`(?:^|; )${k}=([^;]*)`));
    try { return m ? JSON.parse(decodeURIComponent(m[1])) : null; } catch (e) { return null; }
  };
  const set = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ }
    document.cookie = `${k}=${encodeURIComponent(JSON.stringify(v))}; max-age=${60 * 60 * 24 * 400}; path=/; SameSite=Lax; Secure`;
  };
  const forget = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } document.cookie = `${k}=; max-age=0; path=/`; };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const toast = (m) => { const t = document.getElementById("toast"); if (!t) return; t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200); };
  const DAYS = (window.HK?.PLAN || []).map((d) => [d.iso, `${d.day} ${d.date}`]);
  // link an event's venue to the matching place in the guide, so one tap opens it on the map
  const PLACES = (window.HK?.PLACES || []).filter((p) => p.status !== "closed");
  const placeFor = (venue) => {
    const v = String(venue || "").toLowerCase();
    if (v.length < 4) return null;
    return PLACES.find((p) => p.name.toLowerCase() === v) || PLACES.find((p) => { const n = p.name.toLowerCase().replace(/\s*\(.*\)$/, ""); return n.length >= 5 && v.includes(n); });
  };

  /* ---------- money ---------- */
  let rates = { USD: 0.128, GBP: 0.099, EUR: 0.111, JPY: 19.6, CNY: 0.92, KRW: 179, SGD: 0.166, TWD: 4.1, CAD: 0.178, AUD: 0.196, INR: 10.9, ILS: 0.47, CHF: 0.103 };
  let liveRates = false;
  const CUR = [["USD", "US$"], ["GBP", "£"], ["EUR", "€"], ["JPY", "¥"], ["CNY", "CN¥"], ["KRW", "₩"], ["SGD", "S$"], ["TWD", "NT$"], ["CAD", "C$"], ["AUD", "A$"], ["INR", "₹"], ["ILS", "₪"], ["CHF", "CHF "]];
  const SYM = Object.fromEntries(CUR);
  const cached = get("hk-rates-v1");
  if (cached && Date.now() - cached.t < 12 * 3600e3) { rates = { ...rates, ...cached.r }; liveRates = true; }
  else fetch("https://open.er-api.com/v6/latest/HKD").then((r) => r.json()).then((j) => {
    if (j && j.rates) { const r = Object.fromEntries(CUR.map(([c]) => [c, j.rates[c]]).filter(([, v]) => v)); rates = { ...rates, ...r }; liveRates = true; set("hk-rates-v1", { t: Date.now(), r }); if (data) render(); }
  }).catch(() => {});
  const hk = (n) => `HK$${Math.round(n).toLocaleString("en")}`;
  const fx = (n, c = cur) => { const v = n * rates[c]; return `${SYM[c]}${v >= 100 ? Math.round(v).toLocaleString("en") : v.toFixed(c === "JPY" || c === "KRW" ? 0 : 2)}`; };
  const total = (e) => (e.expenses || []).reduce((t, x) => t + (+x.hkd || 0), 0);
  // each person's share: the set price per person, or (if a bill was entered instead) the bill split evenly
  const each = (e) => (e.price > 0 ? +e.price : total(e) && e.going.length ? total(e) / e.going.length : null);
  const PAY_METHODS = ["PayPal / card", "Wise / bank", "FPS", "WeChat Pay", "Cash"];

  /* ---------- state ---------- */
  let data = null, mode = "locked", pass = get("hk-pass-v1") || "", orgPass = get("hk-org-v1") || "";
  let me = get("hk-me-v1") || "", cur = get("hk-cur-v1") || "USD";
  let editing = null, busy = false;
  const openEv = new Set();
  const live = () => mode === "live";

  function fromSnapshot(d) {
    const ISO = { "sun-dimsum": "2026-11-15", "mon-hotpot": "2026-11-16", "wed-tram": "2026-11-18", "thu-dpd": "2026-11-19" };
    const time = (w) => String(w || "").replace(/^[A-Za-z]{3} \d{1,2} [A-Za-z]{3},?\s*/, "").replace(/^./, (c) => c.toUpperCase());
    return { ...d, extra: d.extra || [], settle: {}, events: Object.entries(d.events).map(([id, e], i) => ({ id, iso: ISO[id], order: i, ...e, when: time(e.when), expenses: (e.expenses || []).map((x, j) => ({ id: `s${j}`, ...x })) })) };
  }
  async function decryptSnapshot(p) {
    const L = window.HK_LOCKED; if (!L) throw new Error("no snapshot");
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey("raw", enc.encode(p), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: unb64(L.salt), iterations: L.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(L.iv) }, key, unb64(L.ct))));
  }
  async function api(method, body) {
    const r = await fetch("/api/class", { method, headers: { "Content-Type": "application/json", "X-Class-Pass": pass, ...(orgPass ? { "X-Organiser-Pass": orgPass } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    if (r.status === 401) throw Object.assign(new Error("wrong"), { code: 401 });
    if (!r.ok) throw Object.assign(new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`), { code: r.status });
    return r.json();
  }
  const msg = (t) => { const m = $("#cc-msg"); if (m) m.textContent = t; };
  const WRONG = "That's not it. The passcode is pinned in the class WhatsApp group.";

  async function unlock(p, quiet) {
    pass = p.trim().toLowerCase();
    try {
      let s = await api("GET");
      if (!s.seeded) { // first ever unlock: load the poll results into the shared list
        const snap = fromSnapshot(await decryptSnapshot(pass));
        try { s = await api("POST", { op: "seed", data: { ...snap, events: Object.fromEntries(snap.events.map((e) => [e.id, e])) } }); }
        catch (err) { if (err.code === 409) s = await api("GET"); else throw err; } // someone else loaded it a moment ago
      }
      data = s; mode = "live";
    } catch (e) {
      if (e.code === 401) { if (quiet) forget("hk-pass-v1"); else msg(WRONG); return; }
      try { data = fromSnapshot(await decryptSnapshot(pass)); mode = "static"; } // offline: read-only copy
      catch (e2) { if (quiet) forget("hk-pass-v1"); else msg(WRONG); return; }
    }
    set("hk-pass-v1", pass);
    render();
  }

  async function op(body, optimistic) {
    if (!live()) { toast("You're offline, so changes can't be saved right now"); return; }
    if (optimistic) { optimistic(); render(); }
    busy = true;
    try { data = await api("POST", { by: me, ...body }); return true; }
    catch (e) { toast(`Couldn't save: ${e.message}`); try { data = await api("GET"); } catch (e2) { /* keep local */ } return false; }
    finally { busy = false; render(); }
  }
  async function refresh() { if (live() && !busy && !editing && !billDraft && !seatEditing && document.visibilityState === "visible" && !root.contains(document.activeElement)) { try { data = await api("GET"); render(); } catch (e) { /* ignore */ } } }
  setInterval(refresh, 30000); // pick up other people's ticks
  document.addEventListener("visibilitychange", refresh);

  /* ---------- people & money owed ---------- */
  // The list to tick against: everyone in the Becker section, plus anyone added
  function roster() {
    const out = [], seen = new Set();
    (data.groups || []).forEach(([, ns]) => ns.forEach((n) => { const away = /\*$/.test(n), name = n.replace(/\*+$/, ""); if (!seen.has(name)) { seen.add(name); out.push({ name, away }); } }));
    [data.payTo, ...(data.extra || []), ...data.events.flatMap((e) => e.going), ...data.events.flatMap((e) => e.expenses.map((x) => x.paidBy))]
      .forEach((n) => { if (n && !seen.has(n)) { seen.add(n); out.push({ name: n, guest: true }); } });
    return out.sort((a, b) => (a.away - b.away) || a.name.localeCompare(b.name));
  }
  const people = () => roster().filter((p) => !p.away).map((p) => p.name);
  const payments = (n) => (data.settle?.[n]?.payments || []);
  function balances() { // + means owed money, - means owes
    const b = {};
    data.events.forEach((e) => {
      const s = each(e); if (!s) return;
      e.going.forEach((n) => { b[n] = (b[n] || 0) - s; });
      if (e.price > 0) b[data.payTo] = (b[data.payTo] || 0) + s * e.going.length; // fixed price: everyone pays the collector
      else e.expenses.forEach((x) => { b[x.paidBy] = (b[x.paidBy] || 0) + (+x.hkd || 0); });
    });
    return b;
  }
  // which of a person's events are covered by a payment (paying "everything" covers all of them at once)
  function evPay(n, id) {
    const ps = payments(n).filter((p) => (p.evs || []).includes(id));
    return ps.length ? (ps.some((p) => p.confirmed) ? "paid" : "wait") : null;
  }
  function status(n, bal) {
    const share = Math.max(0, -(bal[n] || 0));
    const ps = payments(n);
    const sent = ps.reduce((t, p) => t + p.hkd, 0), ok = ps.filter((p) => p.confirmed).reduce((t, p) => t + p.hkd, 0);
    const left = Math.max(0, Math.round(share - sent));
    const over = Math.max(0, Math.round(sent - share));
    return { share, sent, ok, left, over, pending: ps.some((p) => !p.confirmed), settled: share > 0.5 && left === 0 && !!ps.length && ps.every((p) => p.confirmed) };
  }

  /* ---------- render ---------- */
  function render() {
    if (!data) {
      root.innerHTML = `<div class="cc-lock">
        <h2>🔒 Class corner</h2>
        <p class="muted">Who's coming to what, your share of each bill, settling up and the study groups. Anyone in the class can tick names and add events. Enter the class passcode from the WhatsApp group.</p>
        <form id="cc-form" class="cc-form" autocomplete="off">
          <input id="cc-pass" type="password" autocapitalize="none" spellcheck="false" placeholder="Class passcode" aria-label="Class passcode" required>
          <button type="submit">Unlock</button>
        </form>
        <p id="cc-msg" class="cc-msg" role="status"></p>
      </div>`;
      fillPlan();
      return;
    }
    const evs = data.events, bal = balances(), ppl = roster();
    const mine = evs.filter((e) => e.going.includes(me));
    const st = me ? status(me, bal) : null;
    const isPayer = me && me === data.payTo;
    const canConfirm = data.organiser && isPayer; // only Rienno (with the organiser code) decides what's been received
    const opts = ppl.filter((p) => !p.away).map((p) => `<option${p.name === me ? " selected" : ""}>${esc(p.name)}</option>`).join("");
    const curOpts = CUR.map(([c]) => `<option${c === cur ? " selected" : ""}>${c}</option>`).join("");
    root.innerHTML = `<div class="cc-head">
        <h2>👥 Class corner</h2>
        <span class="cc-mode ${mode}">${live() ? "● Shared with the class" : "Read-only (offline)"}</span>
        <button class="cc-lockbtn" id="cc-relock" type="button">Lock 🔒</button>
      </div>
      <div class="cc-me">
        <label>I'm <select id="cc-me" aria-label="Your name"><option value="">choose your name</option>${opts}</select></label>
        <label>Prices in <select id="cc-cur" aria-label="Currency">${curOpts}</select></label>
      </div>
      ${me ? myPlace(mine, st, bal, isPayer) : `<p class="muted">Pick your name to see your own events and what you owe.</p>`}
      <h3 class="cc-h">🎉 Class events <small>tap one to tick who's going or enter the bill</small></h3>
      <div class="cc-events">${evs.map((e) => evCard(e, ppl)).join("")}</div>
      ${live() ? `<details class="cc-add"><summary>➕ Add an event for the class</summary>
        <form id="cc-newev" class="cc-grid-form">
          <input name="title" placeholder="What (e.g. Dragon's Back hike)" required maxlength="70">
          <select name="iso" aria-label="Day">${DAYS.map(([iso, l]) => `<option value="${iso}">${esc(l)}</option>`).join("")}</select>
          <input name="when" placeholder="Time (e.g. 19:00)" maxlength="40">
          <input name="venue" placeholder="Where (pick a place from the guide or type one)" maxlength="80" list="cc-places">
          <datalist id="cc-places">${PLACES.filter((p) => ["city", "saiwan", "sights", "hikes", "shop"].includes(p.tab)).map((p) => `<option value="${esc(p.name)}">`).join("")}</datalist>
          <button type="submit">Add event</button>
        </form></details>` : ""}
      ${billsSection()}
      ${settleUp(bal, canConfirm)}
      ${overview(evs)}
      <details class="cc-groups"><summary>📚 Becker study groups</summary>
        <div class="cc-grid">${(data.groups || []).map(([g, ns]) => `<div><h4>${esc(g)}</h4><ul>${ns.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>`).join("")}</div>
        <p class="muted small">${esc(data.groupsNote || "")}</p>
      </details>`;
    fillPlan();
    root.querySelectorAll(".name-find").forEach((inp) => { if (inp.value) inp.dispatchEvent(new Event("input", { bubbles: true })); }); // keep the name filter after a redraw
    window.HK_REPLAN?.();
    window.HK_CUSTOM_EVENTS?.(evs.filter((e) => e.id.startsWith("x-")));
    if (me) window.HK_AUTO_MINE?.(mine.map((e) => e.id));
  }

  // "My place": my events, my share of each, and paying it
  // Top of the class corner: what I owe, every way to pay, and "I've paid"
  function myPlace(mine, st, bal, isPayer) {
    if (!me) return `<div class="cc-owe"><h3 class="cc-h">💸 Pay ${esc(data.payTo)}</h3><p class="small">Pick your name above to see what you owe.</p>${payWays(0)}</div>`;
    const owedToMe = (bal[me] || 0) > 0.5;
    const rows = mine.map((e) => { const ps = evPay(me, e.id);
      const payOne = !ps && each(e) && live() ? `<button type="button" class="cc-mini go pay1" data-payev="${e.id}">✓ I've paid this</button>` : "";
      // tapped "I've paid" by mistake? undo it here until Rienno confirms
      const undo = ps === "wait" && live() ? `<button type="button" class="cc-mini pay1 undo" data-undoev="${e.id}">↩ Undo "I've paid"</button>` : "";
      return `<li><span>${esc(e.title)}${ps ? ` <em class="${ps === "paid" ? "ok" : "wait"}">${ps === "paid" ? "✓ Paid" : `Waiting for ${esc(data.payTo)}`}</em>` : ""}</span><b>${each(e) ? `${hk(each(e))} <small>≈ ${fx(each(e))}</small>` : (data.bills || []).some((b) => b.ev === e.id) ? `<small>split bill ↓</small>` : `<small>cost to come</small>`}</b>${payOne}${undo}</li>`; }).join("");
    const unpaid = mine.filter((e) => each(e) && !evPay(me, e.id));
    const mineP = payments(me).map((p, i) => `<li><span>Paid ${hk(p.hkd)}${p.method ? ` · ${esc(p.method)}` : ""}${evNames(p)}</span><b class="${p.confirmed ? "ok" : "wait"}">${p.confirmed ? `✓ ${esc(data.payTo)} confirmed` : `Waiting for ${esc(data.payTo)}`}</b>${!p.confirmed && live() ? `<button type="button" class="cc-mini undo" data-undopaid="${i}">↩ Undo</button>` : ""}</li>`).join("");
    const head = owedToMe ? ["You're owed", `${hk(bal[me])} <span>≈ ${fx(bal[me])}</span>`]
      : st.settled ? ["All settled", "✓ Paid, thank you!"]
      : st.left ? [`You owe ${esc(data.payTo)}`, `${hk(st.left)} <span>≈ ${fx(st.left)}</span>`]
      : st.pending ? ["Paid", `Waiting for ${esc(data.payTo)} to confirm`]
      : ["Your share so far", st.share ? hk(st.share) : "Nothing yet"];
    return `<div class="cc-owe">
      <div class="cc-owe-top"><div><small>${head[0]}</small><b>${head[1]}</b>
        ${st.over ? `<p class="small">You've paid ${hk(st.over)} more than your share. ${esc(data.payTo)} can refund it or count it towards the next event.</p>` : ""}</div></div>
      ${!owedToMe && st.left ? payWays(st.left) : ""}
      ${!owedToMe && st.left && live() && unpaid.length ? `<form class="cc-inline paid" id="cc-paid">
          <p class="small">Paid for everything (or a few)? Let ${esc(data.payTo)} know:</p>
          <select name="what" aria-label="What you're paying for">
            <option value="all">Everything · ${hk(Math.min(st.left, unpaid.reduce((t, e) => t + each(e), 0)))}</option>
            ${unpaid.length > 1 ? unpaid.map((e) => `<option value="${e.id}">${esc(e.title)} · ${hk(each(e))}</option>`).join("") : ""}
          </select>
          <select name="method" aria-label="How you paid">${PAY_METHODS.map((m) => `<option>${m}</option>`).join("")}</select>
          <button type="submit">✓ I've paid</button></form>` : ""}
      ${mineP ? `<ul class="cc-mine pays">${mineP}</ul>` : ""}
      ${rows ? `<details class="cc-break" open><summary>Your events · ${mine.length} · pay them all at once or one at a time</summary><ul class="cc-mine">${rows}</ul></details>`
        : `<p class="small">You're not on any lists yet. Open an event below and tap "I'm going".</p>`}
      ${isPayer ? `<p class="small">You're collecting: confirm payments in "Who's paid" below.</p>` : ""}
    </div>`;
  }


  // table bookings for an event: just the times and sizes (people turn up and get seated as tables free up)
  function tablesBlock(e) {
    const tables = e.tables || [];
    if (!tables.length && !live()) return "";
    return `<div class="cc-tables"><h4>🍽️ Table bookings</h4>
      ${tables.length ? `<ul class="tb-list">${tables.map((t) => `<li class="tb"><div class="tb-top"><b>${esc(t.time || "Time TBC")}</b> <span>${t.label ? `${esc(t.label)} · ` : ""}table for ${t.size || "?"}</span>
        ${live() ? `<button type="button" class="cc-mini" data-splittable="${e.id}|${t.id}">🧾 Split this table's bill</button><button type="button" class="cc-x" data-deltable="${e.id}|${t.id}" aria-label="Remove booking">✕</button>` : ""}</div></li>`).join("")}</ul>
        <p class="small">Arrive from ${esc(tables[0].time || "the first booking")} and you'll be seated as tables free up. After dinner, each table splits its own bill.</p>` : `<p class="muted small">No bookings yet.</p>`}
      ${live() ? `<form class="cc-inline" data-addtable="${e.id}"><input name="time" placeholder="Time, e.g. 20:45" maxlength="20" required aria-label="Booking time"><input name="size" type="number" inputmode="numeric" min="1" max="40" placeholder="Seats" aria-label="Number of seats" required><button type="submit">＋ Add a booking</button></form>` : ""}
    </div>`;
  }
  let seatEditing = null;

  function evCard(e, ppl) {
    const p = each(e), inIt = e.going.includes(me), ed = editing === e.id;
    const day = DAYS.find(([iso]) => iso === e.iso)?.[1];
    return `<details class="cc-ev${inIt ? " mine" : ""}" id="ev-${e.id}" data-ev="${e.id}"${openEv.has(e.id) || ed ? " open" : ""}>
      <summary><span class="t"><b>${esc(e.title)}</b><small>${esc([day, e.when].filter(Boolean).join(", "))}${e.venue ? ` · ${esc(e.venue)}` : ""}</small></span>
      <span class="n">${e.going.length} going${inIt ? " · ✓ you" : ""}<br><em>${p ? `${hk(p)} each ≈ ${fx(p)}` : "price to come"}</em></span></summary>
      ${placeFor(e.venue) ? `<button type="button" class="cc-venue" data-jump="${placeFor(e.venue).id}">📍 ${esc(placeFor(e.venue).name)} · map &amp; taxi card →</button>` : ""}
      ${me && live() ? `<button type="button" class="cc-imin${inIt ? " on" : ""}" data-tick="${e.id}" data-name="${esc(me)}" data-on="${inIt ? 0 : 1}">${inIt ? "✓ I'm going · tap to undo" : "+ I'm going"}</button>` : ""}
      ${ed
        ? `<p class="cc-hint">Tap names to tick or untick · ${e.going.length} going</p>
          <input class="name-find" data-find="ev" placeholder="Type a name to find them (Enter to tick)" autocomplete="off" aria-label="Find a name">
          <div class="cc-names edit">${ppl.map((x) => `<button type="button" data-nm="${esc(x.name.toLowerCase())}" class="${e.going.includes(x.name) ? "on" : ""}${x.away ? " away" : ""}" data-tick="${e.id}" data-name="${esc(x.name)}" data-on="${e.going.includes(x.name) ? 0 : 1}">${e.going.includes(x.name) ? "✓ " : ""}${esc(x.name)}${x.away ? " (not in HK)" : ""}</button>`).join("")}</div>
          <form class="cc-inline" data-addperson="${e.id}"><input name="name" placeholder="Not on the list? Add their name" maxlength="60" required><button type="submit">Add &amp; tick</button></form>
          <button type="button" class="cc-done" data-edit="">Done</button>`
        : `<div class="cc-names">${e.going.map((n) => `<span class="${n === me ? "me" : ""}">${esc(n)}</span>`).join("") || `<em class="muted">Nobody yet</em>`}</div>
          ${live() ? `<button type="button" class="cc-editbtn" data-edit="${e.id}">✏️ Tick who's going</button>` : ""}`}
      ${tablesBlock(e)}
      <div class="cc-bills">
        <h4>Cost</h4>
        ${p ? `<p class="cc-price"><b>${hk(p)}</b> each <span>≈ ${["USD", "GBP", "EUR", "JPY"].map((c) => fx(p, c)).join(" · ")}</span></p>
          <p class="muted small">${e.total ? `Total ${hk(e.total)} ÷ ${e.priceCount || Math.round(e.total / p)} people = ${hk(p)} each` : `${hk(p)} per person`}</p>
          ${e.total && e.priceCount && e.priceCount !== e.going.length && e.going.length && live()
            ? `<p class="cc-recalc">Now ${e.going.length} going. <button type="button" class="cc-mini go" data-recalc="${e.id}">Recalculate: ${hk(e.total / e.going.length)} each</button></p>` : ""}`
          : (() => { // no set price: split the bill(s) between whoever was there, whoever paid
              const evBills = (data.bills || []).filter((b) => b.ev === e.id);
              return `${evBills.length ? `<ul class="ev-bills">${evBills.map((b) => `<li><span>🧾 ${esc(b.what)} · paid by ${esc(b.paidBy)} · ${b.among.length} people</span><b>${hk(b.hkd)}</b></li>`).join("")}</ul>` : ""}
                ${live() ? `<p class="muted small">One bill per table if tables ate different things; each is split only between the people at that table.</p>
                <button type="button" class="cc-mini go" data-splitev="${e.id}">🧾 ${evBills.length ? "Add another table's bill" : "Add the bill (or the first table's)"}</button>
                <details class="cc-collect"><summary>Rienno collecting a set price instead?</summary>` : ""}`;
            })()}
        ${e.expenses.length ? `<ul>${e.expenses.map((x) => `<li><span>${esc(x.what)} · paid by ${esc(x.paidBy)}</span><b>${hk(+x.hkd)}</b>${live() ? `<button type="button" class="cc-x" data-delexp="${e.id}" data-xid="${x.id}" aria-label="Remove bill">✕</button>` : ""}</li>`).join("")}</ul>` : ""}
        ${live() ? `<form class="cc-inline bill" data-setprice="${e.id}">
          <input name="total" type="number" inputmode="numeric" min="0" step="1" placeholder="Total bill HK$" value="${e.total || ""}" aria-label="Total bill in HK$" required>
          <button type="submit">${e.total || e.price ? "Update total" : "Set total"}</button>
          <span class="muted small">Split between the ${e.going.length} ticked</span></form>${p ? "" : "</details>"}` : ""}
      </div>
      ${live() ? `<button type="button" class="cc-del" data-delev="${e.id}">🗑 Remove this event</button>` : ""}
    </details>`;
  }


  // bank details one line at a time, each with its own Copy (that's how bank apps ask for them)
  function bankLines(o) {
    const lines = [["Account name", o.accName], ["Bank", o.bankName], ["Account number", o.accNo], ["SWIFT / bank code", o.swift]].filter(([, v]) => v);
    if (!lines.length && o.bank) lines.push(["Bank details", o.bank]);
    return lines.length ? `<div class="bank-lines">${lines.map(([k, v]) => `<div class="bl"><span><small>${k}</small>${esc(v)}</span><button type="button" class="pw-copy" data-copy="${esc(v)}">Copy</button></div>`).join("")}</div>` : "";
  }

  // Every way to pay, with the actual details, so settling up is one look and one tap
  function payWays(amt) {
    const L = data.payLinks || {};
    const a = Math.round(amt);
    const soon = `<span class="pw-soon">coming soon</span>`;
    const copy = (v) => `<button type="button" class="pw-copy" data-copy="${esc(v)}">Copy</button>`;
    return `<div class="payways">
      ${L.paypal ? `<a class="paybtn big" href="${esc(L.paypal.replace(/\/$/, ""))}${a ? `/${a}HKD` : ""}" target="_blank" rel="noopener">💳 Pay ${a ? `${hk(a)} ` : ""}with PayPal or card</a>`
        : `<div class="pw"><span class="pw-i">💳</span><div><b>PayPal or card</b><small>Works from any country. A card fee of about 3–5% applies.</small></div>${soon}</div>`}
      <div class="pw"><span class="pw-i">⚡</span><div><b>FPS</b><small>Hong Kong bank accounts: instant and free${L.fps ? ` · <span class="pw-v">${esc(L.fps)}</span>` : ""}</small></div>${L.fps ? copy(L.fps) : soon}</div>
      <div class="pw pw-bank"><span class="pw-i">🌍</span><div><b>Bank transfer (Wise)</b><small>Cheapest from abroad</small>${bankLines(L)}</div>${L.bank || L.accNo ? "" : soon}</div>
      <div class="pw"><span class="pw-i">💬</span><div><b>WeChat Pay</b><small>Handy for classmates from China${L.wechat ? ` · <span class="pw-v">${esc(L.wechat)}</span>` : ""}</small></div>${L.wechat ? copy(L.wechat) : soon}</div>
      <div class="pw"><span class="pw-i">💵</span><div><b>Cash</b><small>HKD in person. ${esc(data.payTo)} is happy with cash.</small></div></div>
    </div>`;
  }

  // Who still owes what, who says they've paid, and what Rienno has confirmed
  const evNames = (p) => { const n = (p.evs || []).map((id) => data.events.find((e) => e.id === id)?.title).filter(Boolean); return n.length === 1 ? ` for ${esc(n[0])}` : ""; };
  function settleUp(bal, canConfirm) {
    const L = data.payLinks || {};
    // people waiting for Rienno to confirm come first, then who still owes, then who's done
    const rank = (r) => (r.pending ? 0 : r.left ? 1 : 2);
    const rows = people().filter((n) => n !== data.payTo).map((n) => ({ n, ...status(n, bal) })).filter((r) => r.share > 0.5 || r.sent)
      .sort((a, b) => rank(a) - rank(b) || a.n.localeCompare(b.n));
    const collector = Object.entries(bal).filter(([, v]) => v > 0.5);
    const done = rows.filter((r) => r.settled).length;
    const list = rows.length ? `<ul class="cc-settle">${rows.map((r) => {
      const ps = payments(r.n);
      const chip = (r.left ? `<em class="owe">Owes ${hk(r.left)}</em>` : r.settled ? `<em class="ok">✓ Paid</em>` : r.pending ? `<em class="wait">Says paid · ${esc(data.payTo)} to confirm</em>` : "")
        + (r.over ? ` <em class="wait">Overpaid ${hk(r.over)}</em>` : "");
      const confirm = canConfirm && live() ? ps.map((p, i) => p.confirmed
        ? `<button type="button" class="cc-mini" data-unconfirm="${esc(r.n)}" data-i="${i}">✓ ${hk(p.hkd)} received · undo</button>`
        : `<button type="button" class="cc-mini go" data-confirm="${esc(r.n)}" data-i="${i}">Confirm ${hk(p.hkd)} received${evNames(p)} (${esc(p.method || "")})</button>`).join("")
        + (r.left ? `<button type="button" class="cc-mini" data-record="${esc(r.n)}" data-amt="${r.left}">Got ${hk(r.left)} in cash / other</button>` : "") : "";
      return `<li class="${r.n === me ? "me" : ""}${r.settled ? " done" : ""}"><span class="nm">${esc(r.n)}</span><span class="amt">${hk(r.share)}</span>${chip}${confirm ? `<div class="cc-confirm">${confirm}</div>` : ""}</li>`;
    }).join("")}</ul>` : `<p class="muted">Nothing to settle yet. Once an event has a price, everyone's share shows here.</p>`;
    return `<div class="cc-pay">
      <h3 class="cc-h">📒 Who's paid ${rows.length ? `<small>${done} of ${rows.length} paid</small>` : ""}</h3>
      ${rows.length ? `<p class="small"><b>${esc(data.payTo)}</b> is collecting ${hk(rows.reduce((t, r) => t + r.share, 0))} in total · ${hk(rows.reduce((t, r) => t + r.ok, 0))} received so far</p>` : ""}
      <p class="muted small">It counts as paid once ${esc(data.payTo)} confirms the money arrived.</p>
      ${canConfirm ? `<p class="cc-orgnote">🔑 You're signed in as organiser: confirm payments below, or tap "Got HK$…" for cash.</p>` : ""}
      ${list}
      ${live() ? `<details class="cc-paysetup"><summary>🔑 Organisers (Rienno, Lisa, Florence &amp; Kejia)</summary>
        ${data.organiser ? `<p class="muted small" style="padding:0 14px">Only organisers can change payment details. Only Rienno confirms payments (pick Rienno as your name).</p>
        <form id="cc-pay" class="cc-grid-form">
          <input name="paypal" placeholder="PayPal.me link, e.g. https://paypal.me/name" value="${esc(L.paypal || "")}">
          <input name="fps" placeholder="FPS ID or phone number" value="${esc(L.fps || "")}">
          <input name="accName" placeholder="Account name" value="${esc(L.accName || "")}">
          <input name="bankName" placeholder="Bank (e.g. HSBC Hong Kong)" value="${esc(L.bankName || "")}">
          <input name="accNo" placeholder="Account number" value="${esc(L.accNo || "")}">
          <input name="swift" placeholder="SWIFT / bank code (for transfers from abroad)" value="${esc(L.swift || "")}">
          <input name="wechat" placeholder="WeChat ID (for WeChat Pay)" value="${esc(L.wechat || "")}">
          <button type="submit">Save payment details</button>
        </form>
        <button type="button" class="cc-done" data-orgout="1" style="margin:0 14px 14px">Sign out as organiser</button>`
        : `<form id="cc-org" class="cc-grid-form" autocomplete="off"><input name="code" type="password" autocapitalize="none" placeholder="Organiser code" required aria-label="Organiser code"><button type="submit">Sign in</button></form>`}
      </details>` : ""}
    </div>`;
  }

  const SHORT = { "sun-dimsum": "Sun Dim Sum", "mon-hotpot": "Mon Hotpot", "wed-tram": "Wed Tram", "thu-dpd": "Thu Dai Pai Dong", };
  function overview(evs) {
    const ppl = people(), bal = balances();
    const grand = evs.reduce((t, e) => t + (each(e) || 0) * e.going.length, 0);
    return `<details class="cc-all"><summary>📋 Full list: everyone × every event</summary>
      <div class="cc-scroll"><table>
        <thead><tr><th>Name</th>${evs.map((e) => `<th>${esc(SHORT[e.id] || e.title)}</th>`).join("")}<th>Share</th><th>Paid</th></tr></thead>
        <tbody>${ppl.map((n) => { const s = status(n, bal); return `<tr class="${n === me ? "me" : ""}"><td>${esc(n)}</td>${evs.map((e) => `<td>${live() ? `<button type="button" class="cc-cell${e.going.includes(n) ? " on" : ""}" data-tick="${e.id}" data-name="${esc(n)}" data-on="${e.going.includes(n) ? 0 : 1}" aria-label="${esc(n)}: ${esc(e.title)}">${e.going.includes(n) ? "✓" : ""}</button>` : e.going.includes(n) ? "✓" : ""}</td>`).join("")}<td>${s.share ? hk(s.share) : "–"}</td><td>${s.settled ? "✓✓" : s.sent ? "✓" : ""}</td></tr>`; }).join("")}</tbody>
        <tfoot><tr><td>Going</td>${evs.map((e) => `<td>${e.going.length}<br><small>${each(e) ? `${hk(each(e))} each` : "price TBC"}</small></td>`).join("")}<td>${grand ? hk(grand) : "–"}</td><td></td></tr></tfoot>
      </table></div>
      <p class="muted small">${live() ? "Tap a box to tick or untick. " : ""}Paid: ✓ = says they've paid, ✓✓ = ${esc(data.payTo)} confirmed.</p>
      <button type="button" class="cc-csv" id="cc-csv">Copy as spreadsheet (CSV)</button>
    </details>`;
  }


  /* ---------- split a bill: dinners by table, people's own events, any payer ---------- */
  // a draft kept outside the DOM, so the form survives the list refreshing every 30 seconds
  let billDraft = null;
  // who paid: for class events Rienno pays everything up front (even if he isn't there), so he's the default;
  // anyone else who covers a table just switches "Paid by". Bills not tied to an event default to you.
  const defaultPayer = (evId) => (evId && data.payTo ? data.payTo : me || data.payTo);
  const newDraft = () => ({ what: "", ev: "", hkd: "", paidBy: me || data.payTo, among: new Set(me ? [me] : []), mode: "equal", shares: {}, q: "" });
  const billShares = (b) => b.shares || Object.fromEntries(b.among.map((n) => [n, b.hkd / b.among.length]));
  function billBalances() { // + means you're owed, - means you owe
    const bal = {};
    (data.bills || []).forEach((b) => {
      bal[b.paidBy] = (bal[b.paidBy] || 0) + b.hkd;
      Object.entries(billShares(b)).forEach(([n, v]) => { bal[n] = (bal[n] || 0) - v; });
    });
    (data.xfers || []).forEach((x) => { bal[x.from] = (bal[x.from] || 0) + x.hkd; bal[x.to] = (bal[x.to] || 0) - x.hkd; });
    return bal;
  }
  // fewest payments that settle everyone up (largest debts paid to largest credits first)
  function simplify(bal) {
    const debt = Object.entries(bal).filter(([, v]) => v < -0.5).map(([n, v]) => [n, -v]).sort((a, b) => b[1] - a[1]);
    const cred = Object.entries(bal).filter(([, v]) => v > 0.5).map(([n, v]) => [n, v]).sort((a, b) => b[1] - a[1]);
    const out = [];
    let i = 0, j = 0;
    while (i < debt.length && j < cred.length) {
      const amt = Math.min(debt[i][1], cred[j][1]);
      if (amt > 0.5) out.push({ from: debt[i][0], to: cred[j][0], hkd: Math.round(amt) });
      debt[i][1] -= amt; cred[j][1] -= amt;
      if (debt[i][1] < 0.5) i++;
      if (cred[j][1] < 0.5) j++;
    }
    return out;
  }
  function waysToPay(to, amt) {
    const pr = (data.profiles || {})[to] || {};
    const rows = [
      pr.paypal && `<a class="paybtn" href="${esc(pr.paypal.replace(/\/$/, ""))}${/paypal\.me/i.test(pr.paypal) ? `/${Math.round(amt)}HKD` : ""}" target="_blank" rel="noopener">💳 PayPal / card</a>`,
      pr.fps && `<button class="paybtn" type="button" data-copy="${esc(pr.fps)}">⚡ FPS ${esc(pr.fps)} · copy</button>`,

      pr.wiseLink && `<a class="paybtn" href="${esc(pr.wiseLink)}" target="_blank" rel="noopener">🌍 Wise</a>`,
      pr.wechat && `<button class="paybtn" type="button" data-copy="${esc(pr.wechat)}">💬 WeChat Pay ${esc(pr.wechat)} · copy</button>`,
      pr.cash && `<span class="pw-soon">💵 Cash is fine</span>`,
    ].filter(Boolean);
    const bl = bankLines(pr);
    return rows.length || bl ? `${rows.length ? `<div class="paybtns">${rows.join("")}</div>` : ""}${bl ? `<p class="small" style="margin:8px 0 4px"><b>🌍 Bank transfer</b></p>${bl}` : ""}${pr.note ? `<p class="muted small">${esc(pr.note)}</p>` : ""}`
      : `<p class="muted small">${esc(to)} hasn't added payment details yet. Ask in the group chat, or they can add them under "My payment details".</p>`;
  }
  function billsSection() {
    if (!live()) return "";
    const bal = billBalances(), sugg = simplify(bal);
    const pend = (data.xfers || []).filter((x) => !x.confirmed);
    const ppl = people();
    const evName = (id) => data.events.find((e) => e.id === id)?.title;
    const mineSugg = me ? sugg.filter((t) => t.from === me || t.to === me) : [];
    const others = sugg.filter((t) => !mineSugg.includes(t));
    const sRow = (t) => `<li class="sp${t.from === me || t.to === me ? " me" : ""}"><div class="sp-top"><b>${esc(t.from)}</b> → <b>${esc(t.to)}</b><span class="amt">${hk(t.hkd)} <small>≈ ${fx(t.hkd)}</small></span></div>
      ${t.from === me ? `${waysToPay(t.to, t.hkd)}<form class="cc-inline paid" data-xfer="${esc(JSON.stringify(t))}"><select name="method" aria-label="How you paid">${PAY_METHODS.map((m) => `<option>${m}</option>`).join("")}</select><button type="submit">✓ I've paid ${esc(t.to)}</button></form>` : ""}</li>`;
    const pRow = (x) => `<li class="sp pending"><div class="sp-top"><span>${esc(x.from)} paid ${esc(x.to)} ${hk(x.hkd)}${x.method ? ` · ${esc(x.method)}` : ""}</span>
      ${x.to === me ? `<button type="button" class="cc-mini go" data-xconfirm="${x.id}">✓ Received</button>` : `<em class="wait">Waiting for ${esc(x.to)}</em>`}
      ${x.from === me ? `<button type="button" class="cc-mini undo" data-xundo="${x.id}">↩ Undo</button>` : ""}</div></li>`;
    const d = billDraft;
    const form = d ? (() => {
      const total = +d.hkd || 0, among = [...d.among];
      const each = among.length ? total / among.length : 0;
      const sum = among.reduce((t, n) => t + (+d.shares[n] || 0), 0);
      return `<form class="bill-form" id="bill-form" autocomplete="off">
        <div class="bf-row"><input name="what" placeholder="What (e.g. Thu dinner, table 2)" maxlength="60" value="${esc(d.what)}" data-bf="what">
          <select name="ev" data-bf="ev" aria-label="Which event"><option value="">Not linked to an event</option>${data.events.map((e) => `<option value="${e.id}"${d.ev === e.id ? " selected" : ""}>${esc(e.title)}</option>`).join("")}</select></div>
        <div class="bf-row"><label class="bf-l">Total HK$<input name="hkd" type="number" inputmode="decimal" min="1" step="0.01" value="${esc(d.hkd)}" data-bf="hkd" required></label>
          <label class="bf-l">Paid by<select name="paidBy" data-bf="paidBy">${ppl.map((n) => `<option${n === d.paidBy ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label></div>
        <p class="bf-h">Who's at this table? <small>${among.length} picked</small>
          ${d.ev ? `<button type="button" class="cc-mini" data-bf-all="1">Everyone at ${esc(evName(d.ev) || "the event")}</button>` : ""}
          <button type="button" class="cc-mini" data-bf-none="1">Clear</button></p>
        <input class="name-find" data-find="bf" placeholder="Type a name to find them (Enter to tick)" value="${esc(d.q || "")}" autocomplete="off" aria-label="Find a name">
        <div class="cc-names edit">${ppl.map((n) => `<button type="button" class="${d.among.has(n) ? "on" : ""}" data-bf-toggle="${esc(n)}" data-nm="${esc(n.toLowerCase())}">${d.among.has(n) ? "✓ " : ""}${esc(n)}</button>`).join("")}</div>
        <p class="bf-h">Split
          <button type="button" class="cc-mini${d.mode === "equal" ? " go" : ""}" data-bf-mode="equal">Equally</button>
          <button type="button" class="cc-mini${d.mode === "custom" ? " go" : ""}" data-bf-mode="custom">Custom amounts</button></p>
        ${d.mode === "equal" ? `<p class="small">${among.length && total ? `${hk(total)} ÷ ${among.length} = <b>${hk(each)}</b> each` : "Pick who's in it and enter the total."}</p>`
          : `<div class="bf-custom">${among.map((n) => `<label>${esc(n)}<input type="number" inputmode="decimal" min="0" step="0.01" value="${esc(d.shares[n] ?? "")}" data-bf-share="${esc(n)}" placeholder="HK$"></label>`).join("")}</div>
             <p class="small ${Math.abs(sum - total) > 1 ? "warn-t" : "ok-t"}">Adds up to ${hk(sum)} of ${hk(total)}${Math.abs(sum - total) > 1 ? ` · ${hk(total - sum)} left to assign` : " ✓"}</p>`}
        <div class="bf-row"><button type="submit" class="paybtn">Add bill</button><button type="button" class="cc-mini" data-bf-cancel="1">Cancel</button></div>
      </form>`;
    })() : `<button type="button" class="cc-add-bill" data-bf-new="1">➕ Add a bill</button>`;
    const bills = (data.bills || []).slice().reverse();
    const pr = me ? (data.profiles || {})[me] || {} : null;
    return `<div class="cc-bills2">
      <h3 class="cc-h">🧾 Split a bill <small>dinners by table, your own events, whoever paid</small></h3>
      ${me ? `<p class="small">${(bal[me] || 0) < -0.5 ? `You owe <b>${hk(-bal[me])}</b> in bills.` : (bal[me] || 0) > 0.5 ? `You're owed <b>${hk(bal[me])}</b> in bills.` : "You're all square on bills."}</p>` : ""}
      ${mineSugg.length ? `<ul class="sp-list">${mineSugg.map(sRow).join("")}</ul>` : ""}
      ${pend.length ? `<ul class="sp-list">${pend.map(pRow).join("")}</ul>` : ""}
      ${form}
      ${others.length ? `<details class="cc-sub"><summary>Everyone else's payments · ${others.length}</summary><ul class="sp-list">${others.map(sRow).join("")}</ul></details>` : ""}
      ${bills.length ? `<details class="cc-sub"><summary>All bills · ${bills.length}</summary><ul class="bill-list">${bills.map((b) => {
        const sh = billShares(b);
        return `<li><div class="sp-top"><b>${esc(b.what)}</b>${b.ev && evName(b.ev) ? ` <small>· ${esc(evName(b.ev))}</small>` : ""}<span class="amt">${hk(b.hkd)}</span>
          <button type="button" class="cc-x" data-bdel="${b.id}" aria-label="Delete bill">✕</button></div>
          <p class="small">Paid by ${esc(b.paidBy)} · ${b.shares ? "custom split" : `${hk(b.hkd / b.among.length)} each`}: ${b.among.map((n) => `${esc(n)}${b.shares ? ` ${hk(sh[n])}` : ""}`).join(", ")}</p></li>`;
      }).join("")}</ul></details>` : ""}
      ${me ? `<details class="cc-sub"><summary>💳 My payment details${pr.paypal || pr.fps || pr.bank || pr.accNo || pr.cash ? " ✓" : ""}</summary>
        <form class="cc-grid-form" id="my-pay" autocomplete="off">
          <p class="small" style="flex-basis:100%">So people can pay you back for bills you cover. Only classmates with the passcode can see these.</p>
          <input name="paypal" placeholder="PayPal.me link, e.g. https://paypal.me/yourname" value="${esc(pr.paypal || "")}">
          <input name="fps" placeholder="FPS ID or phone (Hong Kong accounts)" value="${esc(pr.fps || "")}">
          <input name="accName" placeholder="Bank: account name" value="${esc(pr.accName || "")}">
          <input name="bankName" placeholder="Bank (e.g. Chase, HSBC Hong Kong)" value="${esc(pr.bankName || "")}">
          <input name="accNo" placeholder="Account number / IBAN" value="${esc(pr.accNo || "")}">
          <input name="swift" placeholder="SWIFT / routing / sort code" value="${esc(pr.swift || "")}">
          <input name="wiseLink" placeholder="Wise payment link (optional)" value="${esc(pr.wiseLink || "")}">
          <input name="wechat" placeholder="WeChat ID (for WeChat Pay)" value="${esc(pr.wechat || "")}">
          <input name="note" placeholder="Note (e.g. Venmo @name, Revolut, PayNow)" value="${esc(pr.note || "")}">
          <label class="bf-check"><input type="checkbox" name="cash"${pr.cash ? " checked" : ""}> Cash is fine</label>
          ${pr.locked ? `<input name="pin" type="password" inputmode="numeric" placeholder="Your PIN (needed to change these)">` : `<input name="newPin" type="password" inputmode="numeric" maxlength="12" placeholder="Optional PIN, so only you can change these">`}
          <button type="submit">Save my details</button>
        </form></details>` : `<p class="muted small">Pick your name above to add bills and your payment details.</p>`}
    </div>`;
  }
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (!billDraft || !root.contains(t)) return;
    if (t.dataset.bf) billDraft[t.dataset.bf] = t.value;
    if (t.dataset.bfShare) { billDraft.shares[t.dataset.bfShare] = t.value; const p = t.closest(".bill-form"); if (p) refreshSum(p); }
    if (t.dataset.bf === "hkd") { const p = t.closest(".bill-form"); if (p) refreshSum(p); }
  });
  function refreshSum(formEl) { // update the "adds up to" line without redrawing (keeps the keyboard open)
    const d = billDraft, total = +d.hkd || 0, among = [...d.among];
    const line = formEl.querySelector(".bf-custom + p.small") || formEl.querySelector('[data-bf-mode="equal"].go') && formEl.querySelector(".bf-row ~ p.small");
    if (d.mode === "custom") {
      const sum = among.reduce((t, n) => t + (+d.shares[n] || 0), 0);
      const p = formEl.querySelector(".bf-custom + p.small");
      if (p) { p.className = `small ${Math.abs(sum - total) > 1 ? "warn-t" : "ok-t"}`; p.innerHTML = `Adds up to ${hk(sum)} of ${hk(total)}${Math.abs(sum - total) > 1 ? ` · ${hk(total - sum)} left to assign` : " ✓"}`; }
    } else {
      const p = [...formEl.querySelectorAll("p.small")].find((x) => /each|Pick who/.test(x.textContent));
      if (p) p.innerHTML = among.length && total ? `${hk(total)} ÷ ${among.length} = <b>${hk(total / among.length)}</b> each` : "Pick who's in it and enter the total.";
    }
    return line;
  }
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (!billDraft || !root.contains(t) || !t.dataset.bf) return;
    billDraft[t.dataset.bf] = t.value;
    if (t.dataset.bf === "ev" && t.value) { const E = data.events.find((x) => x.id === t.value); if (E) { billDraft.among = new Set(E.going); billDraft.paidBy = defaultPayer(E.id); if (!billDraft.what) billDraft.what = E.title; } render(); }
  });


  // name finder: filters the chips as you type; Enter ticks the first visible match
  document.addEventListener("input", (e) => {
    const inp = e.target.closest?.(".name-find");
    if (!inp) return;
    const q = inp.value.trim().toLowerCase(), box = inp.nextElementSibling;
    if (inp.dataset.find === "bf" && billDraft) billDraft.q = inp.value;
    box?.querySelectorAll("[data-nm]").forEach((b) => { b.hidden = !!q && !b.dataset.nm.split(/\s+/).some((w) => w.startsWith(q)) && !b.dataset.nm.includes(q); });
  });
  document.addEventListener("keydown", (e) => {
    const inp = e.target.closest?.(".name-find");
    if (!inp || e.key !== "Enter") return;
    e.preventDefault();
    const first = [...(inp.nextElementSibling?.querySelectorAll("[data-nm]") || [])].find((b) => !b.hidden);
    if (first) { inp.value = ""; if (billDraft && inp.dataset.find === "bf") billDraft.q = ""; first.click(); setTimeout(() => root.querySelector(`.name-find[data-find="${inp.dataset.find}"]`)?.focus(), 80); }
  });

  // the week plan shows a one-line summary under each class event
  function fillPlan() {
    document.querySelectorAll("[data-evinfo]").forEach((el) => {
      const e = data && data.events.find((x) => x.id === el.dataset.evinfo);
      if (!e) { el.innerHTML = data ? "" : `<button class="evlock" data-cclink="1">🔒 Who's going</button>`; return; }
      const p = each(e);
      const myT = (e.tables || []).find((t) => (t.names || []).includes(me));
      el.innerHTML = `<button class="evlock open" data-cclink="${e.id}">👥 ${e.going.length} going${(e.tables || []).length ? ` · 🍽️ tables from ${esc(e.tables[0].time || "")}` : ""}${p ? ` · ${hk(p)} each` : ""}</button>`;
    });
  }
  window.HK_PRIVATE_RENDER = fillPlan;
  // the week plan's "+ Me" on a class event ticks you on the shared list too
  window.HK_CLASS = {
    going: (ev) => { if (!data || !me || !live()) return null; const e = data.events.find((x) => x.id === ev); return e ? e.going.includes(me) : null; },
    tick: (ev, on) => { const E = data.events.find((x) => x.id === ev); op({ op: "toggle", ev, name: me, on }, () => { E.going = on ? [...new Set([...E.going, me])].sort((a, b) => a.localeCompare(b)) : E.going.filter((n) => n !== me); }).then(() => window.HK_REPLAN?.()); },
    hint: () => toast(data ? "Pick your name in the class corner so the organisers see you're going" : "Unlock the class corner below so the organisers see you're going"),
  };

  /* ---------- events ---------- */
  root.addEventListener("toggle", (e) => {
    const d = e.target; if (!d.matches?.("details[data-ev]")) return;
    if (d.open) openEv.add(d.dataset.ev); else openEv.delete(d.dataset.ev);
  }, true);
  document.addEventListener("click", (e) => {
    const t = e.target;
    const cl = t.closest("[data-cclink]");
    if (cl) {
      if (cl.dataset.cclink !== "1") openEv.add(cl.dataset.cclink);
      if (data) render();
      const d = document.getElementById(`ev-${cl.dataset.cclink}`);
      (d || root).scrollIntoView({ behavior: "smooth", block: "center" });
      if (!d) setTimeout(() => $("#cc-pass")?.focus(), 400);
      return;
    }
    if (!root.contains(t)) return;
    const tick = t.closest("[data-tick]");
    if (tick) {
      const ev = tick.dataset.tick, name = tick.dataset.name, on = tick.dataset.on === "1";
      const E = data.events.find((x) => x.id === ev);
      op({ op: "toggle", ev, name, on }, () => { E.going = on ? [...new Set([...E.going, name])].sort((a, b) => a.localeCompare(b)) : E.going.filter((n) => n !== name); });
      return;
    }
    const ed = t.closest("[data-edit]");
    if (ed) { editing = ed.dataset.edit || null; if (editing) openEv.add(editing); render(); return; }
    const dx = t.closest("[data-delexp]");
    if (dx) { if (confirm("Remove this bill?")) op({ op: "delExpense", ev: dx.dataset.delexp, xid: dx.dataset.xid }); return; }
    const de = t.closest("[data-delev]");
    if (de) { const E = data.events.find((x) => x.id === de.dataset.delev); if (confirm(`Remove "${E.title}" for everyone?`)) op({ op: "delEvent", ev: E.id }); return; }
    const cf = t.closest("[data-confirm],[data-unconfirm]");
    if (cf) { const n = cf.dataset.confirm || cf.dataset.unconfirm; op({ op: cf.dataset.confirm ? "confirmPaid" : "unconfirmPaid", name: n, i: +cf.dataset.i }); return; }
    const rec = t.closest("[data-record]");
    if (rec) {
      const n = rec.dataset.record, evs = data.events.filter((e) => e.going.includes(n) && each(e) && !evPay(n, e.id)).map((e) => e.id);
      if (confirm(`Record ${hk(+rec.dataset.amt)} received from ${n}?`)) op({ op: "markPaid", name: n, hkd: +rec.dataset.amt, evs, method: "Cash / other", confirmed: true });
      return;
    }
    if (t.closest("[data-orgout]")) { orgPass = ""; forget("hk-org-v1"); api("GET").then((s) => { data = s; render(); }); return; }
    if (t.closest("[data-bf-new]")) { billDraft = newDraft(); render(); return; }
    const st = t.closest("[data-seat]");
    if (st) {
      const E = data.events.find((x) => x.id === st.dataset.seat), on = st.dataset.on === "1", name = st.dataset.name;
      op({ op: "seat", ev: E.id, table: st.dataset.table, name, on }, () => { (E.tables || []).forEach((x) => { x.names = (x.names || []).filter((n) => n !== name); }); if (on) E.tables.find((x) => x.id === st.dataset.table).names.push(name); });
      return;
    }
    const sedit = t.closest("[data-seatedit]");
    if (sedit) { seatEditing = sedit.dataset.seatedit || null; if (seatEditing) openEv.add(seatEditing.split("|")[0]); render(); return; }
    const dt = t.closest("[data-deltable]");
    if (dt) { const [ev, table] = dt.dataset.deltable.split("|"); if (confirm("Remove this booking? People at it go back to 'not seated'.")) op({ op: "delTable", ev, table }); return; }
    const sp = t.closest("[data-splittable]");
    if (sp) {
      const [ev, table] = sp.dataset.splittable.split("|"); const E = data.events.find((x) => x.id === ev), T = E.tables.find((x) => x.id === table);
      billDraft = { ...newDraft(), ev, what: `${E.title}, ${T.time} table`, among: new Set(me ? [me] : []), paidBy: defaultPayer(ev) };
      render(); setTimeout(() => document.getElementById("bill-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return;
    }
    const se = t.closest("[data-splitev]");
    if (se) {
      const E = data.events.find((x) => x.id === se.dataset.splitev);
      billDraft = { ...newDraft(), ev: E.id, what: E.title, among: new Set(E.going), paidBy: defaultPayer(E.id) };
      render();
      setTimeout(() => document.getElementById("bill-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return;
    }
    if (t.closest("[data-bf-cancel]")) { billDraft = null; render(); return; }
    const bt = t.closest("[data-bf-toggle]");
    if (bt && billDraft) { const n = bt.dataset.bfToggle; if (billDraft.among.has(n)) billDraft.among.delete(n); else billDraft.among.add(n); render(); return; }
    if (t.closest("[data-bf-all]") && billDraft) { const E = data.events.find((x) => x.id === billDraft.ev); if (E) billDraft.among = new Set(E.going); render(); return; }
    if (t.closest("[data-bf-none]") && billDraft) { billDraft.among = new Set(); render(); return; }
    const bm = t.closest("[data-bf-mode]");
    if (bm && billDraft) {
      billDraft.mode = bm.dataset.bfMode;
      if (billDraft.mode === "custom") { const n = billDraft.among.size, tot = +billDraft.hkd || 0; [...billDraft.among].forEach((x) => { if (billDraft.shares[x] == null && n && tot) billDraft.shares[x] = (Math.round((tot / n) * 100) / 100).toString(); }); }
      render(); return;
    }
    const xc = t.closest("[data-xconfirm]");
    if (xc) { op({ op: "confirmXfer", id: xc.dataset.xconfirm }).then((ok) => ok && toast("Marked as received")); return; }
    const xu = t.closest("[data-xundo]");
    if (xu) { op({ op: "undoXfer", id: xu.dataset.xundo }).then((ok) => ok && toast("Undone")); return; }
    const bd = t.closest("[data-bdel]");
    if (bd) { if (confirm("Delete this bill for everyone?")) op({ op: "delBill", id: bd.dataset.bdel }); return; }
    const p1 = t.closest("[data-payev]");
    if (p1) {
      const E = data.events.find((x) => x.id === p1.dataset.payev);
      const method = $("#cc-paid select[name=method]")?.value || "";
      op({ op: "markPaid", name: me, hkd: Math.round(each(E)), evs: [E.id], method }).then((ok) => ok && toast(`Thanks! ${data.payTo} will confirm ${E.title}`));
      return;
    }
    const rc = t.closest("[data-recalc]");
    if (rc) { const E = data.events.find((x) => x.id === rc.dataset.recalc); op({ op: "setPrice", ev: E.id, total: E.total, count: E.going.length }).then((ok) => ok && toast(`Recalculated: ${hk(E.total / E.going.length)} each`)); return; }
    const ue = t.closest("[data-undoev]");
    if (ue) { const E = data.events.find((x) => x.id === ue.dataset.undoev); op({ op: "undoPaidEv", name: me, ev: E.id, hkd: Math.round(each(E) || 0) }).then((ok) => ok && toast(`Undone: ${E.title} is back to not paid`)); return; }
    const up = t.closest("[data-undopaid]");
    if (up) { op({ op: "undoPaid", name: me, i: +up.dataset.undopaid }).then((ok) => ok && toast("Undone: marked as not paid")); return; }
    if (t.id === "cc-relock") { data = null; mode = "locked"; forget("hk-pass-v1"); render(); return; }
    const cp = t.closest("[data-copy]");
    if (cp) { (navigator.clipboard?.writeText(cp.dataset.copy) || Promise.reject()).then(() => { cp.textContent = "Copied ✓"; }, () => prompt("Copy this:", cp.dataset.copy)); return; }
    if (t.id === "cc-csv" && data) {
      const evs = data.events, bal = balances();
      const rows = [["Name", ...evs.map((ev) => SHORT[ev.id] || ev.title), "Share (HKD)", "Paid (HKD)", "Confirmed"]];
      people().forEach((n) => { const s = status(n, bal); rows.push([n, ...evs.map((ev) => (ev.going.includes(n) ? "1" : "")), Math.round(s.share) || "", s.sent || "", s.settled ? "yes" : ""]); });
      rows.push(["Bill HKD", ...evs.map((ev) => total(ev) || ""), "", "", ""]);
      const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
      (navigator.clipboard?.writeText(csv) || Promise.reject()).then(() => { t.textContent = "Copied ✓ Paste into Sheets or Excel"; }, () => prompt("Copy this:", csv));
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "cc-me") { me = e.target.value; set("hk-me-v1", me); render(); }
    if (e.target.id === "cc-cur") { cur = e.target.value; set("hk-cur-v1", cur); render(); }
  });
  document.addEventListener("submit", (e) => {
    const f = e.target;
    if (!root.contains(f)) return;
    e.preventDefault();
    const fd = (k) => f.elements[k]?.value?.trim() || "";
    if (f.id === "cc-form") { msg("Checking…"); unlock(fd("cc-pass") || $("#cc-pass").value); }
    else if (f.id === "cc-newev") { op({ op: "addEvent", title: fd("title"), iso: fd("iso"), when: fd("when"), venue: fd("venue") }).then((ok) => ok && toast("Event added for everyone")); }
    else if (f.id === "bill-form" && billDraft) {
      const d = billDraft, among = [...d.among];
      const body = { op: "addBill", what: d.what, ev: d.ev, hkd: +d.hkd, paidBy: d.paidBy, among };
      if (d.mode === "custom") body.shares = Object.fromEntries(among.map((n) => [n, +d.shares[n] || 0]));
      op(body).then((ok) => { if (ok) { billDraft = null; render(); toast("Bill added: everyone's share is worked out"); } });
    }
    else if (f.dataset.xfer) {
      const x = JSON.parse(f.dataset.xfer);
      op({ op: "markXfer", from: x.from, to: x.to, hkd: x.hkd, method: fd("method") }).then((ok) => ok && toast(`Thanks! ${x.to} will confirm when it arrives`));
    }
    else if (f.id === "my-pay") {
      op({ op: "setProfile", name: me, paypal: fd("paypal"), fps: fd("fps"), accName: fd("accName"), bankName: fd("bankName"), accNo: fd("accNo"), swift: fd("swift"), wechat: fd("wechat"), wiseLink: fd("wiseLink"), note: fd("note"), cash: f.elements.cash.checked, pin: fd("pin"), newPin: fd("newPin") })
        .then((ok) => ok && toast("Your payment details are saved"));
    }
    else if (f.id === "cc-org") {
      orgPass = fd("code").toLowerCase();
      api("GET").then((s) => { if (s.organiser) { set("hk-org-v1", orgPass); data = s; render(); toast("Signed in as organiser"); } else { orgPass = ""; toast("That organiser code isn't right"); } }, () => { orgPass = ""; toast("Couldn't check the code"); });
    }
    else if (f.id === "cc-pay") { op({ op: "setPay", paypal: fd("paypal"), fps: fd("fps"), accName: fd("accName"), bankName: fd("bankName"), accNo: fd("accNo"), swift: fd("swift"), wechat: fd("wechat") }).then((ok) => ok && toast("Saved")); }
    else if (f.id === "cc-paid") {
      const unpaid = data.events.filter((e) => e.going.includes(me) && each(e) && !evPay(me, e.id));
      const pick = fd("what") === "all" ? unpaid : unpaid.filter((e) => e.id === fd("what"));
      const st = status(me, balances()), sum = Math.round(pick.reduce((t, e) => t + each(e), 0));
      op({ op: "markPaid", name: me, hkd: fd("what") === "all" ? Math.min(sum, st.left) : sum, evs: pick.map((e) => e.id), method: fd("method") }).then((ok) => ok && toast(`Thanks! ${data.payTo} will confirm once it arrives`)); }
    else if (f.dataset.addtable) {
      openEv.add(f.dataset.addtable);
      op({ op: "addTable", ev: f.dataset.addtable, time: fd("time"), size: fd("size") }).then((ok) => ok && toast("Booking added"));
    }
    else if (f.dataset.setprice) {
      const E = data.events.find((x) => x.id === f.dataset.setprice);
      if (!E.going.length) { toast("Tick who's going first, then enter the total"); return; }
      op({ op: "setPrice", ev: E.id, total: fd("total"), count: E.going.length }).then((ok) => ok && toast(`Saved: ${hk(+fd("total") / E.going.length)} each for ${E.going.length} people`));
    }
    else if (f.dataset.addperson) { const ev = f.dataset.addperson, name = fd("name"); op({ op: "addPerson", name }).then(() => op({ op: "toggle", ev, name, on: true })); }
  });

  render();
  if (pass) unlock(pass, true);
})();
