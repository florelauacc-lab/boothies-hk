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
  const hkToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
  const dayPick = (sel) => { const t = sel || hkToday(); return DAYS.some(([iso]) => iso === t) ? t : (DAYS.find(([iso]) => iso >= t) || DAYS[0] || [""])[0]; };
  const dayOpts = (sel) => { const pick = dayPick(sel); return DAYS.map(([iso, l]) => `<option value="${iso}"${iso === pick ? " selected" : ""}${!sel && iso < hkToday() ? " disabled" : ""}>${esc(l)}${iso === hkToday() ? " (today)" : ""}</option>`).join(""); };
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
  const evPayer = (e) => e.paidBy || data.payTo;
  // what I owe for an event, and to whom: the set price to whoever paid it, or my share of each bill to its payer
  const billCost = (e) => {
    const owe = {}; let paid = 0;
    if (e.price > 0) { if (me && e.going.includes(me) && evPayer(e) !== me) owe[evPayer(e)] = +e.price; if (evPayer(e) === me) paid += e.price * e.going.filter((n) => n !== me).length; }
    const bs = (data.bills || []).filter((b) => b.ev === e.id);
    bs.forEach((b) => { if (!me) return; const sh = billShares(b);
      if (!isPayer(b, me)) { payersOf(b).forEach(([p]) => { const v = owesOn(b, me, p); if (v > 0) owe[p] = (owe[p] || 0) + v; }); return; }
      const mine = payersOf(b).filter(([p]) => p === me).reduce((t, [, v]) => t + v, 0), net = mine - (sh[me] || 0);
      if (net > 0) paid += net; else payersOf(b).forEach(([p]) => { const v = p === me ? 0 : owesOn(b, me, p); if (v > 0) owe[p] = (owe[p] || 0) + v; }); });
    const parts = Object.entries(owe).filter(([, v]) => v >= 1).map(([n, v]) => `you owe ${esc(n)}&nbsp;${hk(v)}`);
    if (paid >= 1) parts.push(`you're owed&nbsp;${hk(paid)}`);
    if (parts.length) return parts.join(" · ");
    if (bs.length) return `bill added · ${hk(bs.reduce((t, b) => t + b.hkd, 0))}`;
    return "";
  }; // who paid a set-price event and collects the price
  const each = (e) => (e.price > 0 ? +e.price : total(e) && e.going.length ? total(e) / e.going.length : null);
  const PAY_METHODS = ["PayPal / card", "Venmo", "Wise / bank", "FPS", "WeChat Pay", "Cash"];

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
      if (e.price > 0) b[evPayer(e)] = (b[evPayer(e)] || 0) + s * e.going.length; // fixed price: everyone pays whoever paid it
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
  let ccJumped = false;
  function render() {
    if (!ccJumped && location.hash === "#cc") { ccJumped = true; setTimeout(() => root.scrollIntoView({ block: "start" }), 80); } // the link in "Ask on WhatsApp" lands here
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
    const dKey = (el) => el.dataset.ev || `${el.className}|${(el.querySelector("summary")?.textContent || "").replace(/[\d·✓,]/g, "").trim().slice(0, 40)}`;
    const wasOpen = new Map([...root.querySelectorAll("details")].map((el) => [dKey(el), el.open]));
    root.innerHTML = `<div class="cc-head">
        <h2>👥 Class corner</h2>
        <span class="cc-mode ${mode}">${live() ? "● Shared with the class" : "Read-only (offline)"}</span>
        <button class="cc-lockbtn" id="cc-relock" type="button">Lock 🔒</button>
      </div>
      <div class="cc-me">
        <label>I'm <select id="cc-me" aria-label="Your name"><option value="">choose your name</option>${opts}</select></label>
        <label>Prices in <select id="cc-cur" aria-label="Currency">${curOpts}</select></label>
      </div>
      ${live() ? quickHelp() : ""}
      ${live() && !billDraft ? `<button type="button" class="cc-add-bill quick" data-bf-new="1">🍜 Ate out together? Add the bill <small>everyone's share is worked out</small></button>` : ""}
      ${settleBox()}
      <h3 class="cc-h">🎉 Class events <small>tap one to tick who's going or enter the bill</small></h3>
      <div class="cc-events">${evs.map((e) => evCard(e, ppl)).join("")}</div>
      ${live() ? `<details class="cc-add"><summary>➕ Add an event for the class</summary>
        <form id="cc-newev" class="cc-evform">
          <label class="bf-f"><span>What is it?</span><input name="title" placeholder="e.g. Dragon's Back hike, drinks in Soho" required maxlength="70"></label>
          <div class="ev2"><label class="bf-f"><span>Day</span><select name="iso">${dayOpts()}</select></label>
            <label class="bf-f"><span>Time</span><input name="when" placeholder="e.g. 19:00" maxlength="40"></label></div>
          <label class="bf-f"><span>What kind? <small>(suggests places below)</small></span><select name="kind" data-evkind="1">${[["hikes", "🌿 Hike or beach"], ["sights", "📸 Sight or outing"], ["city", "🍽️ Food & drink"], ["shop", "🛍️ Shopping"], ["", "Other"]].map(([k, l]) => `<option value="${k}"${(newEvKind ?? "hikes") === k ? " selected" : ""}>${l}</option>`).join("")}</select>
          </label>
          <label class="bf-f"><span>Where? <small>(pick from the guide or type a place)</small></span><input name="venue" placeholder="Start typing a place" maxlength="80" list="cc-places-${newEvKind ?? "hikes"}"></label>
          ${[["hikes", ["hikes"]], ["sights", ["sights"]], ["city", ["city", "saiwan"]], ["shop", ["shop"]]].map(([k, tabs]) => `<datalist id="cc-places-${k}">${PLACES.filter((p) => tabs.includes(p.tab)).map((p) => `<option value="${esc(p.name)}">`).join("")}</datalist>`).join("")}
          <p class="small muted">Everyone with the passcode sees it and can tick that they're going. You're ticked as going.</p>
          <button type="submit" class="paybtn">Add event</button>
        </form></details>` : ""}
      ${live() ? guestBook() : ""}
      ${billsSection()}
      ${everyoneBalances()}
      ${live() ? nameFixer() : ""}
      ${overview(evs)}
      <details class="cc-groups"><summary>📚 Becker study groups</summary>
        <div class="cc-grid">${(data.groups || []).map(([g, ns]) => `<div><h4>${esc(g)}</h4><ul>${ns.filter((n) => !/\*$/.test(n)).map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>`).join("")}</div>
      </details>`;
    root.querySelectorAll("details").forEach((el) => { const k = dKey(el); if (wasOpen.has(k) && !el.dataset.ev) el.open = wasOpen.get(k); }); // a redraw (every 30 s) keeps what you opened
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
  // named guests (not in Becker) are part of the guest count; the rest are +1s not named yet
  const gList = (e) => e.guestList || [], gUnnamed = (e) => Math.max(0, unnamed(e) - gList(e).length);
  const gWho = (g) => `${esc(g.name)}${g.of ? ` <small>${esc(g.of)}'s guest</small>` : ""}`;
  const evGuests = (E) => [...gList(E).map((g) => g.name), ...blanks(gUnnamed(E))]; // a bill from an event starts with its guests
  function guestBook() { // everyone coming who isn't in Becker, to check against
    const evs = data.events.filter((e) => unnamed(e)); if (!evs.length) return "";
    const n = evs.reduce((t, e) => t + gList(e).length, 0), u = evs.reduce((t, e) => t + gUnnamed(e), 0);
    return `<details class="cc-sub cc-gbook"><summary>👤 Guest list <small>not in Becker · ${n} named${u ? `, ${u} not named yet` : ""}</small></summary>
      <p class="muted small gb-intro">Everyone coming who isn't in Becker, by event, and whose guest they are. Use it to check names at the door or on a bill. Add or name guests in each event under 👤&nbsp;Guests.</p>
      ${evs.map((e) => `<div class="gb-ev"><p class="gb-h"><b>${esc(e.title)}</b> <small>${esc([DAYS.find(([iso]) => iso === e.iso)?.[1], e.when].filter(Boolean).join(", "))}</small></p>
        <ul class="cc-glist">${gList(e).map((g) => `<li><span>${gWho(g)}</span></li>`).join("")}${gUnnamed(e) ? `<li class="muted"><span>+${gUnnamed(e)} not named yet</span></li>` : ""}</ul></div>`).join("")}
    </details>`;
  }
  const headcount = (e) => e.going.length + unnamed(e);
  // capped events (e.g. the tram holds 30): once full, new people go on a waitlist in sign-up order
  const capOf = (e) => +e.cap || 0, wait = (e) => e.waitlist || [];
  const isFull = (e) => capOf(e) > 0 && headcount(e) >= capOf(e);
  const spots = (e) => Math.max(0, capOf(e) - headcount(e));
  const over = (e) => (capOf(e) ? Math.max(0, headcount(e) - capOf(e)) : 0); // signed up beyond the places, nobody picked
  const payCount = (e) => (capOf(e) ? Math.min(headcount(e), capOf(e)) : headcount(e)); // the price is split by who actually goes
  function waitBlock(e) {
    const c = capOf(e), wl = wait(e), pos = me ? wl.indexOf(me) + 1 : 0;
    if (!c && !wl.length) return "";
    return `<div class="cc-wait"><p class="cw-cap">🎟️ <b>${c} places</b> · ${over(e) ? `${headcount(e)} signed up` : isFull(e) ? "full" : `${spots(e)} left`}${wl.length ? ` · ${wl.length} on the waitlist` : ""}</p>
      ${over(e) ? `<p class="cw-over">⚠️ <b>${headcount(e)} signed up for ${c} places, so ${over(e)} ${over(e) === 1 ? "person needs" : "people need"} to move to the waitlist.</b> Nobody has been picked. If you can step back, tap "✓ I'm going" to undo and you'll be offered the waitlist instead.${e.price > 0 ? ` The price (${hk(e.price)} each) is for the ${c} who go.` : ""}</p>` : ""}
      ${pos ? `<p class="cw-you">⏳ You're <b>#${pos}</b> on the waitlist. This one holds ${c}, so the first ${c} to say yes have a place. We'll message you if one opens up.</p>` : ""}
      ${wl.length ? `<h4>Waitlist <small>in sign-up order</small></h4><ol class="cw-list">${wl.map((n, i) => `<li><span class="${n === me ? "me" : ""}">${esc(n)}</span>${live() ? `${spots(e) && i < spots(e) ? `<button type="button" class="cc-mini go" data-promote="${e.id}" data-name="${esc(n)}">Give them a place</button>` : ""}<button type="button" class="cc-x" data-unwait="${e.id}" data-name="${esc(n)}" aria-label="Take ${esc(n)} off the waitlist">✕</button>` : ""}</li>`).join("")}</ol>
        <p class="muted small">If someone drops out, an organiser gives their place to the next person on the waitlist and lets them know.</p>` : ""}
    </div>`;
  }
  // organisers: a fresh start for a capped event (e.g. the tram): clear everyone, pause, then open sign-ups at the announcement
  function resetBlock(e) {
    const r = e.reset, opened = e.openedAt && new Date(e.openedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Hong_Kong" });
    if (e.closed) return `<div class="cc-reset paused"><p class="small"><b>Organisers:</b> ${r ? `reset by ${esc(r.by || "an organiser")}. ${r.going.length} ${r.going.length === 1 ? "person was" : "people were"} going${r.waitlist.length ? `, ${r.waitlist.length} on the waitlist` : ""}${r.guests ? `, ${gS(r.guests)}` : ""}.` : "sign-ups are paused."}</p>
      <button type="button" class="cc-mini go cc-open" data-opensign="${e.id}">🟢 Open sign-ups now</button>
      ${r ? `<button type="button" class="cc-mini" data-undoreset="${e.id}">↩ Undo the reset</button>` : ""}</div>`;
    return `<div class="cc-reset">${opened ? `<p class="small muted">Sign-ups opened at ${opened}.</p>` : ""}
      <button type="button" class="cc-mini cc-resetbtn${resetArm === e.id ? " armed" : ""}" data-resetgo="${e.id}">${resetArm === e.id ? `Tap again to clear ${headcount(e) === 1 ? "1 person" : `all ${headcount(e)} people`} and pause` : "🔄 Reset sign-ups (organisers)"}</button>
      ${resetArm === e.id ? `<p class="small muted">Everyone, the waitlist and guests are cleared, and sign-ups pause until you tap <b>Open sign-ups now</b>. A copy is kept, so you can undo until then.</p>` : ""}</div>`;
  }
  let resetArm = null, resetTimer = null;
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
        ${live() ? `<details class="tb-edit"><summary>✏️ Change time or seats</summary><form class="cc-evform tbform" data-edittable="${e.id}|${t.id}"><div class="ev2"><label class="bf-f"><span>Booking time</span><input name="time" value="${esc(t.time || "")}" placeholder="e.g. 20:00" maxlength="20"></label><label class="bf-f"><span>Seats</span><input name="size" type="number" inputmode="numeric" min="1" max="40" value="${t.size || ""}" required></label></div><button type="submit" class="cc-mini">Save</button></form></details>` : ""}</li>`).join("")}</ul>
        <p class="small">Arrive from ${esc(tables[0].time || "the first booking")} and you'll be seated as tables free up. After dinner, each table splits its own bill.</p>` : `<p class="muted small">No bookings yet.</p>`}
      ${live() ? `<form class="cc-evform tbform" data-addtable="${e.id}"><div class="ev2"><label class="bf-f"><span>Booking time</span><input name="time" placeholder="e.g. 20:45" maxlength="20" required></label><label class="bf-f"><span>Seats</span><input name="size" type="number" inputmode="numeric" min="1" max="40" placeholder="e.g. 8" required></label></div><button type="submit" class="cc-mini">＋ Add a booking</button></form>` : ""}
    </div>`;
  }
  let seatEditing = null;

  function evCard(e, ppl) {
    const p = each(e), inIt = e.going.includes(me), ed = editing === e.id;
    const day = DAYS.find(([iso]) => iso === e.iso)?.[1];
    return `<details class="cc-ev${inIt ? " mine" : ""}" id="ev-${e.id}" data-ev="${e.id}"${openEv.has(e.id) || ed ? " open" : ""}>
      <summary><span class="t"><b>${esc(e.title)}</b><small>${esc([day, e.when].filter(Boolean).join(", "))}${e.venue ? ` · ${esc(e.venue)}` : ""}</small></span>
      <span class="n">${e.going.length}${unnamed(e) ? ` +${unnamed(e)}` : ""}${capOf(e) && !over(e) ? ` of ${capOf(e)}` : ""} going${over(e) ? ` · ${over(e)} over` : ""}${e.closed ? " · ⏸️ paused" : inIt ? " · ✓ you" : wait(e).includes(me) ? " · ⏳ waitlist" : ""}<br><em>${billCost(e) || (p ? `${hk(p)} each ≈ ${fx(p)}` : "price to come")}</em></span></summary>
      ${placesFor(e.venue).map((pl) => `<button type="button" class="cc-venue" data-jump="${pl.id}">📍 ${esc(pl.name)} · map &amp; taxi card →</button>`).join("")}
      ${e.note ? `<p class="cc-note">ℹ️ ${esc(e.note)}</p>` : ""}
      ${e.group ? `<p class="cc-either">Pick one: ${data.events.filter((x) => x.group === e.group && x.id !== e.id).map((x) => esc(x.title)).join(" or ")} is the other option. Going to this one takes you off the other.</p>` : ""}
      ${e.closed ? `<p class="cw-paused">⏸️ <b>Sign-ups are paused for a fresh start.</b> They open after the announcement in person, then the first ${capOf(e) || "people"} to tap <b>+&nbsp;I'm&nbsp;going</b> get a place${capOf(e) ? " and everyone after goes on the waitlist in order" : ""}.</p>` : ""}
      ${me && live() && !e.closed ? (inIt || !(isFull(e) || wait(e).includes(me))
        ? `<button type="button" class="cc-imin${inIt ? " on" : ""}" data-tick="${e.id}" data-name="${esc(me)}" data-on="${inIt ? 0 : 1}">${inIt ? "✓ I'm going · tap to undo" : "+ I'm going"}</button>`
        : wait(e).includes(me)
          ? `<button type="button" class="cc-imin wl" data-wait="${e.id}" data-on="0">⏳ On the waitlist · tap to leave</button>`
          : `<button type="button" class="cc-imin wl" data-wait="${e.id}" data-on="1">It's full · join the waitlist</button>`) : ""}
      ${ed
        ? `<p class="cc-hint">Tap names to tick or untick · ${e.going.length} going</p>
          <input class="name-find" data-find="ev" placeholder="Type a name to find them (Enter to tick)" autocomplete="off" aria-label="Find a name">
          <div class="cc-names edit">${ppl.map((x) => `<button type="button" data-nm="${esc(`${x.name} ${(data.aka || {})[x.name] || ""}`.trim().toLowerCase())}" class="${e.going.includes(x.name) ? "on" : ""}${x.away ? " away" : ""}" data-tick="${e.id}" data-name="${esc(x.name)}" data-on="${e.going.includes(x.name) ? 0 : 1}">${e.going.includes(x.name) ? "✓ " : ""}${esc(x.name)}</button>`).join("")}</div>
          <p class="cc-hint">Someone not on the class list, like a classmate from another section? Add them under 👤 Guests below: they share the cost and pay directly.</p>
          <button type="button" class="cc-done" data-edit="">Done</button>`
        : `<div class="cc-names">${e.going.map((n) => `<span class="${n === me ? "me" : ""}">${esc(n)}</span>`).join("") || `<em class="muted">Nobody yet</em>`}</div>
          ${live() ? `<button type="button" class="cc-editbtn" data-edit="${e.id}">✏️ Tick who's going</button>` : ""}`}
      ${live() || unnamed(e) ? `<div class="cc-guests"><span>👤 Guests <small>Not in Becker (a partner, a friend, someone from another section), named or not</small></span>
        ${live() ? `<span class="gq"><button type="button" data-guests="${e.id}|-1" aria-label="One fewer guest not named yet"${gUnnamed(e) ? "" : " disabled"}>−</button><b>${unnamed(e)}</b><button type="button" data-guests="${e.id}|1" aria-label="One more guest">+</button></span>` : `<b>${unnamed(e)}</b>`}</div>
        ${unnamed(e) ? `<ul class="cc-glist">${gList(e).map((g) => `<li><span>${gWho(g)}</span>${live() ? `<button type="button" class="cc-x" data-gdel="${e.id}" data-name="${esc(g.name)}" aria-label="Take ${esc(g.name)} off the guest list">✕</button>` : ""}</li>`).join("")}${gUnnamed(e) ? `<li class="muted"><span>+${gUnnamed(e)} not named yet</span></li>` : ""}</ul>` : ""}
        ${live() && me ? `<form class="cc-gadd" data-gadd="${e.id}"><label class="bf-f"><span>Guest's name</span><input name="gname" maxlength="40" placeholder="e.g. Alex Chan" autocomplete="off" autocapitalize="words" required></label>
          <label class="bf-f"><span>Whose guest?</span><input name="gof" list="cc-gof-${e.id}" value="${esc(me)}" placeholder="Type a name" autocomplete="off" autocapitalize="words"></label><datalist id="cc-gof-${e.id}">${people().map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
          <button type="submit" class="cc-mini go">${gUnnamed(e) ? "Name a guest" : "+&nbsp;Add a named guest"}</button>
          ${gUnnamed(e) ? `<p class="muted small">This names one of the +${gUnnamed(e)} already counted. For an extra guest, tap + first.</p>` : ""}</form>` : ""}
        ${unnamed(e) ? `<p class="muted small cc-gnote">Counted for seats and the cost split, so everyone pays a bit less. Guests pay their share to ${esc(data.payTo || "the organiser")} directly. If it turns out they're on the class list, tick their name and tap −.</p>` : ""}` : ""}
      ${waitBlock(e)}
      ${capOf(e) && live() ? resetBlock(e) : ""}
      ${tablesBlock(e)}
      <div class="cc-bills">
        <h4>Cost</h4>
        ${p ? `<p class="cc-price"><b>${hk(p)}</b> each <span>≈ ${["USD", "GBP", "EUR", "JPY"].map((c) => fx(p, c)).join(" · ")}</span></p>
          <p class="muted small">${e.total ? `Total ${hk(e.total)} ÷ ${e.priceCount || Math.round(e.total / p)} people = ${hk(p)} each` : `${hk(p)} per person`}</p>
          ${e.total && e.priceCount && e.priceCount !== payCount(e) && payCount(e) && live()
            ? `<p class="cc-recalc">${over(e) ? `Split for the ${capOf(e)} places.` : `Now ${goingTxt(e)}.`} <button type="button" class="cc-mini go" data-recalc="${e.id}">Recalculate: ${hk(e.total / payCount(e))} each</button></p>` : ""}
          ${e.total ? `<p class="muted small">The price follows the final headcount: if more people join, tap Recalculate.</p>` : ""}
          <p class="small">💳 Paid by <b>${esc(evPayer(e))}</b>: everyone going pays them ${hk(p)}.</p>
          ${unnamed(e) ? `<p class="cc-gpay">👤 Includes ${gS(unnamed(e))}: ${unnamed(e) === 1 ? "they pay" : "each pays"} ${hk(p)} to ${esc(evPayer(e) || "the organiser")} directly.</p>` : ""}
          ${(() => { const xb = (data.bills || []).filter((b) => b.ev === e.id);
            return `${xb.length ? `<p class="small"><b>Other costs</b></p><ul class="ev-bills">${xb.map((b) => `<li><span>🧾 ${esc(b.what)} · paid by ${esc(paidList(b))} · ${b.among.length} people${bG(b) ? ` + ${gS(bG(b))}` : ""}</span><b>${hk(b.hkd)}</b>${live() ? `<button type="button" class="cc-mini" data-bedit="${b.id}">✏️ Edit</button>` : ""}</li>`).join("")}</ul>` : ""}
            ${live() ? `<button type="button" class="cc-mini" data-splitev="${e.id}">🧾 Add another cost someone else paid (e.g. drinks)</button>` : ""}`; })()}`
          : (() => { // no set price: split the bill(s) between whoever was there, whoever paid
              const evBills = (data.bills || []).filter((b) => b.ev === e.id);
              return `${evBills.length ? `<ul class="ev-bills">${evBills.map((b) => `<li><span>🧾 ${esc(b.what)} · paid by ${esc(paidList(b))} · ${b.among.length} people${bG(b) ? ` + ${gS(bG(b))}` : ""}</span><b>${hk(b.hkd)}</b>${live() ? `<button type="button" class="cc-mini" data-bedit="${b.id}">✏️ Edit</button>` : ""}</li>`).join("")}</ul>` : ""}
                ${live() ? `<p class="muted small">One bill per table if tables ate different things; each is split only between the people at that table.</p>
                <button type="button" class="cc-mini go" data-splitev="${e.id}">🧾 ${evBills.length ? "Add another table's bill" : "Add the bill (or the first table's)"}</button>
                <details class="cc-collect"><summary>${esc(data.payTo)} collecting a set price instead?</summary>` : ""}`;
            })()}
        ${e.expenses.length ? `<ul>${e.expenses.map((x) => `<li><span>${esc(x.what)} · paid by ${esc(x.paidBy)}</span><b>${hk(+x.hkd)}</b>${live() ? `<button type="button" class="cc-x" data-delexp="${e.id}" data-xid="${x.id}" aria-label="Remove bill">✕</button>` : ""}</li>`).join("")}</ul>` : ""}
        ${live() ? `<form class="cc-evform setprice" data-setprice="${e.id}">
          <div class="ev2"><label class="bf-f"><span>Total bill HK$</span><input name="total" type="number" inputmode="numeric" min="0" step="1" value="${e.total || ""}" placeholder="e.g. 4200" required></label>
            <label class="bf-f"><span>Who paid it? <small>(type a name)</small></span><input name="paidBy" list="sp-people-${e.id}" value="${esc(e.paidBy || (e.price ? evPayer(e) : ""))}" placeholder="Type a name" autocomplete="off" autocapitalize="words" required>${peopleList(`sp-people-${e.id}`)}</label></div>
          <p class="muted small">Split between ${payCount(e)} ${payCount(e) === 1 ? "person" : "people"}${capOf(e) ? ` (the ${capOf(e)} places)` : ""}. Everyone pays whoever paid.</p>
          <button type="submit" class="cc-mini go">${e.total || e.price ? "Update total" : "Set total"}</button></form>${p ? "" : "</details>"}` : ""}
      </div>
      ${live() ? `<details class="cc-editev"><summary>✏️ Change name, time or place</summary>
        <form class="cc-evform" data-editev="${e.id}">
          <label class="bf-f"><span>Event name</span><input name="title" value="${esc(e.title)}" maxlength="70" required></label>
          <div class="ev2">${e.id.startsWith("x-") && e.iso ? `<label class="bf-f"><span>Day</span><select name="iso">${dayOpts(e.iso)}</select></label>` : ""}
            <label class="bf-f"><span>Time</span><input name="when" value="${esc(e.when || "")}" placeholder="e.g. 08:15" maxlength="50"></label></div>
          <label class="bf-f"><span>Where?</span><input name="venue" value="${esc(e.venue || "")}" placeholder="Start typing a place" maxlength="80" list="cc-places-city"></label>
          <button type="submit" class="paybtn">Save changes</button></form>
        <form class="cc-evform cc-capform" data-setcap="${e.id}">
          <label class="bf-f"><span>Places <small>(organisers; leave empty for no limit)</small></span><input name="cap" type="number" inputmode="numeric" min="0" max="500" value="${capOf(e) || ""}" placeholder="No limit"></label>
          <p class="small muted">Once it's full, anyone else who says yes goes on the waitlist.</p>
          <button type="submit" class="cc-mini">Set places</button></form></details>
        <button type="button" class="cc-del" data-delev="${e.id}">🗑 Remove this event${orgEvent(e) ? " (organisers)" : ""}</button>` : ""}
    </details>`;
  }


  // bank details one line at a time, each with its own Copy (that's how bank apps ask for them)
  function bankLines(o) {
    const lines = [["Account name", o.accName], ["Bank", o.bankName], ["Country & currency", o.bankCountry], ["Account number / IBAN", o.accNo], ["SWIFT / BIC (from abroad)", o.swift],
      ["Routing / sort / bank & branch code", o.localCode], ["Other details", o.bankExtra]].filter(([, v]) => v);
    if (!lines.length && o.bank) lines.push(["Bank details", o.bank]);
    const all = lines.map(([k, v]) => `${k}: ${v}`).join("\n");
    return lines.length ? `<div class="bank-lines">${lines.map(([k, v]) => `<button type="button" class="bl" data-copy="${esc(v)}"><span><small>${k}</small>${esc(v)}</span><span class="pw-copy">Copy</span></button>`).join("")}
      ${lines.length > 1 ? `<button type="button" class="pw-copy all" data-copy="${esc(all)}">📋 Copy all bank details</button>` : ""}</div>` : "";
  }

  // Every way to pay, with the actual details, so settling up is one look and one tap
  function payWays(amt) {
    const L = profileOf(data.payTo);
    const a = Math.round(amt);
    const soon = `<span class="pw-soon">coming soon</span>`;
    const copy = (v) => `<button type="button" class="pw-copy" data-copy="${esc(v)}">Copy</button>`;
    return `<div class="payways">
      ${L.paypal ? `<a class="paybtn big" href="${esc(L.paypal.replace(/\/$/, ""))}${a ? `/${a}HKD` : ""}" target="_blank" rel="noopener">💳 Pay ${a ? `${hk(a)} ` : ""}with PayPal or card</a>`
        : `<div class="pw"><span class="pw-i">💳</span><div><b>PayPal or card</b><small>Works from any country. A card fee of about 3–5% applies.</small></div>${soon}</div>`}
      ${L.venmo ? (() => { const u = String(L.venmo).replace(/^@/, ""); return `<a class="paybtn big" href="https://venmo.com/u/${encodeURIComponent(u)}" target="_blank" rel="noopener">💙 Pay @${esc(u)} on Venmo${a ? ` (≈ US$${(a * rates.USD).toFixed(2)})` : ""}</a>`; })() : ""}
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
  const defaultPayer = () => me || ""; // whoever adds the bill usually paid it; type another name if not
  const findPerson = (v) => { const q = String(v || "").trim().toLowerCase(); if (!q) return ""; const ppl = people();
    const hit = ppl.find((n) => n.toLowerCase() === q) || (() => { const a = ppl.filter((n) => n.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || n.toLowerCase().startsWith(q)); return a.length === 1 ? a[0] : ""; })()
      || (() => { const a = ppl.filter((n) => n.toLowerCase().includes(q)); return a.length === 1 ? a[0] : ""; })();
    return hit || ""; };
  const peopleList = (id) => `<datalist id="${id}">${people().map((n) => `<option value="${esc(n)}">`).join("")}</datalist>`;
  const newDraft = () => ({ id: null, what: "", ev: "", hkd: "", paidBy: me || "", among: new Set(me ? [me] : []), mode: "equal", shares: {}, q: "", guests: [], gShares: [], gPay: [], cover: [], also: [], full: false });
  const blanks = (n) => Array.from({ length: n }, () => "");
  let billSaving = false; // stops a second tap adding the same bill twice
  const bG = (b) => +b.guests || 0; // guests at the table (not on the class list) pay the payer directly
  const gAmt = (b, i) => (b.shares ? +(b.guestShares || [])[i] || 0 : b.hkd / (b.among.length + bG(b))); // one guest's share
  // what each classmate owes the payer; a guest a classmate covers (e.g. a partner) is added to that classmate's share
  const billShares = (b) => {
    const base = { ...(b.shares || Object.fromEntries(b.among.map((n) => [n, b.hkd / (b.among.length + bG(b))]))) };
    Object.entries(b.cover || {}).forEach(([f, by]) => { if (base[f] != null && f !== by) { base[by] = (base[by] || 0) + base[f]; delete base[f]; } });
    (b.guestPay || []).forEach((c, i) => { if (c && c !== "paid" && i < bG(b)) base[c] = (base[c] || 0) + gAmt(b, i); });
    return base;
  };
  const named = (b) => Object.values(billShares(b)).reduce((t, v) => t + v, 0); // what the people on the list owe
  // a bill paid with more than one card: alsoPaid { name: amount }, and paidBy paid the rest (and collects from guests who pay directly)
  const alsoSum = (b) => Object.values(b.alsoPaid || {}).reduce((t, v) => t + (+v || 0), 0);
  const paidAt = (b) => [[b.paidBy, b.hkd - alsoSum(b)], ...Object.entries(b.alsoPaid || {}).map(([p, v]) => [p, +v || 0])]; // what each paid at the restaurant
  const payersOf = (b) => [[b.paidBy, named(b) - alsoSum(b)], ...Object.entries(b.alsoPaid || {}).map(([p, v]) => [p, +v || 0])]; // what each is owed back by the classmates
  const isPayer = (b, n) => !!n && (b.paidBy === n || (b.alsoPaid || {})[n] != null);
  const andList = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}` : a[0] || "");
  const paidList = (b) => andList(paidAt(b).map(([p]) => p));
  // what person n owes payer p on a bill (shares are paid back in proportion to what each payer put in)
  const owesOn = (b, n, p) => { const N = named(b); if (!N) return 0; const sh = billShares(b), c = (x) => payersOf(b).filter(([q]) => q === x).reduce((t, [, v]) => t + v, 0); return ((sh[n] || 0) * c(p) - (sh[p] || 0) * c(n)) / N; };
  function billBalances() { // + means you're owed, - means you owe
    const bal = {};
    (data.bills || []).forEach((b) => {
      payersOf(b).forEach(([p, c]) => { bal[p] = (bal[p] || 0) + c; });
      Object.entries(billShares(b)).forEach(([n, v]) => { bal[n] = (bal[n] || 0) - v; });
    });
    (data.xfers || []).filter((x) => !x.direct && x.confirmed).forEach((x) => { bal[x.from] = (bal[x.from] || 0) + x.hkd; bal[x.to] = (bal[x.to] || 0) - x.hkd; });
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
    (data.bills || []).filter((b) => b.frontedBy).forEach((b) => { const k = `${b.paidBy}|${b.frontedBy}`; (m[k] = m[k] || { from: b.paidBy, to: b.frontedBy, hkd: 0, what: [] }).hkd += b.hkd - alsoSum(b); m[k].what.push(b.what); });
    (data.xfers || []).filter((x) => x.direct && x.confirmed).forEach((x) => { const k = `${x.from}|${x.to}`; if (m[k]) m[k].hkd -= x.hkd; });
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
      pr.venmo && ["Venmo", (() => { const u = String(pr.venmo).replace(/^@/, ""), usd = amt ? (amt * rates.USD).toFixed(2) : "";
        return `<div class="paybtns"><a class="paybtn" href="https://venmo.com/u/${encodeURIComponent(u)}" target="_blank" rel="noopener">💙 Pay @${esc(u)} on Venmo</a></div>${usd ? `<div class="bank-lines"><button type="button" class="bl" data-copy="${usd}"><span><small>Amount to send in US$ (${hk(amt)} today)</small>US$${usd}</span><span class="pw-copy">Copy</span></button></div>` : ""}<small class="pm-hint">US bank accounts only, in US dollars. Opens Venmo; type in the amount.</small>`; })()],
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
  const askDetails = (to, amt) => `https://wa.me/?text=${encodeURIComponent(`Hi ${to}, I owe you ${hk(amt)} on Boothies in HK, but I can't see your payment details. Could you add them under 💳 My payment details (https://boothies-hk.vercel.app/#cc), or send me your PayPal, FPS or WeChat ID? Thanks!`)}`;
  // paying one person: pick how, see just that method's details, then "I've paid" (asks again before it's recorded)
  function payForm(t) {
    const o = payOpts(t.to, t.hkd), note = profileOf(t.to).note;
    if (!o.length) return `<div class="pm-none"><p class="small">⚠️ <b>${esc(t.to)} hasn't added payment details yet</b>, so there's nothing to pay to here. Ask them for their details first.</p>
      <a class="cc-mini go" href="${askDetails(t.to, t.hkd)}" target="_blank" rel="noopener">📲 Ask ${esc(t.to)} for their details</a>
      ${note ? `<p class="muted small">${esc(note)}</p>` : ""}
      <details class="pm-other"><summary>Already paid ${esc(t.to)} another way, like cash?</summary>
        <form class="cc-inline paid pm-form" data-xfer="${esc(JSON.stringify(t))}">
          <label class="pm-pick"><span>How did you pay?</span><select name="method">${PAY_METHODS.map((m) => `<option>${m}</option>`).join("")}</select></label>
          <button type="submit">✓ I've paid ${esc(t.to)}</button></form></details></div>`;
    const methods = [...o.map(([m]) => m), "Cash"];
    const pick = methods.includes(pmChoice[t.to]) ? pmChoice[t.to] : methods[0]; // keep the method you chose across redraws
    return `<form class="cc-inline paid pm-form" data-xfer="${esc(JSON.stringify(t))}">
      <label class="pm-pick"><span>How are you paying ${esc(t.to)}?</span><select name="method" data-pmsel="${esc(t.to)}">${methods.map((m) => `<option${m === pick ? " selected" : ""}>${m}</option>`).join("")}</select></label>
      ${o.map(([m, h]) => `<div class="pm-pane" data-pm="${esc(m)}"${m === pick ? "" : " hidden"}>${h}</div>`).join("")}
      <div class="pm-pane" data-pm="Cash"${pick === "Cash" ? "" : " hidden"}><small class="pm-hint">Hand it to ${esc(t.to)} in person, then tap I've paid.</small></div>
      ${note ? `<p class="muted small">${esc(note)}</p>` : ""}
      <button type="submit">✓ I've paid ${esc(t.to)}</button></form>`;
  }

  /* ---------- one combined balance: set-price events (Rienno paid), every bill, every payment ---------- */
  // a payment someone has marked counts only once the person being paid confirms it arrived
  const pendXf = (from, to, direct) => (data.xfers || []).filter((x) => !x.confirmed && x.from === from && x.to === to && !x.direct === !direct);
  const pSum = (a) => a.reduce((t, x) => t + x.hkd, 0);
  const whenHK = (ms) => (ms ? new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Hong_Kong" }) : "");
  let shownPend = new Set();
  const pendLine = (x) => { const toMe = x.to === me, who = x.by && x.by !== x.from ? (x.by === me ? "You" : esc(x.by)) : null;
    return `<div class="sp-pend"><p class="small">⏳ ${toMe ? (who ? `${who} marked that <b>${esc(x.from)}</b> paid you` : `<b>${esc(x.from)}</b> says they paid you`) : who ? `${who} marked that you paid` : "You marked"} <b>${hk(x.hkd)}</b>${!toMe && !who ? " as paid" : ""}${x.method ? ` by ${esc(x.method)}` : ""}${x.at ? ` on ${whenHK(x.at)}` : ""}. ${toMe ? "It doesn't count until you say it arrived." : `It counts once ${esc(x.to)} confirms they got it, so don't pay it again.`}</p>
      <div class="sp-act">${toMe ? `<button type="button" class="cc-mini go" data-xconfirm="${x.id}">✓ Yes, it arrived</button><button type="button" class="cc-mini undo" data-xreject="${x.id}">✗ Not received</button>` : `<span class="sp-status wait">⏳ Waiting for ${esc(x.to)}</span><button type="button" class="cc-mini undo" data-xundo="${x.id}">↩ Undo</button>`}</div></div>`; };
  // each payment: who → who and the amount on top; then any "I've paid" waiting to be confirmed, then how to pay (or "Paid me")
  const sRow = (t) => { const pend = t.from === me ? pendXf(me, t.to, t.direct) : t.to === me ? pendXf(t.from, me, t.direct) : [];
    pend.forEach((x) => shownPend.add(x.id));
    const left = Math.round(t.hkd - (t.from === me ? pSum(pend) : 0));
    return `<li class="sp${t.to === me ? " owed" : t.from === me ? " me" : ""}">
      <div class="sp-top"><span class="sp-who">${t.to === me ? `<b>${esc(t.from)}</b> owes you` : t.from === me ? `To <b>${esc(t.to)}</b>` : `<b>${esc(t.from)}</b> → <b>${esc(t.to)}</b>`}${t.direct ? `<small class="sp-for">Paid up front: ${esc(t.note)}</small>` : t.for ? `<small class="sp-for">For ${esc(t.for)}</small>` : ""}</span><span class="amt">${hk(t.hkd)} <small>≈ ${fx(t.hkd)}</small></span></div>
      ${pend.map(pendLine).join("")}
      ${t.from === me ? (left >= 1 ? `${pend.length ? `<p class="small sp-left">Still to pay: <b>${hk(left)}</b></p>` : ""}${payForm({ ...t, hkd: left })}` : "")
        : pend.length ? "" : `<button type="button" class="cc-mini go sp-paid" data-xmark="${esc(JSON.stringify(t))}" aria-label="${esc(t.from)} has paid me">✓ Paid me</button>`}</li>`; };
  const pRow = (x) => `<li class="sp pending">
      <div class="sp-top"><span class="sp-who">${x.to === me ? `From <b>${esc(x.from)}</b>` : `To <b>${esc(x.to)}</b>`}${x.note ? `<small class="sp-for">${esc(x.note)}</small>` : ""}</span><span class="amt">${hk(x.hkd)}</span></div>
      ${pendLine(x)}</li>`;
  // what everyone still owes me, ready to send on WhatsApp (e.g. after a bill went up)
  const remindText = (owed) => `💸 *Still to pay me* (Boothies in HK)\n${owed.map((t) => { const p = pSum(pendXf(t.from, me, t.direct)); return `• ${t.from}: ${hk(t.hkd)}${p ? ` (you've marked ${hk(p)} as paid: I'll check it)` : ""}`; }).join("\n")}\n\nThis is what's left after what you've already paid, so if a bill went up you only pay the difference. These are the "${settleMode === "each" ? "Pay each person" : "Fewest payments"}" amounts in 💸 Settle up. My payment details are in Boothies in HK: pay me, then tap "✓ I've paid" under 💸 Settle up: https://boothies-hk.vercel.app/#cc`;

  function allBalances() { // + means you're owed, - means you owe
    const bal = balances(); // set-price events: Rienno paid, everyone ticked owes the set price
    const add = (n, v) => { bal[n] = (bal[n] || 0) + v; };
    Object.entries(data.settle || {}).forEach(([n, v]) => (v.payments || []).filter((p) => p.confirmed).forEach((p) => { add(n, p.hkd); add(data.payTo, -p.hkd); }));
    Object.entries(billBalances()).forEach(([n, v]) => add(n, v)); // bills and payments between people
    return bal;
  }
  // "Pay each person": what I owe each person (and they owe me) for the things we actually shared, without netting through others
  let settleMode = get("hk-settle-v1") === "each" ? "each" : "net";
  function pairRows() {
    const owes = {}, why = {}; // owes[X] > 0: I owe X; < 0: X owes me
    const add = (x, v, what) => { if (!x || x === me || !v) return; owes[x] = (owes[x] || 0) + v; if (what) (why[x] = why[x] || new Set()).add(what); };
    data.events.forEach((e) => {
      const sh = each(e); if (!sh) return;
      const payers = e.price > 0 ? [[evPayer(e), 1]] : (() => { const tot = e.expenses.reduce((t, x) => t + (+x.hkd || 0), 0); return tot ? e.expenses.map((x) => [x.paidBy, (+x.hkd || 0) / tot]) : []; })();
      payers.forEach(([pb, f]) => {
        if (e.going.includes(me)) add(pb, sh * f, e.title);
        if (pb === me) e.going.forEach((n) => add(n, -sh * f, e.title));
      });
    });
    Object.entries(data.settle || {}).forEach(([n, v]) => (v.payments || []).filter((pm) => pm.confirmed).forEach((pm) => { if (n === me) add(data.payTo, -pm.hkd); if (data.payTo === me) add(n, pm.hkd); }));
    (data.bills || []).forEach((b) => { const N = named(b); if (!N) return; const ps = payersOf(b);
      Object.entries(billShares(b)).forEach(([n, v]) => ps.forEach(([p, c]) => {
        if (n === me) add(p, (v * c) / N, b.what);
        if (p === me) add(n, (-v * c) / N, b.what);
      })); });
    (data.xfers || []).filter((x) => !x.direct && x.confirmed).forEach((x) => { if (x.from === me) add(x.to, -x.hkd); if (x.to === me) add(x.from, x.hkd); });
    const rows = Object.entries(owes).filter(([, v]) => Math.abs(v) >= 1).map(([x, v]) => (v > 0 ? { from: me, to: x, hkd: Math.round(v) } : { from: x, to: me, hkd: Math.round(-v) }))
      .map((t) => ({ ...t, for: [...(why[t.from === me ? t.to : t.from] || [])].join(", ") }))
      .sort((a, b) => b.hkd - a.hkd);
    return offsetPairs(rows, directDebts().filter((d) => d.from === me || d.to === me));
  }
  // the top box: what you owe and what you're owed, after netting everything out
  function settleBox() {
    if (!me) return `<div class="cc-owe"><h3 class="cc-h">💸 Settle up</h3><p class="small">Pick your name above to see what you owe and what you're owed.</p></div>`;
    const bal = allBalances(), sugg = simplify(bal);
    const all = settleMode === "each" ? pairRows() : offsetPairs(sugg, directDebts());
    const owe = all.filter((t) => t.from === me), owed = all.filter((t) => t.to === me);
    shownPend = new Set();
    const oweHtml = owe.map(sRow).join(""), owedHtml = owed.map(sRow).join("");
    const pend = (data.xfers || []).filter((x) => !x.confirmed && (x.from === me || x.to === me) && !shownPend.has(x.id));
    const got = (data.xfers || []).filter((x) => x.confirmed && x.to === me).sort((a, b) => (b.at || 0) - (a.at || 0));
    const sum = (a) => a.reduce((t, x) => t + x.hkd, 0);
    const items = [];
    data.events.forEach((e) => { if (e.price > 0 && e.going.includes(me)) items.push([e.title, -e.price, `paid by ${evPayer(e)}`]); if (e.price > 0 && evPayer(e) === me) items.push([`You paid: ${e.title}`, e.price * e.going.filter((n) => n !== me).length + (e.going.includes(me) ? e.price : 0), `${e.going.length} people × ${hk(e.price)}`]); });
    (data.bills || []).forEach((b) => { const sh = billShares(b)[me]; if (sh) items.push([b.what, -sh, `paid by ${paidList(b)}`]); if (b.paidBy === me) items.push([b.frontedBy ? `You collect: ${b.what}` : `You paid: ${b.what}`, named(b) - alsoSum(b), `for ${b.among.length} people${bG(b) ? ` (+ ${gS(bG(b))} who pay you directly)` : ""}${b.alsoPaid ? `, less the ${hk(alsoSum(b))} the others paid` : ""}`]);
      if ((b.alsoPaid || {})[me] != null) items.push([`You paid part of: ${b.what}`, +b.alsoPaid[me], `${hk(+b.alsoPaid[me])} of ${hk(b.hkd)}`]);
      if (b.frontedBy === me) items.push([`You paid the restaurant: ${b.what}`, b.hkd, `${b.paidBy} pays you back`]); if (b.frontedBy && b.paidBy === me) items.push([`${b.frontedBy} paid the restaurant`, -b.hkd, "you pay them back"]); });
    (data.xfers || []).filter((x) => x.confirmed && (x.from === me || x.to === me)).forEach((x) => items.push([x.from === me ? `You paid ${x.to}` : `${x.from} paid you`, x.from === me ? x.hkd : -x.hkd, "✓✓ confirmed"]));
    Object.values(data.settle?.[me]?.payments || []).forEach((p) => items.push([`You paid ${data.payTo}`, p.hkd, p.confirmed ? "✓✓ confirmed" : "⏳ not counted until confirmed"]));
    return `<div class="cc-owe">
      <h3 class="cc-h">💸 Settle up <small>for ${esc(me)} · not you? change "I'm" above</small></h3>
      <div class="sp-mode" role="group" aria-label="How to settle up"><button type="button" class="cc-mini${settleMode === "net" ? " go" : ""}" data-spmode="net" aria-pressed="${settleMode === "net"}">Fewest payments</button><button type="button" class="cc-mini${settleMode === "each" ? " go" : ""}" data-spmode="each" aria-pressed="${settleMode === "each"}">Pay each person</button></div>
      <p class="muted small">${settleMode === "each" ? "You pay back whoever paid for each thing you shared, one person at a time. More payments, but each one matches a meal or event." : "Everything is netted out, so there are as few payments as possible. You may pay someone different from whoever covered your meal. Tap <b>Pay each person</b> to settle with each person instead."} "How it adds up" shows the detail.</p>
      ${(() => { const un = data.events.filter((e) => unnamed(e)); return un.length ? `<p class="muted small cc-gpay">👤 Guests not on the class list: ${un.map((e) => `${esc(colName(e))} (${unnamed(e)}${e.price > 0 ? ` × ${hk(e.price)}` : ""})`).join(", ")}. ${(() => { const by = [...new Set(un.map((e) => evPayer(e)))]; return `They pay ${by.length === 1 ? esc(by[0] || "the organiser") : "whoever paid each event"} directly`; })()}, so they aren't in the balances here.</p>` : ""; })()}
      ${!owe.length && !owed.length ? `<p class="small">✓ You're all square right now.</p>` : ""}
      ${owe.length ? `<p class="sp-h">💸 You owe <b>${hk(sum(owe))}</b> <small>≈ ${fx(sum(owe))}</small></p><ul class="sp-list">${oweHtml}</ul>` : ""}
      ${owed.length ? `<p class="sp-h">💰 Owed to you <b>${hk(sum(owed))}</b></p>${payOpts(me).length ? "" : `<p class="small sp-nodet">⚠️ You haven't added payment details, so people can't see how to pay you. Add them under <b>💳&nbsp;My payment details</b> below.</p>`}<ul class="sp-list">${owedHtml}</ul>
        ${live() ? `<a class="cc-mini go sp-remind" href="https://wa.me/?text=${encodeURIComponent(remindText(owed))}" target="_blank" rel="noopener">📲 Tell everyone what they still owe you</a>` : ""}` : ""}
      ${pend.length ? `<p class="sp-h">⏳ Waiting to be confirmed</p><ul class="sp-list">${pend.map(pRow).join("")}</ul>` : ""}
      ${got.length ? `<details class="cc-sub cc-got"><summary>✓ Payments you've received · ${got.length}</summary><p class="muted small">Tap <b>Not received after all</b> if one hasn't arrived. It goes back to waiting, and they owe it again.</p><ul class="sp-list">${got.map((x) => `<li class="sp"><div class="sp-top"><span class="sp-who"><b>${esc(x.from)}</b>${x.method ? ` <small>· ${esc(x.method)}</small>` : ""}${x.at ? ` <small>· ${whenHK(x.at)}</small>` : ""}</span><span class="amt">${hk(x.hkd)}</span></div>
        <div class="sp-act"><span class="sp-status ok">✓ Received</span><button type="button" class="cc-mini undo" data-xunconf="${x.id}">✗ Not received after all</button></div></li>`).join("")}</ul></details>` : ""}
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


  // the guests on a bill: named if someone typed a name, otherwise "Guest 1", "Guest 2"…
  const gName = (n, i) => (n && n.trim() ? `${n.trim()} (guest)` : `Guest ${i + 1}`);
  const billGuests = (b) => { const n = bG(b); return Array.from({ length: n }, (_, i) => gName((b.guestNames || [])[i], i)); };
  let delArm = null; // the bill whose 🗑 was tapped once: a second tap deletes it (no pop-up, works in in-app browsers)
  // a short guide to everything the class corner does, at the top
  const quickHelp = () => `<details class="cc-sub cc-help"${get("hk-help-v1") === "closed" ? "" : " open"}><summary>❓ How this works <small>money, bills and plans in 1 minute</small></summary>
    <ol class="how-steps">
      <li><b>Pick your name</b> in "I'm" above. Everything here is then about you.</li>
      <li><b>Class events:</b> tap one and tick yourself going. Bringing someone from outside Becker? Add them under <b>👤&nbsp;Guests</b>, with or without a name. <b>⭐&nbsp;My week</b> at the top shows just yours.</li>
      <li><b>Ate out together?</b> Tap <b>🍜&nbsp;Add the bill</b>: the total, who paid, and who shared it. It works out everyone's share, guests too. Paid with 2 cards? Tap <b>💳&nbsp;Add who else paid</b> and everyone pays each of you back.</li>
      <li><b>Ask to be paid:</b> on a bill you paid, tap <b>📲&nbsp;Ask on WhatsApp</b> to send everyone their share.</li>
      <li><b>Pay someone:</b> <b>💸&nbsp;Settle up</b> shows who you owe, with their PayPal, Venmo, FPS or bank. Pay, then tap <b>✓&nbsp;I've paid</b> and confirm. It counts once they say it arrived. No details? Tap <b>📲&nbsp;Ask for their details</b>. Choose <b>Fewest payments</b> or <b>Pay each person</b>.</li>
      <li><b>See who owes you:</b> under <b>Owed to you</b>. When someone says they've paid, check your account, then tap <b>✓&nbsp;Yes, it arrived</b> or <b>✗&nbsp;Not received</b>. You can change your mind later under <b>✓&nbsp;Payments you've received</b>.</li>
      <li><b>Get paid easily:</b> add your details in <b>💳&nbsp;My payment details</b> (how-to guides inside).</li>
      <li><b>Paying for someone else:</b> in a bill, add a guest and pick who pays for them, or tap <b>🤝&nbsp;Someone pays for someone</b> for a classmate.</li>
      <li><b>Your own plans:</b> <b>➕&nbsp;Add an event for the class</b> for a hike, drinks or a meal. Classmates can tick that they're going.</li>
      <li><b>Made a mistake?</b> Every bill has ✏️&nbsp;Edit and 🗑&nbsp;Delete.</li>
    </ol></details>`;
  // a bill you paid → one WhatsApp message with everyone's share
  const askText = (b) => {
    const lines = Object.keys(billShares(b)).filter((n) => n !== me).map((n) => [n, owesOn(b, n, me)]).filter(([, v]) => v > 0.5).map(([n, v]) => `• ${n}: ${hk(v)}`);
    if (me === b.paidBy) billGuests(b).forEach((x, i) => { if (!(b.guestPay || [])[i]) lines.push(`• ${x} (guest): ${hk(gAmt(b, i))}`); });
    const mine = paidAt(b).filter(([p]) => p === me).reduce((t, [, v]) => t + v, 0);
    return `🧾 *${b.what || "Bill"}* · ${hk(b.hkd)}\n${b.alsoPaid ? `I paid ${hk(mine)} of it, so here's what everyone owes me:` : "I paid, so here's what everyone owes me:"}\n${lines.join("\n")}\n\nMy PayPal, Venmo, FPS or bank details are in Boothies in HK. Pay me, then tap "✓ I've paid" under 💸 Settle up: https://boothies-hk.vercel.app/#cc`;
  };
  function billItem(b, evName) {
    const sh = billShares(b), g = bG(b), n = b.among.length + g, ev = b.ev && evName(b.ev);
    const eq = b.shares ? null : b.hkd / (n || 1);
    const gp = (i) => (b.guestPay || [])[i] || "";
    const who = [...b.among.map((x) => `${esc(x)}${b.shares ? ` <b>${hk(b.shares[x] || 0)}</b>` : ""}${(b.cover || {})[x] ? ` <small>(${esc(b.cover[x])} pays)</small>` : ""}`), ...billGuests(b).map((x, i) => `<i>${esc(x)}</i>${b.shares && b.guestShares ? ` <b>${hk(b.guestShares[i] || 0)}</b>` : ""}${gp(i) === "paid" ? " ✓ paid" : gp(i) ? ` <small>(${esc(gp(i))} pays)</small>` : ""}`)];
    const direct = billGuests(b).filter((_, i) => !gp(i)).length;
    return `<li class="bi">
      <div class="bi-top"><b class="bi-what">${esc(b.what)}</b><span class="bi-amt">${hk(b.hkd)}</span></div>
      <p class="bi-meta">${ev && ev !== b.what ? `${esc(ev)} · ` : ""}Paid by ${b.alsoPaid ? paidAt(b).map(([p, v]) => `<b>${esc(p)}</b>&nbsp;${hk(v)}`).join(" + ") : `<b>${esc(b.paidBy)}</b>`}${b.frontedBy ? ` (${esc(b.frontedBy)} paid the restaurant)` : ""}</p>
      <p class="bi-meta">${n} ${n === 1 ? "person" : "people"}${g ? ` (${b.among.length} from the class + ${gS(g)})` : ""} · ${eq ? `<b>${hk(eq)}</b> each` : "custom split"}</p>
      <p class="bi-names">${who.join(", ")}</p>
      ${direct ? `<p class="bi-meta">👤 ${direct === g ? (g === 1 ? "The guest pays" : "Guests pay") : `${direct} guest${direct === 1 ? "" : "s"} pay${direct === 1 ? "s" : ""}`} ${esc(b.paidBy)} directly.</p>` : ""}
      ${b.editedBy ? `<p class="bi-meta muted">Edited by ${esc(b.editedBy)}</p>` : ""}
      <div class="bi-act">${isPayer(b, me) ? `<a class="cc-mini go bi-ask" href="https://wa.me/?text=${encodeURIComponent(askText(b))}" target="_blank" rel="noopener">📲 Ask on WhatsApp</a>` : ""}<button type="button" class="cc-mini" data-bedit="${b.id}">✏️ Edit</button>
        <button type="button" class="cc-mini bi-del${delArm === b.id ? " armed" : ""}" data-bdel="${b.id}">${delArm === b.id ? "Tap again to delete" : "🗑 Delete"}</button></div>
    </li>`;
  }
  // a saved bill back into the form, for editing
  const draftFrom = (b) => ({ ...newDraft(), id: b.id, what: b.what || "", ev: b.ev || "", hkd: String(b.hkd), paidBy: b.paidBy, among: new Set(b.among),
    mode: b.shares ? "custom" : "equal", shares: b.shares ? Object.fromEntries(Object.entries(b.shares).map(([k, v]) => [k, String(v)])) : {},
    guests: Array.from({ length: bG(b) }, (_, i) => (b.guestNames || [])[i] || ""), gShares: (b.guestShares || []).map(String), gPay: (b.guestPay || []).slice(), cover: Object.entries(b.cover || {}),
    fronted: !!b.frontedBy, frontedBy: b.frontedBy || "", also: Object.entries(b.alsoPaid || {}).map(([n, a]) => [n, String(a)]) });
  const alsoLine = (d) => { const tot = +d.hkd || 0, s = d.also.reduce((t, [, a]) => t + (+a || 0), 0), rest = tot - s;
    return tot && rest <= 0 ? `<span class="warn-t">The others add up to ${hk(s)}, the whole bill. Check the amounts.</span>` : `${esc(d.paidBy || "The main payer")} paid the rest${tot ? `: <b>${hk(rest)}</b>` : ""}. Everyone pays each payer back in proportion.`; };
  function billForm(d, ppl, evName) {
    const total = +d.hkd || 0, among = [...d.among], gs = d.guests, g = gs.length, n = among.length + g;
    const sum = among.reduce((t, x) => t + (+d.shares[x] || 0), 0) + gs.reduce((t, _, i) => t + (+d.gShares[i] || 0), 0);
    const rest = ppl.filter((x) => !d.among.has(x));
    return `<form class="bill-form" id="bill-form" autocomplete="off">
      <p class="bf-title">${d.id ? "✏️ Edit this bill" : "🧾 New bill"}</p>
      <label class="bf-f"><span>What was it?</span><input name="what" placeholder="e.g. Thu dinner, table 2" maxlength="60" value="${esc(d.what)}" data-bf="what"></label>
      <label class="bf-f"><span>Class event <small>(optional)</small></span><select name="ev" data-bf="ev" aria-label="Which event"><option value="">Not linked to an event</option>${data.events.map((e) => `<option value="${e.id}"${d.ev === e.id ? " selected" : ""}>${esc(e.title)}</option>`).join("")}</select></label>
      <div class="bf-2">
        <label class="bf-f"><span>Total HK$</span><input name="hkd" type="number" inputmode="decimal" min="1" step="0.01" value="${esc(d.hkd)}" data-bf="hkd" required></label>
        <label class="bf-f"><span>Paid by <small>(type a name; everyone pays them)</small></span><input name="paidBy" data-bf="paidBy" list="bf-people" value="${esc(d.paidBy)}" placeholder="Who paid? Type a name" autocomplete="off" autocapitalize="words" required>${peopleList("bf-people")}</label>
      </div>
      <div class="bf-also">${d.also.map(([n, a], i) => `<div class="bf-gcard"><div class="bf-2">
          <label class="bf-f"><span>Also paid</span><input data-bf-aname="${i}" list="bf-people" value="${esc(n)}" placeholder="Type a name" autocomplete="off" autocapitalize="words" aria-label="Who else paid"></label>
          <label class="bf-f"><span>How much HK$</span><input type="number" inputmode="decimal" min="1" step="0.01" data-bf-aamt="${i}" value="${esc(a)}" aria-label="How much they paid"></label></div>
          <button type="button" class="cc-mini" data-bf-adel="${i}">✕ Remove</button></div>`).join("")}
        ${d.also.length ? `<p class="small bf-arest">${alsoLine(d)}</p>` : ""}
        <button type="button" class="cc-mini" data-bf-aadd="1">💳 ${d.also.length ? "Someone else paid part too" : "Paid with more than one card? Add who else paid"}</button></div>
      <label class="bf-check"><input type="checkbox" data-bf="fronted"${d.fronted ? " checked" : ""}> <span>Someone else paid the restaurant: ${esc(d.paidBy)} collects from everyone and pays them back</span></label>
      ${d.fronted ? `<label class="bf-f"><span>Who paid the restaurant?</span><select name="frontedBy" data-bf="frontedBy">${ppl.filter((x) => x !== d.paidBy).map((x) => `<option${x === (d.frontedBy || me) ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></label>` : ""}

      <fieldset class="bf-sec"><legend>Who's sharing it? <small>${n} ${n === 1 ? "person" : "people"}</small></legend>
        ${among.length ? `<div class="cc-names edit bf-picked">${among.map((x) => `<button type="button" class="on" data-bf-toggle="${esc(x)}" aria-label="Remove ${esc(x)}">${esc(x)}<span aria-hidden="true">✕</span></button>`).join("")}</div>` : `<p class="small muted">Nobody picked yet.</p>`}
        <div class="bf-btns">${d.ev ? `<button type="button" class="cc-mini" data-bf-all="1">Everyone at the event</button>` : ""}${among.length ? `<button type="button" class="cc-mini" data-bf-none="1">Clear</button>` : ""}</div>
        <input class="name-find" data-find="bf" placeholder="Add a classmate: type a name" value="${esc(d.q || "")}" autocomplete="off" aria-label="Find a classmate">
        <div class="cc-names edit bf-rest${d.full ? " full" : ""}">${rest.map((x) => `<button type="button" data-bf-toggle="${esc(x)}" data-nm="${esc(x.toLowerCase())}">${esc(x)}</button>`).join("")}</div>
        ${rest.length > 8 ? `<button type="button" class="cc-mini bf-more" data-bf-full="1">${d.full ? "Show fewer names ▴" : `Show all ${rest.length} classmates ▾`}</button>` : ""}
        <div class="bf-guests"><p class="bf-gh">👤 Guests not on the class list <small>partners, friends, another section: say who pays for each</small></p>
          ${gs.map((x, i) => { const cur = d.gPay[i] || "", covers = [...new Set([...among, ...(cur && cur !== "paid" ? [cur] : [])])];
            return `<div class="bf-gcard"><div class="bf-grow"><input value="${esc(x)}" placeholder="Guest ${i + 1}: name (optional)" maxlength="40" data-bf-gname="${i}" aria-label="Guest ${i + 1} name"><button type="button" class="cc-x" data-bf-gdel="${i}" aria-label="Remove guest ${i + 1}">✕</button></div>
            <label class="bf-f"><span>How do they pay?</span><select data-bf-gpay="${i}" aria-label="How guest ${i + 1} pays"><option value="">Pays ${esc(d.paidBy || "the payer")} directly</option><option value="paid"${cur === "paid" ? " selected" : ""}>Already paid ${esc(d.paidBy || "the payer")} ✓</option>${covers.map((n) => `<option value="${esc(n)}"${cur === n ? " selected" : ""}>${esc(n)} pays for them</option>`).join("")}</select></label></div>`; }).join("")}
          <button type="button" class="cc-mini" data-bf-gadd="1">➕ Add a guest</button></div>
        ${among.length > 1 ? `<div class="bf-guests bf-cover"><p class="bf-gh">🤝 Someone paying for a classmate? <small>e.g. treating someone: their share goes to whoever pays for them</small></p>
          ${d.cover.map(([fr, by], i) => `<div class="bf-gcard"><div class="ev2">
              <label class="bf-f"><span>Who pays</span><select data-bf-cby="${i}">${among.map((n) => `<option${n === by ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
              <label class="bf-f"><span>for</span><select data-bf-cfor="${i}">${among.map((n) => `<option${n === fr ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label></div>
            ${fr === by ? `<p class="small warn-t">Pick two different people.</p>` : ""}<button type="button" class="cc-mini" data-bf-cdel="${i}">✕ Remove</button></div>`).join("")}
          <button type="button" class="cc-mini" data-bf-cadd="1">➕ Someone pays for someone</button></div>` : ""}
        ${g > among.length && among.length ? `<p class="small warn-t">Check: ${gS(g)} but only ${among.length} from the class. Guests are only people not on the class list.</p>` : ""}
      </fieldset>

      <fieldset class="bf-sec"><legend>Split</legend>
        <div class="bf-mode"><button type="button" class="cc-mini${d.mode === "equal" ? " go" : ""}" data-bf-mode="equal" aria-pressed="${d.mode === "equal"}">Equally</button><button type="button" class="cc-mini${d.mode === "custom" ? " go" : ""}" data-bf-mode="custom" aria-pressed="${d.mode === "custom"}">Custom amounts</button></div>
        ${d.mode === "equal" ? `<p class="small bf-each">${eqLine(total, among.length, g)}</p>`
          : `<div class="bf-custom">${among.map((x) => `<label><span>${esc(x)}</span><input type="number" inputmode="decimal" min="0" step="0.01" value="${esc(d.shares[x] ?? "")}" data-bf-share="${esc(x)}" placeholder="HK$"></label>`).join("")}${gs.map((x, i) => `<label><span>${esc(gName(x, i))}</span><input type="number" inputmode="decimal" min="0" step="0.01" value="${esc(d.gShares[i] ?? "")}" data-bf-gshare="${i}" placeholder="HK$"></label>`).join("")}</div>
             <p class="small bf-sum ${Math.abs(sum - total) > 1 ? "warn-t" : "ok-t"}">Adds up to ${hk(sum)} of ${hk(total)}${Math.abs(sum - total) > 1 ? ` · ${hk(total - sum)} left to assign` : " ✓"}</p>`}
      </fieldset>
      <div class="bf-actions"><button type="submit" class="paybtn"${billSaving ? " disabled" : ""}>${billSaving ? "Saving…" : d.id ? "Save changes" : "Add bill"}</button><button type="button" class="cc-mini" data-bf-cancel="1">Cancel</button>
        ${d.id ? `<button type="button" class="cc-mini bi-del${delArm === d.id ? " armed" : ""}" data-bdel="${d.id}">${delArm === d.id ? "Tap again to delete" : "🗑 Delete bill"}</button>` : ""}</div>
    </form>`;
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
    const form = d ? billForm(d, ppl, evName) : `<button type="button" class="cc-add-bill" data-bf-new="1">➕ Add a bill</button>`;
    const bills = (data.bills || []).slice().reverse();
    const pr = me ? (data.profiles || {})[me] || {} : null;
    return `<div class="cc-bills2">
      <h3 class="cc-h">🧾 Bills <small>whoever paid; split by table, equally or custom</small></h3>

      ${form}
      ${bills.length ? `<details class="cc-sub cc-allbills"${bills.length <= 8 ? " open" : ""}><summary>All bills · ${bills.length}</summary><ul class="bill-list">${bills.map((b) => billItem(b, evName)).join("")}</ul></details>` : ""}
      ${(() => { const withPay = people().filter((n) => payOpts(n, 0).length); return `<details class="cc-sub cc-paylook"><summary>📇 Look up someone's payment details${withPay.length ? ` · ${withPay.length}` : ""}</summary>
        ${withPay.length ? `<div class="paylook"><select data-paylook="1" aria-label="Whose payment details"><option value="">Pick a name…</option>${withPay.map((n) => `<option>${esc(n)}</option>`).join("")}</select><div class="paylook-out"></div></div>`
          : `<p class="muted small">Nobody has saved payment details yet. Once they add them under "My payment details", they show here and next to anything you owe them.</p>`}</details>`; })()}
      ${me ? `<details class="cc-sub"><summary>💳 My payment details${pr.paypal || pr.venmo || pr.fps || pr.bank || pr.accNo || pr.localCode || pr.note || pr.wechat ? " ✓" : ""}</summary>
        <form class="pay-form" id="my-pay" autocomplete="off">
          <p class="small muted">So people can pay you back when you cover a bill. Fill in only what you use; only classmates with the passcode can see these.</p>
          <fieldset><legend>💳 PayPal</legend>
            <label>PayPal.me link<input name="paypal" inputmode="url" placeholder="https://paypal.me/yourname" value="${esc(pr.paypal || "")}"></label>
            <details class="fps-box how"><summary>How do I get paid by PayPal?</summary><ol class="how-steps">
              <li>Open the PayPal app or paypal.com and log in. No account? Sign up free with your email.</li>
              <li>Get your PayPal.me link: in the app, tap your profile picture and look for <b>PayPal.me</b>; on the web, go to <b>paypal.me</b> and create your link.</li>
              <li>Pick a name. Your link is <b>paypal.me/yourname</b>.</li>
              <li>Type or paste it in the box above, for example <b>https://paypal.me/yourname</b> (the https:// is added for you if you leave it off), and tap <b>Save my details</b>.</li></ol>
              <p class="small muted">Classmates then get a Pay button with the HK$ amount filled in. PayPal changes it into your own currency. Paying by card adds a fee of about 3–5%; paying from a PayPal balance or linked bank usually costs less.</p></details></fieldset>
          <fieldset><legend>🌍 Bank transfer</legend>
            <label>Account name <small>(exactly as your bank has it)</small><input name="accName" placeholder="Name on the account" value="${esc(pr.accName || "")}"></label>
            <label>Bank<input name="bankName" placeholder="e.g. Chase, Barclays, HSBC" value="${esc(pr.bankName || "")}"></label>
            <label>Country & currency of the account<input name="bankCountry" placeholder="e.g. USA · USD" maxlength="60" value="${esc(pr.bankCountry || "")}"></label>
            <label>Account number or IBAN<input name="accNo" value="${esc(pr.accNo || "")}"></label>
            <label>SWIFT / BIC <small>(for payments from abroad)</small><input name="swift" autocapitalize="characters" placeholder="e.g. CHASUS33" value="${esc(pr.swift || "")}"></label>
            <label>Routing number, sort code, or HK bank & branch code <small>(for payments in the same country)</small><input name="localCode" maxlength="40" value="${esc(pr.localCode || "")}"></label>
            <label>Anything else your bank needs <small>(optional)</small><input name="bankExtra" maxlength="120" placeholder="e.g. checking account" value="${esc(pr.bankExtra || "")}"></label>
            <label>Wise payment link <small>(optional)</small><input name="wiseLink" inputmode="url" placeholder="https://wise.com/pay/…" value="${esc(pr.wiseLink || "")}"></label>
            <details class="fps-box how"><summary>How do I get paid by bank transfer?</summary><ol class="how-steps">
              <li>Write the account name exactly as your bank has it. Transfers can bounce if it doesn't match.</li>
              <li>Add what your country uses:<br>🇺🇸 <b>US:</b> routing number and account number (say checking or savings). From abroad, also SWIFT.<br>🇬🇧 <b>UK:</b> sort code and account number. From abroad, IBAN and SWIFT/BIC.<br>🇪🇺 <b>Europe:</b> IBAN and SWIFT/BIC.<br>🇭🇰 <b>Hong Kong:</b> bank code, branch code and account number, or just add FPS below.<br>🌏 <b>Elsewhere:</b> account number and SWIFT/BIC.</li>
              <li>Add the country and currency so people know what to send.</li>
              <li>Tap <b>Save my details</b>. Classmates see each line with a Copy button for their banking app or Wise.</li></ol>
              <p class="small muted">Sending money abroad from a bank can cost a fee. Wise is usually cheapest, and a Wise payment link (in the Wise app: Request, then Share link) lets people pay you in one tap. For small amounts, PayPal, Venmo or FPS are often easier.</p></details></fieldset>
          <fieldset><legend>📱 Other apps</legend>
            <label>💙 Venmo username <small>(US accounts)</small><input name="venmo" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="@yourname" value="${esc(pr.venmo ? `@${String(pr.venmo).replace(/^@/, "")}` : "")}"></label>
            <details class="fps-box how"><summary>Where do I find my Venmo username?</summary>
              <p class="small muted">In the Venmo app, tap <b>Me</b>: your username is the @name under your name. Type it here and tap <b>Save my details</b>. Classmates get a button that opens your Venmo, plus the amount in US$ to send. Venmo only works between US accounts.</p></details>
            <label>Revolut, Zelle, PayNow…<input name="note" placeholder="e.g. Zelle: your email" value="${esc(pr.note || "")}"></label></fieldset>
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
    if (t.dataset.bfShare) billDraft.shares[t.dataset.bfShare] = t.value;
    if (t.dataset.bfGshare != null) billDraft.gShares[+t.dataset.bfGshare] = t.value;
    if (t.dataset.bfGname != null) billDraft.guests[+t.dataset.bfGname] = t.value;
    if (t.dataset.bfGpay != null) billDraft.gPay[+t.dataset.bfGpay] = t.value;
    if (t.dataset.bfAname != null) billDraft.also[+t.dataset.bfAname][0] = t.value;
    if (t.dataset.bfAamt != null) billDraft.also[+t.dataset.bfAamt][1] = t.value;
    if (t.dataset.bfAamt != null || t.dataset.bf === "hkd") { const p = t.closest(".bill-form")?.querySelector(".bf-arest"); if (p) p.innerHTML = alsoLine(billDraft); }
    if (t.dataset.bfCby != null || t.dataset.bfCfor != null) { const i = +(t.dataset.bfCby ?? t.dataset.bfCfor); billDraft.cover[i][t.dataset.bfCby != null ? 1 : 0] = t.value; render(); }
    if (t.dataset.bfShare || t.dataset.bfGshare != null || t.dataset.bf === "hkd") { const p = t.closest(".bill-form"); if (p) refreshSum(p); }
  });
  function eqLine(total, n, g) {
    return (n + g) && total ? `${hk(total)} ÷ ${n + g} people = <b>${hk(total / (n + g))}</b> each${g ? ` · ${n} from the class + ${gS(g)}` : ""}` : "Pick who's sharing it and enter the total.";
  }
  function refreshSum(formEl) { // update the "adds up to" line without redrawing (keeps the keyboard open)
    const d = billDraft, total = +d.hkd || 0, among = [...d.among];
    if (d.mode === "custom") {
      const sum = among.reduce((t, n) => t + (+d.shares[n] || 0), 0) + d.guests.reduce((t, _, i) => t + (+d.gShares[i] || 0), 0);
      const p = formEl.querySelector("p.bf-sum");
      if (p) { p.className = `small bf-sum ${Math.abs(sum - total) > 1 ? "warn-t" : "ok-t"}`; p.innerHTML = `Adds up to ${hk(sum)} of ${hk(total)}${Math.abs(sum - total) > 1 ? ` · ${hk(total - sum)} left to assign` : " ✓"}`; }
    } else {
      const p = formEl.querySelector("p.bf-each");
      if (p) p.innerHTML = eqLine(total, among.length, d.guests.length);
    }
  }
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (!billDraft || !root.contains(t) || !t.dataset.bf) return;
    if (t.dataset.bf === "fronted") { billDraft.fronted = t.checked; if (t.checked && !billDraft.frontedBy) billDraft.frontedBy = me !== billDraft.paidBy ? me : ""; render(); return; }
    billDraft[t.dataset.bf] = t.value;
    if (t.dataset.bf === "paidBy") { const n = findPerson(t.value); if (n) { billDraft.paidBy = n; render(); } return; }
    if (t.dataset.bf === "ev" && t.value) { const E = data.events.find((x) => x.id === t.value); if (E) { billDraft.among = new Set(E.going); billDraft.guests = evGuests(E); billDraft.paidBy = defaultPayer(E.id); if (!billDraft.what) billDraft.what = E.title; } render(); }
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
      el.innerHTML = `<button class="evlock open" data-cclink="${e.id}">👥 ${e.closed ? "⏸️ Sign-ups open after the announcement" : goingTxt(e)}${e.closed ? "" : capOf(e) ? ` · ${over(e) ? `⚠️ ${over(e)} over the ${capOf(e)} places` : isFull(e) ? `full (${capOf(e)} places)` : `${spots(e)} of ${capOf(e)} places left`}${wait(e).length ? ` · ${wait(e).length} on the waitlist` : ""}` : ""}${(e.tables || []).length ? ` · 🍽️ ${e.tables[0].time ? `tables from ${esc(e.tables[0].time)}` : `${seats(e)} seats booked`}${seatsShort(e) ? ` · ⚠️ ${seatsShort(e)} seat${seatsShort(e) > 1 ? "s" : ""} short` : seats(e) > headcount(e) ? ` · ${seats(e) - headcount(e)} seat${seats(e) - headcount(e) > 1 ? "s" : ""} free` : ""}` : ""}${billCost(e) ? ` · ${billCost(e)}` : p ? ` · ${hk(p)} each` : ""}</button>${e.note ? `<small class="evnote">ℹ️ ${esc(e.note)}</small>` : ""}`;
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
    const d = e.target;
    if (d.matches?.(".cc-help")) { set("hk-help-v1", d.open ? "open" : "closed"); return; } // open until you fold it, then stays folded
    if (!d.matches?.("details[data-ev]")) return;
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
      if (on && isFull(E) && !E.going.includes(name)) { // full: the server puts them on the waitlist instead
        op({ op: "toggle", ev, name, on }).then((ok) => { const n = ok && wait(data.events.find((x) => x.id === ev)).indexOf(name) + 1; if (n) toast(`It's full, so ${name === me ? "you're" : `${name} is`} #${n} on the waitlist`); });
        return;
      }
      op({ op: "toggle", ev, name, on }, () => { E.going = on ? [...new Set([...E.going, name])].sort((a, b) => a.localeCompare(b)) : E.going.filter((n) => n !== name);
        if (on && E.group) data.events.forEach((x) => { if (x !== E && x.group === E.group) x.going = x.going.filter((n) => n !== name); }); });
      return;
    }
    const wt = t.closest("[data-wait]");
    if (wt) { const on = wt.dataset.on === "1"; op({ op: "waitlist", ev: wt.dataset.wait, name: me, on }).then((ok) => { if (!ok) return; const n = wait(data.events.find((x) => x.id === wt.dataset.wait)).indexOf(me) + 1; toast(on ? (n ? `You're #${n} on the waitlist` : "You're in!") : "Off the waitlist"); }); return; }
    const gd = t.closest("[data-gdel]");
    if (gd) { const n = gd.dataset.name; if (confirm(`Take ${n} off the guest list?`)) op({ op: "delGuest", ev: gd.dataset.gdel, name: n }).then((ok) => ok && toast(`${n} is off the guest list`)); return; }
    const uw = t.closest("[data-unwait]");
    if (uw) { if (confirm(`Take ${uw.dataset.name} off the waitlist?`)) op({ op: "waitlist", ev: uw.dataset.unwait, name: uw.dataset.name, on: false }); return; }
    const rg = t.closest("[data-resetgo]");
    if (rg) { const ev = rg.dataset.resetgo;
      if (resetArm !== ev) { resetArm = ev; clearTimeout(resetTimer); resetTimer = setTimeout(() => { resetArm = null; render(); }, 8000); render(); return; }
      resetArm = null; clearTimeout(resetTimer);
      asOrganiser({ op: "resetGoing", ev }, () => toast("Reset done. Sign-ups are paused: tap Open sign-ups now when you announce it")); return; }
    const os = t.closest("[data-opensign]");
    if (os) { asOrganiser({ op: "openSignups", ev: os.dataset.opensign }, () => toast("Sign-ups are open. First come, first served")); return; }
    const ur = t.closest("[data-undoreset]");
    if (ur) { asOrganiser({ op: "undoReset", ev: ur.dataset.undoreset }, () => toast("Undone: everyone is back as before")); return; }
    const pm = t.closest("[data-promote]");
    if (pm) { const n = pm.dataset.name; asOrganiser({ op: "promote", ev: pm.dataset.promote, name: n }, () => toast(`${n} has a place now. Let them know!`)); return; }
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
    if (t.closest("[data-bf-new]")) { billDraft = newDraft(); render(); setTimeout(() => document.getElementById("bill-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); return; }
    const spm = t.closest("[data-spmode]");
    if (spm) { settleMode = spm.dataset.spmode; set("hk-settle-v1", settleMode); render(); return; }
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
      billDraft = { ...newDraft(), ev: E.id, what: E.title, among: new Set(E.going), guests: evGuests(E), paidBy: defaultPayer(E.id) };
      render();
      setTimeout(() => document.getElementById("bill-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return;
    }
    if (t.closest("[data-bf-cancel]")) { billDraft = null; render(); return; }
    const bt = t.closest("[data-bf-toggle]");
    if (bt && billDraft) { const n = bt.dataset.bfToggle; if (billDraft.among.has(n)) billDraft.among.delete(n); else billDraft.among.add(n); render(); return; }
    if (t.closest("[data-bf-all]") && billDraft) { const E = data.events.find((x) => x.id === billDraft.ev); if (E) { billDraft.among = new Set(E.going); billDraft.guests = evGuests(E); } render(); return; }
    if (t.closest("[data-bf-none]") && billDraft) { billDraft.among = new Set(); render(); return; }
    if (t.closest("[data-bf-full]") && billDraft) { billDraft.full = !billDraft.full; render(); return; }
    if (t.closest("[data-bf-aadd]") && billDraft) { billDraft.also.push(["", ""]); render(); setTimeout(() => { const ins = root.querySelectorAll("[data-bf-aname]"); ins[ins.length - 1]?.focus(); }, 30); return; }
    const adel = t.closest("[data-bf-adel]");
    if (adel && billDraft) { billDraft.also.splice(+adel.dataset.bfAdel, 1); render(); return; }
    if (t.closest("[data-bf-gadd]") && billDraft) { billDraft.guests.push(""); render(); setTimeout(() => { const ins = root.querySelectorAll("[data-bf-gname]"); ins[ins.length - 1]?.focus(); }, 30); return; }
    if (t.closest("[data-bf-cadd]") && billDraft) { const am = [...billDraft.among], by = am.includes(me) ? me : am[0], taken = billDraft.cover.map(([f]) => f);
      billDraft.cover.push([am.find((n) => n !== by && !taken.includes(n)) || am[1] || "", by]); render(); return; }
    const cdel = t.closest("[data-bf-cdel]");
    if (cdel && billDraft) { billDraft.cover.splice(+cdel.dataset.bfCdel, 1); render(); return; }
    const gdel = t.closest("[data-bf-gdel]");
    if (gdel && billDraft) { const i = +gdel.dataset.bfGdel; billDraft.guests.splice(i, 1); billDraft.gShares.splice(i, 1); billDraft.gPay.splice(i, 1); render(); return; }
    const bed = t.closest("[data-bedit]");
    if (bed) { const B = (data.bills || []).find((x) => x.id === bed.dataset.bedit); if (B) { billDraft = draftFrom(B); delArm = null; render(); setTimeout(() => document.getElementById("bill-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); } return; }
    const bm = t.closest("[data-bf-mode]");
    if (bm && billDraft) {
      billDraft.mode = bm.dataset.bfMode;
      if (billDraft.mode === "custom") { const n = billDraft.among.size + billDraft.guests.length, tot = +billDraft.hkd || 0, sh = n && tot ? (Math.round((tot / n) * 100) / 100).toString() : null;
        if (sh) { [...billDraft.among].forEach((x) => { if (billDraft.shares[x] == null) billDraft.shares[x] = sh; }); billDraft.guests.forEach((_, i) => { if (billDraft.gShares[i] == null) billDraft.gShares[i] = sh; }); } }
      render(); return;
    }
    const xm = t.closest("[data-xmark]");
    if (xm) { const x = JSON.parse(xm.dataset.xmark);
      if (!confirm(`Has ${x.from} paid you ${hk(x.hkd)}?\n\nOnly tap OK once the money is in your account. It then counts as paid.`)) return;
      op({ op: "markXfer", from: x.from, to: x.to, hkd: x.hkd, method: "", confirmed: x.to === me, direct: !!x.direct, note: x.direct ? x.note : "" }).then((ok) => ok && toast(x.to === me ? `Got it: ${x.from} has paid you` : `Marked: ${x.from} paid ${x.to}`)); return; }
    const xc = t.closest("[data-xconfirm]");
    const xOf = (id) => (data.xfers || []).find((x) => x.id === id) || {};
    if (xc) { const x = xOf(xc.dataset.xconfirm); if (!confirm(`Did ${hk(x.hkd)} from ${x.from} arrive${x.method ? ` by ${x.method}` : ""}?\n\nOnly tap OK if you can see it in your account.`)) return;
      op({ op: "confirmXfer", id: x.id }).then((ok) => ok && toast(`Confirmed: ${x.from} has paid you`)); return; }
    const xr = t.closest("[data-xreject]");
    if (xr) { const x = xOf(xr.dataset.xreject); if (!confirm(`Mark ${hk(x.hkd)} from ${x.from} as not received?\n\nIt comes off the list and ${x.from} owes it again.`)) return;
      op({ op: "undoXfer", id: x.id }).then((ok) => ok && toast(`Marked as not received: ${x.from} still owes you`)); return; }
    const xn = t.closest("[data-xunconf]");
    if (xn) { const x = xOf(xn.dataset.xunconf); if (!confirm(`Mark ${hk(x.hkd)} from ${x.from} as not received after all?\n\nIt goes back to waiting, and ${x.from} owes it again until you say it arrived.`)) return;
      op({ op: "unconfirmXfer", id: x.id }).then((ok) => ok && toast("Back to waiting to be confirmed")); return; }
    const xu = t.closest("[data-xundo]");
    if (xu) { op({ op: "undoXfer", id: xu.dataset.xundo }).then((ok) => ok && toast("Undone")); return; }
    const bd = t.closest("[data-bdel]");
    if (bd) {
      const id = bd.dataset.bdel;
      if (delArm !== id) { delArm = id; render(); setTimeout(() => { if (delArm === id) { delArm = null; render(); } }, 5000); return; }
      delArm = null; if (billDraft?.id === id) billDraft = null;
      op({ op: "delBill", id }).then((ok) => ok && toast("Bill deleted for everyone"));
      return;
    }
    const p1 = t.closest("[data-payev]");
    if (p1) {
      const E = data.events.find((x) => x.id === p1.dataset.payev);
      const method = $("#cc-paid select[name=method]")?.value || "";
      if (!confirm(`Have you already sent ${hk(Math.round(each(E)))} to ${data.payTo} for ${E.title}?\n\nOnly tap OK once the money has gone. ${data.payTo} then confirms it.`)) return;
      op({ op: "markPaid", name: me, hkd: Math.round(each(E)), evs: [E.id], method }).then((ok) => ok && toast(`Thanks! ${data.payTo} will confirm ${E.title}`));
      return;
    }
    const rc = t.closest("[data-recalc]");
    if (rc) { const E = data.events.find((x) => x.id === rc.dataset.recalc); op({ op: "setPrice", ev: E.id, total: E.total, count: payCount(E), paidBy: evPayer(E) }).then((ok) => ok && toast(`Recalculated: ${hk(E.total / payCount(E))} each`)); return; }
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
      if (billSaving) return;
      const d = billDraft, among = [...d.among], editing = !!d.id;
      if (!among.length && !d.guests.length) { toast("Pick who's sharing the bill"); return; }
      const payer = findPerson(f.elements.paidBy?.value ?? d.paidBy);
      if (!payer) { toast("Pick who paid from the class list: type their name"); f.elements.paidBy?.focus(); return; }
      d.paidBy = payer;
      const body = { op: editing ? "editBill" : "addBill", id: d.id || undefined, what: d.what, ev: d.ev, hkd: +d.hkd, paidBy: d.paidBy, among, guestNames: d.guests.map((x) => x.trim()), guestPay: d.guests.map((_, i) => d.gPay[i] || ""), cover: Object.fromEntries(d.cover.filter(([f, by]) => f && by && f !== by && d.among.has(f) && d.among.has(by))) };
      if (d.fronted) body.frontedBy = f.elements.frontedBy?.value || d.frontedBy;
      if (d.mode === "custom") { body.shares = Object.fromEntries(among.map((n) => [n, +d.shares[n] || 0])); body.guestShares = d.guests.map((_, i) => +d.gShares[i] || 0); }
      const also = d.also.filter(([n, a]) => String(n).trim() || +a), ap = {};
      for (const [n, a] of also) { const p = findPerson(n);
        if (!p) { toast("Who else paid? Type a name from the class list"); return; }
        if (p === payer) { toast(`${p} is already the main payer`); return; }
        if (!(+a > 0)) { toast(`How much did ${p} pay?`); return; }
        ap[p] = (ap[p] || 0) + +a; }
      if (also.length) { if (Object.values(ap).reduce((t, v) => t + v, 0) >= +d.hkd) { toast(`The others add up to the whole bill: ${payer} paid nothing. Check the amounts`); return; } body.alsoPaid = ap; }
      billSaving = true; render();
      op(body).then((ok) => { billSaving = false; if (ok) { billDraft = null; toast(editing ? "Bill updated for everyone" : payer === me ? "Bill added. Tap 📲 Ask on WhatsApp on it to tell everyone" : "Bill added: everyone's share is worked out"); } render(); });
    }
    else if (f.dataset.xfer) {
      const x = JSON.parse(f.dataset.xfer), m = fd("method");
      if (!confirm(`Have you already sent ${hk(x.hkd)} to ${x.to}${m ? ` by ${m}` : ""}?\n\nOnly tap OK once the money has gone. ${x.to} then confirms they got it. Until then it shows as waiting.`)) return;
      op({ op: "markXfer", from: x.from, to: x.to, hkd: x.hkd, method: fd("method"), direct: !!x.direct, note: x.direct ? x.note : "" }).then((ok) => ok && toast(`Thanks! ${x.to} will confirm when it arrives`));
    }
    else if (f.dataset.gadd) { const E = data.events.find((x) => x.id === f.dataset.gadd), name = fd("gname"); if (!E || !name) return;
      const host = fd("gof") ? findPerson(fd("gof")) : me; if (!host) { toast("Whose guest? Type a name from the class list"); return; }
      op({ op: "addGuest", ev: E.id, name, of: host, fill: gUnnamed(E) > 0 }).then((ok) => ok && toast(`${name} is on the guest list`)); }
    else if (f.dataset.fixname) { const from = f.dataset.fixname, to = fd("to"); if (to) asOrganiser({ op: "renamePerson", from, to }, () => toast(`${from} is now ${to} everywhere`)); }
    else if (f.dataset.aliasname) { const from = fd("from"), to = fd("to"); if (from && to && confirm(`Show ${from} as "${to}" everywhere?`)) asOrganiser({ op: "renamePerson", from, to }, () => toast(`${from} now shows as ${to}`)); }
    else if (f.id === "cc-collect") {
      const from = fd("from"), hkd = Math.round(+fd("hkd"));
      if (!from || !(hkd > 0)) return;
      if (!confirm(`Has ${from} paid you ${hk(hkd)}?\n\nOnly tap OK once the money is in your account.`)) return;
      op({ op: "markXfer", from, to: me, hkd, method: "Collected", confirmed: true, note: `collected for ${data.payTo}` }).then((ok) => ok && toast(`Recorded: ${from} paid you ${hk(hkd)}`));
    }
    else if (f.id === "my-pay" && fd("orgcode")) { // organiser resets a forgotten PIN
      const keep = orgPass; orgPass = fd("orgcode").toLowerCase();
      op({ op: "setProfile", name: me, paypal: fd("paypal"), fps: fd("fps"), accName: fd("accName"), bankName: fd("bankName"), accNo: fd("accNo"), swift: fd("swift"), wechat: fd("wechat"), wiseLink: fd("wiseLink"), venmo: fd("venmo"), bankCountry: fd("bankCountry"), localCode: fd("localCode"), bankExtra: fd("bankExtra"), note: fd("note"), newPin: fd("newPin") })
        .then((ok) => { orgPass = keep; if (ok) toast(fd("newPin") ? "PIN reset and details saved" : "Details saved"); });
    }
    else if (f.id === "my-pay") {
      op({ op: "setProfile", name: me, paypal: fd("paypal"), fps: fd("fps"), accName: fd("accName"), bankName: fd("bankName"), accNo: fd("accNo"), swift: fd("swift"), wechat: fd("wechat"), wiseLink: fd("wiseLink"), venmo: fd("venmo"), bankCountry: fd("bankCountry"), localCode: fd("localCode"), bankExtra: fd("bankExtra"), note: fd("note"), pin: fd("pin"), newPin: fd("newPin") })
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
      if (!confirm(`Have you already sent ${hk(fd("what") === "all" ? Math.min(sum, st.left) : sum)} to ${data.payTo}?\n\nOnly tap OK once the money has gone. ${data.payTo} then confirms it.`)) return;
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
    else if (f.dataset.setcap) {
      const cap = +fd("cap") || 0;
      asOrganiser({ op: "setCap", ev: f.dataset.setcap, cap }, () => toast(cap ? `Capped at ${cap} places` : "No limit now"));
    }
    else if (f.dataset.editev) {
      op({ op: "editEvent", ev: f.dataset.editev, when: fd("when"), venue: fd("venue"), title: fd("title"), iso: fd("iso") || undefined }).then((ok) => ok && toast("Saved for everyone"));
    }
    else if (f.dataset.setprice) {
      const E = data.events.find((x) => x.id === f.dataset.setprice);
      if (!E.going.length) { toast("Tick who's going first, then enter the total"); return; }
      const pb = findPerson(fd("paidBy"));
      if (!pb) { toast("Pick who paid from the class list: type their name"); f.elements.paidBy?.focus(); return; }
      op({ op: "setPrice", ev: E.id, total: fd("total"), count: payCount(E), paidBy: pb }).then((ok) => ok && toast(`Saved: ${hk(+fd("total") / payCount(E))} each, paid to ${pb}`));
    }
  });

  render();
  if (pass) unlock(pass, true);
})();
