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
    return placesFor(venue)[0] || null;
  };
  // every guide place a venue names, in the order written ("Dim Sum Library or Lin Heung Lau" gives both)
  function placesFor(venue) {
    const v = String(venue || "").toLowerCase();
    if (v.length < 4) return [];
    const exact = PLACES.find((p) => p.name.toLowerCase() === v);
    if (exact) return [exact];
    const seen = new Set();
    return PLACES.map((p) => { const n = p.name.toLowerCase().replace(/\s*\(.*\)$/, ""); return [p, n.length >= 5 ? v.indexOf(n) : -1]; })
      .filter(([p, i]) => i >= 0 && !seen.has(p.name) && seen.add(p.name)).sort((a, b) => a[1] - b[1]).map(([p]) => p);
  }

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
  let editing = null, busy = false, newEvKind = null; // newEvKind: which places "Where" suggests when adding an event
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
    // classmates not in Hong Kong (marked * in the study-group list) are left out entirely
    (data.groups || []).forEach(([, ns]) => ns.forEach((n) => { if (/\*$/.test(n)) return; if (!seen.has(n)) { seen.add(n); out.push({ name: n }); } }));
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
    const mineRienno = mine.filter((e) => each(e)); // set-price events Rienno collects; split bills live under "Split a bill"
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
      ${settleBox()}
      <h3 class="cc-h">🎉 Class events <small>tap one to tick who's going or enter the bill</small></h3>
      <div class="cc-events">${evs.map((e) => evCard(e, ppl)).join("")}</div>
      ${live() ? `<details class="cc-add"><summary>➕ Add an event for the class</summary>
        <form id="cc-newev" class="cc-grid-form">
          <input name="title" placeholder="What (e.g. Dragon's Back hike, Lamma day trip, drinks)" required maxlength="70">
          <select name="iso" aria-label="Day">${DAYS.map(([iso, l]) => `<option value="${iso}">${esc(l)}</option>`).join("")}</select>
          <input name="when" placeholder="Time (e.g. 19:00)" maxlength="40">
          <select name="kind" aria-label="What kind of event" data-evkind="1">${[["hikes", "🌿 Hike or beach"], ["sights", "📸 Sight or outing"], ["city", "🍽️ Food & drink"], ["shop", "🛍️ Shopping"], ["", "Other"]].map(([k, l]) => `<option value="${k}"${(newEvKind ?? "hikes") === k ? " selected" : ""}>${l}</option>`).join("")}</select>
          <input name="venue" placeholder="Where: pick from the guide or type a place" maxlength="80" list="cc-places-${newEvKind ?? "hikes"}">
          ${[["hikes", ["hikes"]], ["sights", ["sights"]], ["city", ["city", "saiwan"]], ["shop", ["shop"]]].map(([k, tabs]) => `<datalist id="cc-places-${k}">${PLACES.filter((p) => tabs.includes(p.tab)).map((p) => `<option value="${esc(p.name)}">`).join("")}</datalist>`).join("")}
          <button type="submit">Add event</button>
        </form></details>` : ""}
      ${billsSection()}
      ${everyoneBalances()}
      ${live() ? nameFixer() : ""}
      ${overview(evs)}
      <details class="cc-groups"><summary>📚 Becker study groups</summary>
        <div class="cc-grid">${(data.groups || []).map(([g, ns]) => `<div><h4>${esc(g)}</h4><ul>${ns.filter((n) => !/\*$/.test(n)).map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>`).join("")}</div>
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
      const status = ps ? `<span class="sp-status ${ps === "paid" ? "ok" : "wait"}">${ps === "paid" ? "✓ Paid" : `⏳ ${esc(data.payTo)} to confirm`}</span>` : "";
      return `<li class="mi"><div class="mrow"><span>${esc(e.title)}</span><b>${each(e) ? `${hk(each(e))} <small>≈ ${fx(each(e))}</small>` : (data.bills || []).some((b) => b.ev === e.id) ? `<small>split bill ↓</small>` : `<small>cost to come</small>`}</b></div>
        ${status || payOne || undo ? `<div class="sp-act">${status}${payOne}${undo}</div>` : ""}</li>`; }).join("");
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
      ${rows ? `<details class="cc-break" open><summary>For ${mine.length} event${mine.length > 1 ? "s" : ""} · pay all at once or one at a time</summary><ul class="cc-mine">${rows}</ul></details>`
        : `<p class="small">Nothing to pay ${esc(data.payTo)} right now. Dinners someone else paid for show under "Split a bill" below.</p>`}
      ${isPayer ? `<p class="small">You're collecting: confirm payments in "Who's paid" below.</p>` : ""}
    </div>`;
  }


  // table bookings for an event: just the times and sizes (people turn up and get seated as tables free up)
  // booked seats against everyone who said they're going: how many more to book (0 = enough)
  const seats = (e) => (e.tables || []).reduce((t, x) => t + (+x.size || 0), 0);
  const ORGANISERS = ["Rienno Wan", "Lisa Lam", "Florence Lau", "Kejia Bian"];
  const orgEvent = (e) => !e.by || ORGANISERS.includes(e.by);
  const unnamed = (e) => +e.guests || 0; // guests: not on the class list (e.g. another section) or a +1 not named yet; they share the cost and pay the collector directly
  const gS = (n) => `${n} guest${n === 1 ? "" : "s"}`;
  const headcount = (e) => e.going.length + unnamed(e);
  const goingTxt = (e) => `${headcount(e)} going${unnamed(e) ? ` (incl. ${gS(unnamed(e))})` : ""}`;
  const seatsShort = (e) => ((e.tables || []).length ? Math.max(0, headcount(e) - seats(e)) : 0);
  function tablesBlock(e) {
    const tables = e.tables || [];
    const short = seatsShort(e), n = seats(e);
    const seatLine = tables.length ? (short
      ? `<p class="tb-gap">⚠️ <b>${headcount(e)} going, ${n} seats booked: book ${short} more seat${short > 1 ? "s" : ""}</b>${unnamed(e) ? `<br><small>Includes ${gS(unnamed(e))}</small>` : ""}</p>`
      : `<p class="tb-ok">✓ ${n} seats booked for ${headcount(e)} going${n > headcount(e) ? ` · ${n - headcount(e)} spare` : ""}</p>`) : "";
    if (!tables.length && !live() && !e.bookedBy) return "";
    return `<div class="cc-tables"><h4>🍽️ Table bookings${e.bookedBy ? ` <small>· booked by ${esc(e.bookedBy)}</small>` : ""}</h4>${seatLine}
      ${tables.length ? `<ul class="tb-list">${tables.map((t) => `<li class="tb"><div class="tb-top"><b>${esc(t.time || "Time TBC")}</b> <span>${t.label ? `${esc(t.label)} · ` : ""}table for ${t.size || "?"}</span>
        ${live() ? `<button type="button" class="cc-mini" data-splittable="${e.id}|${t.id}">🧾 Split this table's bill</button><button type="button" class="cc-x" data-deltable="${e.id}|${t.id}" aria-label="Remove booking">✕</button>` : ""}</div>
        ${live() ? `<details class="tb-edit"><summary>✏️ Change time or seats</summary><form class="cc-inline" data-edittable="${e.id}|${t.id}"><input name="time" value="${esc(t.time || "")}" placeholder="Time, e.g. 20:00" maxlength="20" aria-label="Booking time"><input name="size" type="number" inputmode="numeric" min="1" max="40" value="${t.size || ""}" placeholder="Seats" aria-label="Number of seats" required><button type="submit">Save</button></form></details>` : ""}</li>`).join("")}</ul>
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
      <span class="n">${e.going.length}${unnamed(e) ? ` +${unnamed(e)}` : ""} going${inIt ? " · ✓ you" : ""}<br><em>${p ? `${hk(p)} each ≈ ${fx(p)}` : "price to come"}</em></span></summary>
      ${placesFor(e.venue).map((pl) => `<button type="button" class="cc-venue" data-jump="${pl.id}">📍 ${esc(pl.name)} · map &amp; taxi card →</button>`).join("")}
      ${e.note ? `<p class="cc-note">ℹ️ ${esc(e.note)}</p>` : ""}
      ${e.group ? `<p class="cc-either">Pick one: ${data.events.filter((x) => x.group === e.group && x.id !== e.id).map((x) => esc(x.title)).join(" or ")} is the other option. Going to this one takes you off the other.</p>` : ""}
      ${me && live() ? `<button type="button" class="cc-imin${inIt ? " on" : ""}" data-tick="${e.id}" data-name="${esc(me)}" data-on="${inIt ? 0 : 1}">${inIt ? "✓ I'm going · tap to undo" : "+ I'm going"}</button>` : ""}
      ${ed
        ? `<p class="cc-hint">Tap names to tick or untick · ${e.going.length} going</p>
          <input class="name-find" data-find="ev" placeholder="Type a name to find them (Enter to tick)" autocomplete="off" aria-label="Find a name">
          <div class="cc-names edit">${ppl.map((x) => `<button type="button" data-nm="${esc(`${x.name} ${(data.aka || {})[x.name] || ""}`.trim().toLowerCase())}" class="${e.going.includes(x.name) ? "on" : ""}${x.away ? " away" : ""}" data-tick="${e.id}" data-name="${esc(x.name)}" data-on="${e.going.includes(x.name) ? 0 : 1}">${e.going.includes(x.name) ? "✓ " : ""}${esc(x.name)}</button>`).join("")}</div>
          <p class="cc-hint">Someone not on the class list, like a classmate from another section? Add them under 👤 Guests below: they share the cost and pay directly.</p>
          <button type="button" class="cc-done" data-edit="">Done</button>`
        : `<div class="cc-names">${e.going.map((n) => `<span class="${n === me ? "me" : ""}">${esc(n)}</span>`).join("") || `<em class="muted">Nobody yet</em>`}</div>
          ${live() ? `<button type="button" class="cc-editbtn" data-edit="${e.id}">✏️ Tick who's going</button>` : ""}`}
      ${live() || unnamed(e) ? `<div class="cc-guests"><span>👤 Guests <small>Not on the class list (e.g. someone from another section) or a +1 not named yet</small></span>
        ${live() ? `<span class="gq"><button type="button" data-guests="${e.id}|-1" aria-label="One fewer guest"${unnamed(e) ? "" : " disabled"}>−</button><b>${unnamed(e)}</b><button type="button" data-guests="${e.id}|1" aria-label="One more guest">+</button></span>` : `<b>${unnamed(e)}</b>`}</div>
        ${unnamed(e) ? `<p class="muted small cc-gnote">Counted for seats and the cost split, so everyone pays a bit less. Guests pay their share to ${esc(data.payTo || "the organiser")} directly. If it turns out they're on the class list, tick their name and tap −.</p>` : ""}` : ""}
      ${tablesBlock(e)}
      <div class="cc-bills">
        <h4>Cost</h4>
        ${p ? `<p class="cc-price"><b>${hk(p)}</b> each <span>≈ ${["USD", "GBP", "EUR", "JPY"].map((c) => fx(p, c)).join(" · ")}</span></p>
          <p class="muted small">${e.total ? `Total ${hk(e.total)} ÷ ${e.priceCount || Math.round(e.total / p)} people = ${hk(p)} each` : `${hk(p)} per person`}</p>
          ${e.total && e.priceCount && e.priceCount !== headcount(e) && headcount(e) && live()
            ? `<p class="cc-recalc">Now ${goingTxt(e)}. <button type="button" class="cc-mini go" data-recalc="${e.id}">Recalculate: ${hk(e.total / headcount(e))} each</button></p>` : ""}
          ${e.total ? `<p class="muted small">The price follows the final headcount: if more people join, tap Recalculate.</p>` : ""}
          ${unnamed(e) ? `<p class="cc-gpay">👤 Includes ${gS(unnamed(e))}: ${unnamed(e) === 1 ? "they pay" : "each pays"} ${hk(p)} to ${esc(data.payTo || "the organiser")} directly.</p>` : ""}`
          : (() => { // no set price: split the bill(s) between whoever was there, whoever paid
              const evBills = (data.bills || []).filter((b) => b.ev === e.id);
              return `${evBills.length ? `<ul class="ev-bills">${evBills.map((b) => `<li><span>🧾 ${esc(b.what)} · paid by ${esc(b.paidBy)} · ${b.among.length} people${bG(b) ? ` + ${gS(bG(b))}` : ""}</span><b>${hk(b.hkd)}</b></li>`).join("")}</ul>` : ""}
                ${live() ? `<p class="muted small">One bill per table if tables ate different things; each is split only between the people at that table.</p>
                <button type="button" class="cc-mini go" data-splitev="${e.id}">🧾 ${evBills.length ? "Add another table's bill" : "Add the bill (or the first table's)"}</button>
                <details class="cc-collect"><summary>${esc(data.payTo)} collecting a set price instead?</summary>` : ""}`;
            })()}
        ${e.expenses.length ? `<ul>${e.expenses.map((x) => `<li><span>${esc(x.what)} · paid by ${esc(x.paidBy)}</span><b>${hk(+x.hkd)}</b>${live() ? `<button type="button" class="cc-x" data-delexp="${e.id}" data-xid="${x.id}" aria-label="Remove bill">✕</button>` : ""}</li>`).join("")}</ul>` : ""}
        ${live() ? `<form class="cc-inline bill" data-setprice="${e.id}">
          <input name="total" type="number" inputmode="numeric" min="0" step="1" placeholder="Total bill HK$" value="${e.total || ""}" aria-label="Total bill in HK$" required>
          <button type="submit">${e.total || e.price ? "Update total" : "Set total"}</button>
          <span class="muted small">Split between ${goingTxt(e)}</span></form>${p ? "" : "</details>"}` : ""}
      </div>
      ${live() ? `<details class="cc-editev"><summary>✏️ Change time or place</summary>
        <form class="cc-inline" data-editev="${e.id}">
          <input name="when" value="${esc(e.when || "")}" placeholder="Time, e.g. 08:15" maxlength="50" aria-label="Time">
          <input name="venue" value="${esc(e.venue || "")}" placeholder="Where" maxlength="80" aria-label="Where" list="cc-places-city">
          <input name="title" value="${esc(e.title)}" placeholder="Event name" maxlength="70" aria-label="Event name" required>
          <button type="submit">Save</button></form></details>
        <button type="button" class="cc-del" data-delev="${e.id}">🗑 Remove this event${orgEvent(e) ? " (organisers)" : ""}</button>` : ""}
    </details>`;
  }


  // bank details one line at a time, each with its own Copy (that's how bank apps ask for them)
  function bankLines(o) {
    const lines = [["Account name", o.accName], ["Bank", o.bankName], ["Account number", o.accNo], ["SWIFT / bank code", o.swift]].filter(([, v]) => v);
    if (!lines.length && o.bank) lines.push(["Bank details", o.bank]);
    const all = lines.map(([k, v]) => `${k}: ${v}`).join("\n");
    return lines.length ? `<div class="bank-lines">${lines.map(([k, v]) => `<button type="button" class="bl" data-copy="${esc(v)}"><span><small>${k}</small>${esc(v)}</span><span class="pw-copy">Copy</span></button>`).join("")}
      ${lines.length > 1 ? `<button type="button" class="pw-copy all" data-copy="${esc(all)}">📋 Copy all bank details</button>` : ""}</div>` : "";
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
      <div class="pw"><span class="pw-i">💬</span><div><b>WeChat Pay</b><small>Only if your WeChat Pay uses a Chinese or HK bank account (overseas cards can't send to people)${L.wechat ? ` · <span class="pw-v">${esc(L.wechat)}</span>` : ""}</small></div>${L.wechat ? copy(L.wechat) : soon}</div>
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

    </div>`;
  }

  const SHORT = { "sun-dimsum": "Sun Dim Sum", "mon-hotpot": "Mon Hotpot", "wed-tram": "Wed Tram", "thu-dpd": "Thu Dai Pai Dong", };
  // each person's real cost per event: the set price, or their share of whichever table bill they were on
  function shareFor(n, e) {
    if (e.price > 0) return e.going.includes(n) ? +e.price : 0;
    return (data.bills || []).filter((b) => b.ev === e.id).reduce((t, b) => t + (billShares(b)[n] || 0), 0);
  }
  // column names: short day + event, e.g. "Thu Dim Sum Breakfast"
  // short column titles: day + the event name without any "(…)", "· …" or ": …" description, at most 3 words
  const colName = (e) => SHORT[e.id] || `${(DAYS.find(([iso]) => iso === e.iso)?.[1] || "").split(" ")[0]} ${e.title.replace(/\s*[(·:–-].*$/, "").split(/\s+/).slice(0, 3).join(" ")}`.trim();
  // the footer shows each table's (or each) bill rather than one big total
  const evBills = (e) => (data.bills || []).filter((b) => b.ev === e.id);
  const billTag = (b, e) => { const t = String(b.what || "").match(/\b(\d{1,2}:\d{2})\b/); if (t) return `${t[1]} table`; const w = String(b.what || "Bill"); return w.includes(",") ? w.split(",").pop().trim() : w.replace(e.title, "").replace(/^[\s,·:-]+/, "") || "Bill"; };
  function overview(evs) {
    const ppl = people(), bal = allBalances();
    const other = (n) => (data.bills || []).filter((b) => !b.ev).reduce((t, b) => t + (billShares(b)[n] || 0), 0);
    const total = (n) => evs.reduce((t, e) => t + shareFor(n, e), 0) + other(n);
    const cell = (n, e) => {
      const go = e.going.includes(n), amt = shareFor(n, e);
      const inner = `${go ? "✓" : ""}${amt ? `<small>${hk(amt)}</small>` : ""}`;
      return `<td>${live() ? `<button type="button" class="cc-cell${go ? " on" : ""}" data-tick="${e.id}" data-name="${esc(n)}" data-on="${go ? 0 : 1}" aria-label="${esc(n)}: ${esc(e.title)}">${inner}</button>` : inner}</td>`;
    };
    return `<details class="cc-all"><summary>📋 Full list: everyone × every event</summary>
      <div class="cc-scroll"><table>
        <thead><tr><th>Name</th>${evs.map((e) => `<th>${esc(colName(e))}</th>`).join("")}<th>Total</th><th>Balance</th></tr></thead>
        <tbody>${ppl.map((n) => { const b = Math.round(bal[n] || 0), tt = total(n);
          return `<tr class="${n === me ? "me" : ""}"><td>${esc(n)}</td>${evs.map((e) => cell(n, e)).join("")}<td>${tt ? hk(tt) : "–"}</td><td class="${b < 0 ? "neg" : b > 0 ? "pos" : ""}">${Math.abs(b) < 1 ? "✓" : b < 0 ? `owes ${hk(-b)}` : `owed ${hk(b)}`}</td></tr>`; }).join("")}</tbody>
        <tfoot><tr><td>Going</td>${evs.map((e) => { const bs = evBills(e);
          const cost = e.price > 0 ? `${hk(e.price)} each` : bs.length ? bs.map((b) => `${esc(billTag(b, e))}: ${hk(b.hkd)}`).join("<br>") : "cost TBC";
          return `<td>${e.going.length}${unnamed(e) ? ` +${unnamed(e)}` : ""}<br><small>${cost}</small></td>`; }).join("")}<td></td><td></td></tr></tfoot>
      </table></div>
      <p class="muted small">${live() ? "Tap a box to tick or untick. " : ""}Each box shows that person's cost: the set price, or their share of their table's bill. Balance is after everything that's been paid back.</p>
      <button type="button" class="cc-csv" id="cc-csv">Copy as spreadsheet (CSV)</button>
    </details>`;
  }

  /* ---------- split a bill: dinners by table, people's own events, any payer ---------- */
  // a draft kept outside the DOM, so the form survives the list refreshing every 30 seconds
  let billDraft = null;
  // who paid: for class events Rienno pays everything up front (even if he isn't there), so he's the default;
  // anyone else who covers a table just switches "Paid by". Bills not tied to an event default to you.
  const defaultPayer = (evId) => (evId && data.payTo ? data.payTo : me || data.payTo);
  const newDraft = () => ({ what: "", ev: "", hkd: "", paidBy: me || data.payTo, among: new Set(me ? [me] : []), mode: "equal", shares: {}, q: "", guests: 0 });
  const bG = (b) => (b.shares ? 0 : +b.guests || 0); // guests at the table pay the payer directly
  const billShares = (b) => b.shares || Object.fromEntries(b.among.map((n) => [n, b.hkd / (b.among.length + bG(b))]));
  const named = (b) => Object.values(billShares(b)).reduce((t, v) => t + v, 0); // what the people on the list owe
  function billBalances() { // + means you're owed, - means you owe
    const bal = {};
    (data.bills || []).forEach((b) => {
      bal[b.paidBy] = (bal[b.paidBy] || 0) + named(b);
      Object.entries(billShares(b)).forEach(([n, v]) => { bal[n] = (bal[n] || 0) - v; });
    });
    (data.xfers || []).filter((x) => !x.direct).forEach((x) => { bal[x.from] = (bal[x.from] || 0) + x.hkd; bal[x.to] = (bal[x.to] || 0) - x.hkd; });
    return bal;
  }
  // when two people owe each other (one way netted, the other a payback), show only the difference
  function offsetPairs(pool, direct) {
    const out = pool.map((t) => ({ ...t }));
    direct.forEach((d) => {
      const t = out.find((x) => !x.direct && x.from === d.to && x.to === d.from);
      if (!t) { out.push({ ...d }); return; }
      const net = d.hkd - t.hkd;
      out.splice(out.indexOf(t), 1);
      if (net >= 1) out.push({ ...d, hkd: net, note: `${d.note}, less the ${hk(t.hkd)} ${d.to} owes ${d.from}` });
      else if (net <= -1) out.push({ ...t, hkd: -net });
    });
    return out;
  }
  // money someone fronted for a bill that another person collects: the collector pays them back directly
  function directDebts() {
    const m = {};
    (data.bills || []).filter((b) => b.frontedBy).forEach((b) => { const k = `${b.paidBy}|${b.frontedBy}`; (m[k] = m[k] || { from: b.paidBy, to: b.frontedBy, hkd: 0, what: [] }).hkd += b.hkd; m[k].what.push(b.what); });
    (data.xfers || []).filter((x) => x.direct).forEach((x) => { const k = `${x.from}|${x.to}`; if (m[k]) m[k].hkd -= x.hkd; });
    return Object.values(m).filter((d) => d.hkd >= 1).map((d) => ({ from: d.from, to: d.to, hkd: Math.round(d.hkd), direct: true, note: d.what.join(", ") }));
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
  // someone's saved payment details (Rienno's also fall back to the organiser pay links)
  const profileOf = (to) => ({ ...(to === data.payTo ? data.payLinks || {} : {}), ...Object.fromEntries(Object.entries((data.profiles || {})[to] || {}).filter(([, v]) => v)) });
  // one entry per way this person can be paid, each with its details: [method label, html]
  function payOpts(to, amt) {
    const pr = profileOf(to), bl = bankLines(pr);
    return [
      pr.paypal && ["PayPal / card", `<div class="paybtns"><a class="paybtn" href="${esc(pr.paypal.replace(/\/$/, ""))}${/paypal\.me/i.test(pr.paypal) && amt ? `/${Math.round(amt)}HKD` : ""}" target="_blank" rel="noopener">💳 Pay ${amt ? `${hk(amt)} ` : ""}by PayPal / card</a></div><small class="pm-hint">Opens PayPal${amt ? " with the amount filled in" : ""}. A card fee of about 3–5% applies.</small>`],
      pr.fps && ["FPS", `<div class="bank-lines"><button type="button" class="bl" data-copy="${esc(pr.fps)}"><span><small>FPS ID / phone</small>${esc(pr.fps)}</span><span class="pw-copy">Copy</span></button></div><small class="pm-hint">Hong Kong bank accounts only: instant and free.</small>`],
      (bl || pr.wiseLink) && ["Wise / bank", `${pr.wiseLink ? `<div class="paybtns"><a class="paybtn" href="${esc(pr.wiseLink)}" target="_blank" rel="noopener">🌍 Pay with Wise</a></div>` : ""}${bl}`],
      pr.wechat && ["WeChat Pay", `<div class="bank-lines"><button type="button" class="bl" data-copy="${esc(pr.wechat)}"><span><small>WeChat ID</small>${esc(pr.wechat)}</span><span class="pw-copy">Copy</span></button></div><small class="pm-hint">Add them on WeChat, then Transfer. Only works if your WeChat Pay uses a Chinese or HK bank account.</small>`],
    ].filter(Boolean);
  }
  const noDetails = (to) => `<p class="muted small">${esc(to)} hasn't added payment details yet. Ask in the group chat, or they can add them under "My payment details".</p>`;
  // everything at once (the "Look up payment details" panel)
  function waysToPay(to, amt) {
    const o = payOpts(to, amt), note = profileOf(to).note;
    return o.length ? `${o.map(([m, h]) => `<div class="pm-all"><p class="pm-h">${esc(m)}</p>${h}</div>`).join("")}${note ? `<p class="muted small">${esc(note)}</p>` : ""}` : noDetails(to);
  }
  const pmChoice = {};
  // paying one person: pick how, see just that method's details, then "I've paid"
  function payForm(t) {
    const o = payOpts(t.to, t.hkd), note = profileOf(t.to).note;
    const methods = o.length ? [...o.map(([m]) => m), "Cash"] : PAY_METHODS;
    const pick = methods.includes(pmChoice[t.to]) ? pmChoice[t.to] : methods[0]; // keep the method you chose across redraws
    return `${o.length ? "" : noDetails(t.to)}<form class="cc-inline paid pm-form" data-xfer="${esc(JSON.stringify(t))}">
      <label class="pm-pick"><span>How are you paying ${esc(t.to)}?</span><select name="method" data-pmsel="${esc(t.to)}">${methods.map((m) => `<option${m === pick ? " selected" : ""}>${m}</option>`).join("")}</select></label>
      ${o.map(([m, h]) => `<div class="pm-pane" data-pm="${esc(m)}"${m === pick ? "" : " hidden"}>${h}</div>`).join("")}
      ${note ? `<p class="muted small">${esc(note)}</p>` : ""}
      <button type="submit">✓ I've paid ${esc(t.to)}</button></form>`;
  }

  /* ---------- one combined balance: set-price events (Rienno paid), every bill, every payment ---------- */
    // each payment: who → who and the amount on top; status and buttons on their own line (anyone can mark or confirm)
  const sRow = (t) => `<li class="sp${t.to === me ? " owed" : t.from === me ? " me" : ""}">
      <div class="sp-top"><span class="sp-who">${t.to === me ? `<b>${esc(t.from)}</b> owes you` : t.from === me ? `To <b>${esc(t.to)}</b>` : `<b>${esc(t.from)}</b> → <b>${esc(t.to)}</b>`}${t.direct ? `<small class="sp-for">Paid up front: ${esc(t.note)}</small>` : ""}</span><span class="amt">${hk(t.hkd)} <small>≈ ${fx(t.hkd)}</small></span></div>
      ${t.from === me ? payForm(t)
        : `<button type="button" class="cc-mini go sp-paid" data-xmark="${esc(JSON.stringify(t))}" aria-label="${esc(t.from)} has paid me">✓ Paid me</button>`}</li>`;
  const pRow = (x) => `<li class="sp pending">
      <div class="sp-top"><span class="sp-who"><b>${esc(x.from)}</b> paid <b>${esc(x.to)}</b>${x.method ? ` <small>· ${esc(x.method)}</small>` : ""}${x.note ? ` <small>· ${esc(x.note)}</small>` : ""}</span><span class="amt">${hk(x.hkd)}</span></div>
      <div class="sp-act"><span class="sp-status wait">⏳ Needs confirming</span>
        <button type="button" class="cc-mini go" data-xconfirm="${x.id}">✓ Confirm received</button>
        <button type="button" class="cc-mini undo" data-xundo="${x.id}">↩ Undo</button></div></li>`;

  function allBalances() { // + means you're owed, - means you owe
    const bal = balances(); // set-price events: Rienno paid, everyone ticked owes the set price
    const add = (n, v) => { bal[n] = (bal[n] || 0) + v; };
    Object.entries(data.settle || {}).forEach(([n, v]) => (v.payments || []).forEach((p) => { add(n, p.hkd); add(data.payTo, -p.hkd); }));
    Object.entries(billBalances()).forEach(([n, v]) => add(n, v)); // bills and payments between people
    return bal;
  }
  // the top box: what you owe and what you're owed, after netting everything out
  function settleBox() {
    if (!me) return `<div class="cc-owe"><h3 class="cc-h">💸 Settle up</h3><p class="small">Pick your name above to see what you owe and what you're owed.</p></div>`;
    const bal = allBalances(), sugg = simplify(bal);
    const all = offsetPairs(sugg, directDebts());
    const owe = all.filter((t) => t.from === me), owed = all.filter((t) => t.to === me);
    const pend = (data.xfers || []).filter((x) => !x.confirmed && (x.from === me || x.to === me));
    const sum = (a) => a.reduce((t, x) => t + x.hkd, 0);
    const items = [];
    data.events.forEach((e) => { if (e.price > 0 && e.going.includes(me)) items.push([e.title, -e.price, `paid by ${data.payTo}`]); });
    (data.bills || []).forEach((b) => { const sh = billShares(b)[me]; if (sh) items.push([b.what, -sh, `paid by ${b.paidBy}`]); if (b.paidBy === me) items.push([b.frontedBy ? `You collect: ${b.what}` : `You paid: ${b.what}`, named(b), `for ${b.among.length} people${bG(b) ? ` (+ ${gS(bG(b))} who pay you directly)` : ""}`]);
      if (b.frontedBy === me) items.push([`You paid the restaurant: ${b.what}`, b.hkd, `${b.paidBy} pays you back`]); if (b.frontedBy && b.paidBy === me) items.push([`${b.frontedBy} paid the restaurant`, -b.hkd, "you pay them back"]); });
    (data.xfers || []).filter((x) => x.confirmed && (x.from === me || x.to === me)).forEach((x) => items.push([x.from === me ? `You paid ${x.to}` : `${x.from} paid you`, x.from === me ? x.hkd : -x.hkd, "✓✓ confirmed"]));
    Object.values(data.settle?.[me]?.payments || []).forEach((p) => items.push([`You paid ${data.payTo}`, p.hkd, p.confirmed ? "✓✓ confirmed" : "⏳ needs confirming"]));
    return `<div class="cc-owe">
      <h3 class="cc-h">💸 Settle up</h3>
      <p class="muted small">Everything is netted out: who paid for what, your share, and what's already been paid back. So you may pay someone different from whoever covered your meal. "How it adds up" shows the detail.</p>
      ${(() => { const un = data.events.filter((e) => unnamed(e)); return un.length ? `<p class="muted small cc-gpay">👤 Guests not on the class list: ${un.map((e) => `${esc(colName(e))} (${unnamed(e)}${e.price > 0 ? ` × ${hk(e.price)}` : ""})`).join(", ")}. They pay ${esc(data.payTo || "the organiser")} directly, so they aren't in the balances here.</p>` : ""; })()}
      ${!owe.length && !owed.length ? `<p class="small">✓ You're all square right now.</p>` : ""}
      ${owe.length ? `<p class="sp-h">💸 You owe <b>${hk(sum(owe))}</b> <small>≈ ${fx(sum(owe))}</small></p><ul class="sp-list">${owe.map(sRow).join("")}</ul>` : ""}
      ${owed.length ? `<p class="sp-h">💰 Owed to you <b>${hk(sum(owed))}</b></p><ul class="sp-list">${owed.map(sRow).join("")}</ul>` : ""}
      ${pend.length ? `<p class="sp-h">⏳ Waiting to be confirmed</p><ul class="sp-list">${pend.map(pRow).join("")}</ul>` : ""}
      ${live() ? `<details class="cc-collect"><summary>💵 Someone paid you for their share? Record it</summary>
        <form class="cc-inline" id="cc-collect"><p class="muted small">For example, a classmate pays you by FPS or cash for an event ${esc(data.payTo)} paid. Record it here: their balance clears, and you then owe ${esc(data.payTo)} that amount instead.</p>
          <select name="from" aria-label="Who paid you" required><option value="">Who paid you?</option>${people().filter((n) => n !== me).map((n) => `<option>${esc(n)}</option>`).join("")}</select>
          <input name="hkd" type="number" inputmode="decimal" min="1" step="1" placeholder="HK$" aria-label="Amount" required>
          <button type="submit">✓ Record</button></form></details>` : ""}
      ${items.length ? `<details class="cc-break"><summary>How it adds up · ${items.length}</summary><ul class="cc-mine">${items.map(([w, v, by]) => `<li class="mi"><div class="mrow"><span>${esc(w)} <small>· ${esc(by)}</small></span><b class="${v < 0 ? "neg" : "pos"}">${v < 0 ? "−" : "+"}${hk(Math.abs(v))}</b></div></li>`).join("")}</ul></details>` : ""}
    </div>`;
  }
  // organisers: match names that aren't on the class list (WhatsApp nicknames) or count them as a guest;
  // and show a classmate by the name they go by
  function nameFixer() {
    const listed = roster().filter((p) => !p.guest).map((p) => p.name);
    const odd = roster().filter((p) => p.guest).map((p) => p.name);
    const where = (n) => data.events.filter((e) => e.going.includes(n)).map((e) => colName(e));
    const pick = (nm, ph) => `<select name="${nm}" aria-label="${ph}" required><option value="">${ph}</option>${listed.map((n) => `<option>${esc(n)}</option>`).join("")}</select>`;
    return `<details class="cc-sub cc-fixnames"${odd.length ? " open" : ""}><summary>🔧 Names not on the class list${odd.length ? ` · ${odd.length}` : " ✓"} <small>(organisers)</small></summary>
      <div class="fixn">
        ${odd.length ? odd.map((n) => `<form class="cc-inline fixn-row" data-fixname="${esc(n)}">
            <p class="small"><b>${esc(n)}</b>${where(n).length ? ` <small>· ${esc(where(n).join(", "))}</small>` : ""}</p>
            ${pick("to", "Same person as…")}
            <button type="submit">✓ Match</button>
            <button type="button" class="cc-mini" data-fixanon="${esc(n)}">Count as a guest</button></form>`).join("")
          : `<p class="small muted">Everyone ticked is on the class list.</p>`}
        <details class="fixn-alias"><summary>Show someone by the name they go by</summary>
          <form class="cc-inline" data-aliasname="1"><p class="small muted">For example Pan Fan Wan shows as Rienno Wan. Searching the old name still finds them.</p>
            ${pick("from", "Class-list name…")}<input name="to" placeholder="Name they go by" maxlength="60" required><button type="submit">Save</button></form></details>
      </div></details>`;
  }
  // run an organiser-only change, asking for the organiser code if this device isn't signed in as organiser
  function asOrganiser(body, done) {
    if (data.organiser) return op(body).then((ok) => ok && done?.());
    const code = (prompt("Organisers only. Enter the organiser code:") || "").trim().toLowerCase();
    if (!code) return;
    const keep = orgPass; orgPass = code;
    return op(body).then((ok) => { orgPass = keep; if (ok) done?.(); });
  }

  // everyone's net position (useful for organisers), plus the organiser settings
  function everyoneBalances() {
    const bal = allBalances();
    const rows = people().map((n) => [n, Math.round(bal[n] || 0)]).filter(([, v]) => Math.abs(v) >= 1).sort((a, b) => a[1] - b[1]);
    return `<div class="cc-pay">
      ${rows.length ? `<details class="cc-sub"><summary>📒 Everyone's balance · ${rows.length}</summary><ul class="cc-settle">${rows.map(([n, v]) => `<li class="${n === me ? "me" : ""}"><span class="nm">${esc(n)}</span><em class="${v < 0 ? "owe" : "ok"}">${v < 0 ? `owes ${hk(-v)}` : `is owed ${hk(v)}`}</em></li>`).join("")}</ul></details>` : ""}

    </div>`;
  }

  function billsSection() {
    if (!live()) return "";
    const bal = billBalances(), sugg = simplify(bal);
    // only what involves you: what you owe, what's owed to you, and payments waiting on you
    const pend = (data.xfers || []).filter((x) => !x.confirmed && me && (x.from === me || x.to === me));
    const ppl = people();
    const evName = (id) => data.events.find((e) => e.id === id)?.title;
    const mineSugg = me ? sugg.filter((t) => t.from === me || t.to === me) : [];
    const others = sugg.filter((t) => !mineSugg.includes(t));
    const d = billDraft;
    const form = d ? (() => {
      const total = +d.hkd || 0, among = [...d.among];
      const g = d.mode === "equal" ? +d.guests || 0 : 0;
      const each = among.length ? total / (among.length + g) : 0;
      const sum = among.reduce((t, n) => t + (+d.shares[n] || 0), 0);
      return `<form class="bill-form" id="bill-form" autocomplete="off">
        <div class="bf-row"><input name="what" placeholder="What (e.g. Thu dinner, table 2)" maxlength="60" value="${esc(d.what)}" data-bf="what">
          <select name="ev" data-bf="ev" aria-label="Which event"><option value="">Not linked to an event</option>${data.events.map((e) => `<option value="${e.id}"${d.ev === e.id ? " selected" : ""}>${esc(e.title)}</option>`).join("")}</select></div>
        <div class="bf-row"><label class="bf-l">Total HK$<input name="hkd" type="number" inputmode="decimal" min="1" step="0.01" value="${esc(d.hkd)}" data-bf="hkd" required></label>
          <label class="bf-l">Paid by <small>(everyone pays them)</small><select name="paidBy" data-bf="paidBy">${ppl.map((n) => `<option${n === d.paidBy ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label></div>
        <label class="bf-check"><input type="checkbox" data-bf="fronted"${d.fronted ? " checked" : ""}> Someone else paid the restaurant: ${esc(d.paidBy)} collects from everyone and pays them back</label>
        ${d.fronted ? `<label class="bf-l">Who paid the restaurant?<select name="frontedBy" data-bf="frontedBy">${ppl.filter((n) => n !== d.paidBy).map((n) => `<option${n === (d.frontedBy || me) ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>` : ""}
        <p class="bf-h">Who's at this table? <small>${among.length} picked</small>
          ${d.ev ? `<button type="button" class="cc-mini" data-bf-all="1">Everyone at ${esc(evName(d.ev) || "the event")}</button>` : ""}
          <button type="button" class="cc-mini" data-bf-none="1">Clear</button></p>
        <input class="name-find" data-find="bf" placeholder="Type a name to find them (Enter to tick)" value="${esc(d.q || "")}" autocomplete="off" aria-label="Find a name">
        <div class="cc-names edit">${ppl.map((n) => `<button type="button" class="${d.among.has(n) ? "on" : ""}" data-bf-toggle="${esc(n)}" data-nm="${esc(n.toLowerCase())}">${d.among.has(n) ? "✓ " : ""}${esc(n)}</button>`).join("")}</div>
        <p class="bf-h">Split
          <button type="button" class="cc-mini${d.mode === "equal" ? " go" : ""}" data-bf-mode="equal">Equally</button>
          <button type="button" class="cc-mini${d.mode === "custom" ? " go" : ""}" data-bf-mode="custom">Custom amounts</button></p>
        ${d.mode === "equal" ? `<label class="bf-l bf-g">Guests at this table <small>not on the class list; they pay ${esc(d.paidBy || "the payer")} directly</small><input type="number" inputmode="numeric" min="0" max="20" step="1" value="${g || ""}" placeholder="0" data-bf="guests" aria-label="Guests at this table"></label>
          <p class="small bf-each">${eqLine(total, among.length, g)}</p>`
          : `<div class="bf-custom">${among.map((n) => `<label>${esc(n)}<input type="number" inputmode="decimal" min="0" step="0.01" value="${esc(d.shares[n] ?? "")}" data-bf-share="${esc(n)}" placeholder="HK$"></label>`).join("")}</div>
             <p class="small ${Math.abs(sum - total) > 1 ? "warn-t" : "ok-t"}">Adds up to ${hk(sum)} of ${hk(total)}${Math.abs(sum - total) > 1 ? ` · ${hk(total - sum)} left to assign` : " ✓"}</p>`}
        <div class="bf-row"><button type="submit" class="paybtn">Add bill</button><button type="button" class="cc-mini" data-bf-cancel="1">Cancel</button></div>
      </form>`;
    })() : `<button type="button" class="cc-add-bill" data-bf-new="1">➕ Add a bill</button>`;
    const bills = (data.bills || []).slice().reverse();
    const pr = me ? (data.profiles || {})[me] || {} : null;
    return `<div class="cc-bills2">
      <h3 class="cc-h">🧾 Add a bill <small>whoever paid; split by table, equally or custom</small></h3>

      ${form}
      ${bills.length ? `<details class="cc-sub"><summary>All bills · ${bills.length}</summary><ul class="bill-list">${bills.map((b) => {
        const sh = billShares(b);
        return `<li><div class="sp-top"><b>${esc(b.what)}</b>${b.ev && evName(b.ev) ? ` <small>· ${esc(evName(b.ev))}</small>` : ""}<span class="amt">${hk(b.hkd)}</span>
          <button type="button" class="cc-x" data-bdel="${b.id}" aria-label="Delete bill">✕</button></div>
          <p class="small">Paid by ${esc(b.paidBy)}${b.frontedBy ? ` (${esc(b.frontedBy)} paid the restaurant)` : ""} · ${b.shares ? "custom split" : `${hk(b.hkd / (b.among.length + bG(b)))} each${bG(b) ? ` (+ ${gS(bG(b))} paying directly)` : ""}`}: ${b.among.map((n) => `${esc(n)}${b.shares ? ` ${hk(sh[n])}` : ""}`).join(", ")}</p></li>`;
      }).join("")}</ul></details>` : ""}
      ${(() => { const withPay = people().filter((n) => payOpts(n, 0).length); return `<details class="cc-sub cc-paylook"><summary>📇 Look up someone's payment details${withPay.length ? ` · ${withPay.length}` : ""}</summary>
        ${withPay.length ? `<div class="paylook"><select data-paylook="1" aria-label="Whose payment details"><option value="">Pick a name…</option>${withPay.map((n) => `<option>${esc(n)}</option>`).join("")}</select><div class="paylook-out"></div></div>`
          : `<p class="muted small">Nobody has saved payment details yet. Once they add them under "My payment details", they show here and next to anything you owe them.</p>`}</details>`; })()}
      ${me ? `<details class="cc-sub"><summary>💳 My payment details${pr.paypal || pr.fps || pr.bank || pr.accNo || pr.note || pr.wechat ? " ✓" : ""}</summary>
        <form class="pay-form" id="my-pay" autocomplete="off">
          <p class="small muted">So people can pay you back when you cover a bill. Fill in only what you use; only classmates with the passcode can see these.</p>
          <fieldset><legend>💳 PayPal</legend>
            <label>PayPal.me link<input name="paypal" inputmode="url" placeholder="paypal.me/yourname" value="${esc(pr.paypal || "")}"></label></fieldset>
          <fieldset><legend>🌍 Bank transfer</legend>
            <label>Account name<input name="accName" placeholder="Name on the account" value="${esc(pr.accName || "")}"></label>
            <label>Bank<input name="bankName" placeholder="e.g. Chase, Barclays, MUFG" value="${esc(pr.bankName || "")}"></label>
            <label>Account number / IBAN<input name="accNo" value="${esc(pr.accNo || "")}"></label>
            <label>SWIFT / routing / sort code<input name="swift" value="${esc(pr.swift || "")}"></label>
            <label>Wise payment link <small>(optional)</small><input name="wiseLink" inputmode="url" placeholder="https://wise.com/pay/…" value="${esc(pr.wiseLink || "")}"></label></fieldset>
          <fieldset><legend>📱 Other apps</legend>
            <label>Venmo, Revolut, Zelle, PayNow…<input name="note" placeholder="e.g. Venmo @yourname" value="${esc(pr.note || "")}"></label></fieldset>
          <details class="fps-box"${pr.wechat ? " open" : ""}><summary>💬 Use WeChat Pay with a Chinese or HK bank account? Add your WeChat ID</summary>
            <p class="small muted">Classmates whose WeChat Pay is also linked to a Chinese or HK bank can add you and send a transfer. WeChat Pay on an overseas card can't send money to people, so keep PayPal or bank details too.</p>
            <label>WeChat ID<input name="wechat" autocapitalize="off" value="${esc(pr.wechat || "")}"></label></details>
          <details class="fps-box"${pr.fps ? " open" : ""}><summary>🇭🇰 Have a Hong Kong bank account? Add FPS</summary>
            <label>FPS ID or phone<input name="fps" inputmode="numeric" value="${esc(pr.fps || "")}"></label></details>
          <fieldset><legend>🔒 PIN</legend>
            ${pr.locked ? `<label>Your PIN <small>(needed to change these)</small><input name="pin" type="password" inputmode="numeric" autocomplete="off"></label>
              <details class="fps-box"><summary>Forgot your PIN?</summary>
                <p class="small muted">Ask an organiser (Florence Lau, Lisa Lam, Kejia Bian or Rienno Wan) to type the organiser code here, then choose a new PIN.</p>
                <label>Organiser code<input name="orgcode" type="password" autocomplete="off"></label>
                <label>New PIN<input name="newPin" type="password" inputmode="numeric" maxlength="12" autocomplete="new-password"></label></details>`
              : `<label>Set a PIN <small>(optional, so only you can change these)</small><input name="newPin" type="password" inputmode="numeric" maxlength="12" autocomplete="new-password"></label>`}</fieldset>
          <button type="submit" class="paybtn big">Save my details</button>
        </form></details>` : `<p class="muted small">Pick your name above to add bills and your payment details.</p>`}
    </div>`;
  }
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (!billDraft || !root.contains(t)) return;
    if (t.dataset.bf) billDraft[t.dataset.bf] = t.value;
    if (t.dataset.bfShare) { billDraft.shares[t.dataset.bfShare] = t.value; const p = t.closest(".bill-form"); if (p) refreshSum(p); }
    if (t.dataset.bf === "hkd" || t.dataset.bf === "guests") { const p = t.closest(".bill-form"); if (p) refreshSum(p); }
  });
  function eqLine(total, n, g) {
    return n && total ? `${hk(total)} ÷ ${n + g} = <b>${hk(total / (n + g))}</b> each${g ? ` · incl. ${gS(g)}` : ""}` : "Pick who's in it and enter the total.";
  }
  function refreshSum(formEl) { // update the "adds up to" line without redrawing (keeps the keyboard open)
    const d = billDraft, total = +d.hkd || 0, among = [...d.among];
    const line = formEl.querySelector(".bf-custom + p.small") || formEl.querySelector('[data-bf-mode="equal"].go') && formEl.querySelector(".bf-row ~ p.small");
    if (d.mode === "custom") {
      const sum = among.reduce((t, n) => t + (+d.shares[n] || 0), 0);
      const p = formEl.querySelector(".bf-custom + p.small");
      if (p) { p.className = `small ${Math.abs(sum - total) > 1 ? "warn-t" : "ok-t"}`; p.innerHTML = `Adds up to ${hk(sum)} of ${hk(total)}${Math.abs(sum - total) > 1 ? ` · ${hk(total - sum)} left to assign` : " ✓"}`; }
    } else {
      const p = formEl.querySelector("p.bf-each");
      if (p) p.innerHTML = eqLine(total, among.length, +d.guests || 0);
    }
    return line;
  }
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (!billDraft || !root.contains(t) || !t.dataset.bf) return;
    if (t.dataset.bf === "fronted") { billDraft.fronted = t.checked; if (t.checked && !billDraft.frontedBy) billDraft.frontedBy = me !== billDraft.paidBy ? me : ""; render(); return; }
    billDraft[t.dataset.bf] = t.value;
    if (t.dataset.bf === "ev" && t.value) { const E = data.events.find((x) => x.id === t.value); if (E) { billDraft.among = new Set(E.going); billDraft.guests = unnamed(E); billDraft.paidBy = defaultPayer(E.id); if (!billDraft.what) billDraft.what = E.title; } render(); }
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
      el.innerHTML = `<button class="evlock open" data-cclink="${e.id}">👥 ${goingTxt(e)}${(e.tables || []).length ? ` · 🍽️ ${e.tables[0].time ? `tables from ${esc(e.tables[0].time)}` : `${seats(e)} seats booked`}${seatsShort(e) ? ` · ⚠️ ${seatsShort(e)} seat${seatsShort(e) > 1 ? "s" : ""} short` : seats(e) > headcount(e) ? ` · ${seats(e) - headcount(e)} seat${seats(e) - headcount(e) > 1 ? "s" : ""} free` : ""}` : ""}${p ? ` · ${hk(p)} each` : ""}</button>${e.note ? `<small class="evnote">ℹ️ ${esc(e.note)}</small>` : ""}`;
    });
  }
  window.HK_PRIVATE_RENDER = fillPlan;
  // the week plan's "+ Me" on a class event ticks you on the shared list too
  window.HK_CLASS = {
    // the live event, so the week plan's time and 📍 tag follow the real booking
    event: (ev) => (data && live() ? data.events.find((x) => x.id === ev) || null : null),
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
      op({ op: "toggle", ev, name, on }, () => { E.going = on ? [...new Set([...E.going, name])].sort((a, b) => a.localeCompare(b)) : E.going.filter((n) => n !== name);
        if (on && E.group) data.events.forEach((x) => { if (x !== E && x.group === E.group) x.going = x.going.filter((n) => n !== name); }); });
      return;
    }
    const ed = t.closest("[data-edit]");
    if (ed) { editing = ed.dataset.edit || null; if (editing) openEv.add(editing); render(); return; }
    const dx = t.closest("[data-delexp]");
    if (dx) { if (confirm("Remove this bill?")) op({ op: "delExpense", ev: dx.dataset.delexp, xid: dx.dataset.xid }); return; }
    const de = t.closest("[data-delev]");
    if (de) {
      const E = data.events.find((x) => x.id === de.dataset.delev);
      if (!confirm(`Remove "${E.title}" for everyone?`)) return;
      // events set up by the planning team need the organiser code; classmates' own events don't
      if (orgEvent(E) && !data.organiser) {
        const code = (prompt("This event was set up by the organisers. Enter the organiser code to remove it:") || "").trim().toLowerCase();
        if (!code) return;
        const keep = orgPass; orgPass = code;
        op({ op: "delEvent", ev: E.id }).then((ok) => { orgPass = keep; if (ok) toast("Event removed"); });
        return;
      }
      op({ op: "delEvent", ev: E.id });
      return;
    }
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
    const gq = t.closest("[data-guests]");
    const fa = e.target.closest("[data-fixanon]");
    if (fa) { const n = fa.dataset.fixanon, evs = data.events.filter((x) => x.going.includes(n));
      if (!confirm(`Take "${n}" off ${evs.length} event${evs.length === 1 ? "" : "s"} and count them as a guest instead?`)) return;
      (async () => { for (const E of evs) { await op({ op: "toggle", ev: E.id, name: n, on: false }); await op({ op: "setGuests", ev: E.id, n: unnamed(E) + 1 }); } toast(`${n} is now counted as a guest`); })(); return; }
    if (gq) { const [ev, d] = gq.dataset.guests.split("|"); const E = data.events.find((x) => x.id === ev); const n = Math.max(0, unnamed(E) + +d);
      op({ op: "setGuests", ev, n }, () => { E.guests = n; }); return; }
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
      billDraft = { ...newDraft(), ev: E.id, what: E.title, among: new Set(E.going), guests: unnamed(E), paidBy: defaultPayer(E.id) };
      render();
      setTimeout(() => document.getElementById("bill-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return;
    }
    if (t.closest("[data-bf-cancel]")) { billDraft = null; render(); return; }
    const bt = t.closest("[data-bf-toggle]");
    if (bt && billDraft) { const n = bt.dataset.bfToggle; if (billDraft.among.has(n)) billDraft.among.delete(n); else billDraft.among.add(n); render(); return; }
    if (t.closest("[data-bf-all]") && billDraft) { const E = data.events.find((x) => x.id === billDraft.ev); if (E) { billDraft.among = new Set(E.going); billDraft.guests = unnamed(E); } render(); return; }
    if (t.closest("[data-bf-none]") && billDraft) { billDraft.among = new Set(); render(); return; }
    const bm = t.closest("[data-bf-mode]");
    if (bm && billDraft) {
      billDraft.mode = bm.dataset.bfMode;
      if (billDraft.mode === "custom") { const n = billDraft.among.size, tot = +billDraft.hkd || 0; [...billDraft.among].forEach((x) => { if (billDraft.shares[x] == null && n && tot) billDraft.shares[x] = (Math.round((tot / n) * 100) / 100).toString(); }); }
      render(); return;
    }
    const xm = t.closest("[data-xmark]");
    if (xm) { const x = JSON.parse(xm.dataset.xmark); op({ op: "markXfer", from: x.from, to: x.to, hkd: x.hkd, method: "", confirmed: x.to === me, direct: !!x.direct, note: x.direct ? x.note : "" }).then((ok) => ok && toast(x.to === me ? `Got it: ${x.from} has paid you` : `Marked: ${x.from} paid ${x.to}`)); return; }
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
    if (rc) { const E = data.events.find((x) => x.id === rc.dataset.recalc); op({ op: "setPrice", ev: E.id, total: E.total, count: headcount(E) }).then((ok) => ok && toast(`Recalculated: ${hk(E.total / headcount(E))} each`)); return; }
    const ue = t.closest("[data-undoev]");
    if (ue) { const E = data.events.find((x) => x.id === ue.dataset.undoev); op({ op: "undoPaidEv", name: me, ev: E.id, hkd: Math.round(each(E) || 0) }).then((ok) => ok && toast(`Undone: ${E.title} is back to not paid`)); return; }
    const up = t.closest("[data-undopaid]");
    if (up) { op({ op: "undoPaid", name: me, i: +up.dataset.undopaid }).then((ok) => ok && toast("Undone: marked as not paid")); return; }
    if (t.id === "cc-relock") { data = null; mode = "locked"; forget("hk-pass-v1"); render(); return; }
    const cp = t.closest("[data-copy]");
    if (cp) {
      (navigator.clipboard?.writeText(cp.dataset.copy) || Promise.reject()).then(() => {
        const lab = cp.querySelector(".pw-copy") || cp; const was = lab.textContent; lab.textContent = "Copied ✓"; toast("Copied"); setTimeout(() => { lab.textContent = was; }, 1500);
      }, () => prompt("Copy this:", cp.dataset.copy));
      return;
    }
    if (t.id === "cc-csv" && data) {
      const evs = data.events, bal = balances();
      const ab = allBalances();
      const rows = [["Name", ...evs.map((ev) => colName(ev)), "Total (HKD)", "Balance (HKD, minus = owes)"]];
      people().forEach((n) => rows.push([n, ...evs.map((ev) => Math.round(shareFor(n, ev)) || (ev.going.includes(n) ? "going" : "")), Math.round(evs.reduce((t, ev) => t + shareFor(n, ev), 0)) || "", Math.round(ab[n] || 0)]));
      const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
      (navigator.clipboard?.writeText(csv) || Promise.reject()).then(() => { t.textContent = "Copied ✓ Paste into Sheets or Excel"; }, () => prompt("Copy this:", csv));
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.dataset?.pmsel) { pmChoice[e.target.dataset.pmsel] = e.target.value; e.target.form.querySelectorAll(".pm-pane").forEach((p) => { p.hidden = p.dataset.pm !== e.target.value; }); return; }
    if (e.target.dataset?.paylook) { const out = e.target.parentElement.querySelector(".paylook-out"); if (out) out.innerHTML = e.target.value ? waysToPay(e.target.value, 0) : ""; return; }
    if (e.target.dataset?.evkind) { newEvKind = e.target.value; const v = e.target.form?.elements.venue; if (v) v.setAttribute("list", `cc-places-${newEvKind || "none"}`); return; }
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
      if (d.fronted) body.frontedBy = f.elements.frontedBy?.value || d.frontedBy;
      if (d.mode === "custom") body.shares = Object.fromEntries(among.map((n) => [n, +d.shares[n] || 0]));
      else if (+d.guests > 0) body.guests = +d.guests;
      op(body).then((ok) => { if (ok) { billDraft = null; render(); toast("Bill added: everyone's share is worked out"); } });
    }
    else if (f.dataset.xfer) {
      const x = JSON.parse(f.dataset.xfer);
      op({ op: "markXfer", from: x.from, to: x.to, hkd: x.hkd, method: fd("method"), direct: !!x.direct, note: x.direct ? x.note : "" }).then((ok) => ok && toast(`Thanks! ${x.to} will confirm when it arrives`));
    }
    else if (f.dataset.fixname) { const from = f.dataset.fixname, to = fd("to"); if (to) asOrganiser({ op: "renamePerson", from, to }, () => toast(`${from} is now ${to} everywhere`)); }
    else if (f.dataset.aliasname) { const from = fd("from"), to = fd("to"); if (from && to && confirm(`Show ${from} as "${to}" everywhere?`)) asOrganiser({ op: "renamePerson", from, to }, () => toast(`${from} now shows as ${to}`)); }
    else if (f.id === "cc-collect") {
      const from = fd("from"), hkd = Math.round(+fd("hkd"));
      if (!from || !(hkd > 0)) return;
      op({ op: "markXfer", from, to: me, hkd, method: "Collected", confirmed: true, note: `collected for ${data.payTo}` }).then((ok) => ok && toast(`Recorded: ${from} paid you ${hk(hkd)}`));
    }
    else if (f.id === "my-pay" && fd("orgcode")) { // organiser resets a forgotten PIN
      const keep = orgPass; orgPass = fd("orgcode").toLowerCase();
      op({ op: "setProfile", name: me, paypal: fd("paypal"), fps: fd("fps"), accName: fd("accName"), bankName: fd("bankName"), accNo: fd("accNo"), swift: fd("swift"), wechat: fd("wechat"), wiseLink: fd("wiseLink"), note: fd("note"), newPin: fd("newPin") })
        .then((ok) => { orgPass = keep; if (ok) toast(fd("newPin") ? "PIN reset and details saved" : "Details saved"); });
    }
    else if (f.id === "my-pay") {
      op({ op: "setProfile", name: me, paypal: fd("paypal"), fps: fd("fps"), accName: fd("accName"), bankName: fd("bankName"), accNo: fd("accNo"), swift: fd("swift"), wechat: fd("wechat"), wiseLink: fd("wiseLink"), note: fd("note"), pin: fd("pin"), newPin: fd("newPin") })
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
    else if (f.dataset.edittable) {
      const [ev, table] = f.dataset.edittable.split("|");
      openEv.add(ev);
      op({ op: "editTable", ev, table, time: fd("time"), size: fd("size") }).then((ok) => ok && toast("Booking updated for everyone"));
    }
    else if (f.dataset.editev) {
      op({ op: "editEvent", ev: f.dataset.editev, when: fd("when"), venue: fd("venue"), title: fd("title") }).then((ok) => ok && toast("Saved for everyone"));
    }
    else if (f.dataset.setprice) {
      const E = data.events.find((x) => x.id === f.dataset.setprice);
      if (!E.going.length) { toast("Tick who's going first, then enter the total"); return; }
      op({ op: "setPrice", ev: E.id, total: fd("total"), count: headcount(E) }).then((ok) => ok && toast(`Saved: ${hk(+fd("total") / headcount(E))} each for ${headcount(E)} people`));
    }
  });

  render();
  if (pass) unlock(pass, true);
})();
