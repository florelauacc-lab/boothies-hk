// Class corner: who's going, the bill split and study groups. The data ships encrypted (private.enc.js)
// and is only decrypted in the browser with the class passcode, so names never sit on the open web.
(() => {
  const L = window.HK_LOCKED;
  const root = document.getElementById("cc");
  if (!L || !root) return;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const get = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  // Rough fallbacks (HKD is pegged at about 7.8 per USD); live rates replace these when online
  let rates = { USD: 0.128, GBP: 0.099, EUR: 0.111, JPY: 19.6, CNY: 0.92, KRW: 179, SGD: 0.166, TWD: 4.1, CAD: 0.178, AUD: 0.196, INR: 10.9, ILS: 0.47, CHF: 0.103 };
  let live = false;
  const CUR = [["USD", "$"], ["GBP", "£"], ["EUR", "€"], ["JPY", "¥"], ["CNY", "CN¥"], ["KRW", "₩"], ["SGD", "S$"], ["TWD", "NT$"], ["CAD", "C$"], ["AUD", "A$"], ["INR", "₹"], ["ILS", "₪"], ["CHF", "CHF "]];
  const SYM = Object.fromEntries(CUR);
  const cached = get("hk-rates-v1");
  if (cached && Date.now() - cached.t < 12 * 3600e3) { rates = { ...rates, ...cached.r }; live = true; }
  else fetch("https://open.er-api.com/v6/latest/HKD").then((r) => r.json()).then((j) => {
    if (j && j.rates) { const r = Object.fromEntries(CUR.map(([c]) => [c, j.rates[c]]).filter(([, v]) => v)); rates = { ...rates, ...r }; live = true; set("hk-rates-v1", { t: Date.now(), r }); render(); }
  }).catch(() => {});

  let data = null;
  let me = get("hk-me-v1") || "";
  let cur = get("hk-cur-v1") || "USD";
  const hk = (n) => `HK$${Math.round(n).toLocaleString("en")}`;
  const fx = (n, c = cur) => { const v = n * rates[c]; return `${SYM[c]}${v >= 100 ? Math.round(v).toLocaleString("en") : v.toFixed(c === "JPY" || c === "KRW" ? 0 : 2)}`; };
  // Tricount-style: bills are added after each event and split evenly between the people who went
  const total = (e) => (e.expenses || []).reduce((t, x) => t + (+x.hkd || 0), 0);
  const each = (e) => (total(e) && e.going.length ? total(e) / e.going.length : null);
  function balances() {
    const b = {};
    Object.values(data.events).forEach((e) => {
      const s = each(e); if (!s) return;
      e.going.forEach((n) => { b[n] = (b[n] || 0) - s; });
      e.expenses.forEach((x) => { b[x.paidBy] = (b[x.paidBy] || 0) + (+x.hkd || 0); });
    });
    return b;
  }

  async function unlock(pass, quiet) {
    try {
      const enc = new TextEncoder();
      const base = await crypto.subtle.importKey("raw", enc.encode(pass.trim().toLowerCase()), "PBKDF2", false, ["deriveKey"]);
      const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: unb64(L.salt), iterations: L.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(L.iv) }, key, unb64(L.ct));
      data = JSON.parse(new TextDecoder().decode(pt));
      set("hk-pass-v1", pass.trim().toLowerCase());
      render();
    } catch (e) {
      if (!quiet) { const m = $("#cc-msg"); if (m) m.textContent = "That's not it. The passcode is pinned in the class WhatsApp group."; }
      else localStorage.removeItem("hk-pass-v1");
    }
  }

  function people() {
    const s = new Set();
    Object.values(data.events).forEach((e) => e.going.forEach((n) => s.add(n)));
    return [...s].sort((a, b) => a.localeCompare(b));
  }

  function render() {
    if (!data) {
      root.innerHTML = `<div class="cc-lock">
        <h2>🔒 Class corner</h2>
        <p class="muted">Who's coming to what, your share of each bill and the study groups. Enter the class passcode from the WhatsApp group.</p>
        <form id="cc-form" class="cc-form" autocomplete="off">
          <input id="cc-pass" type="password" inputmode="text" autocapitalize="none" spellcheck="false" placeholder="Class passcode" aria-label="Class passcode" required>
          <button type="submit">Unlock</button>
        </form>
        <p id="cc-msg" class="cc-msg" role="status"></p>
      </div>`;
      $("#cc-form").addEventListener("submit", (e) => { e.preventDefault(); $("#cc-msg").textContent = "Checking…"; unlock($("#cc-pass").value); });
      fillPlan();
      return;
    }
    const evs = Object.entries(data.events);
    const mine = evs.filter(([, e]) => e.going.includes(me));
    // Sunday's dim sum has two venues: only auto-tick it when there's a single row for the event
    if (me) window.HK_AUTO_MINE?.(mine.map(([id]) => id).filter((id) => id !== "sun-dimsum"));
    const owed = mine.reduce((t, [, e]) => t + (each(e) || 0), 0);
    const bal = balances();
    const tbc = mine.filter(([, e]) => !each(e)).length;
    const opts = people().map((n) => `<option${n === me ? " selected" : ""}>${esc(n)}</option>`).join("");
    const curOpts = CUR.map(([c]) => `<option${c === cur ? " selected" : ""}>${c}</option>`).join("");
    root.innerHTML = `<div class="cc-head">
        <h2>👥 Class corner</h2>
        <button class="cc-lockbtn" id="cc-relock" type="button">Lock 🔒</button>
      </div>
      <div class="cc-me">
        <label>I'm <select id="cc-me" aria-label="Your name"><option value="">choose your name</option>${opts}</select></label>
        <label>Show prices in <select id="cc-cur" aria-label="Currency">${curOpts}</select></label>
      </div>
      ${me ? `<div class="cc-owe">
        <div><small>${(bal[me] || 0) > 0.5 ? "You're owed" : "Your share so far"}</small><b>${(bal[me] || 0) > 0.5 ? `${hk(bal[me])} <span>≈ ${fx(bal[me])}</span>` : owed ? `${hk(owed)} <span>≈ ${fx(owed)}</span>` : "Nothing yet"}</b>
        <p>${mine.length ? `You're on ${mine.length} event${mine.length > 1 ? "s" : ""}.${tbc ? ` ${tbc === mine.length ? "Bills" : `${tbc} bill${tbc > 1 ? "s" : ""}`} get added after the event and split evenly.` : ""}` : "You're not on any lists yet. Tell Florence in the group chat if that's wrong."}</p></div>
      </div>` : ""}
      <div class="cc-events">${evs.map(([id, e]) => {
        const p = each(e), inIt = e.going.includes(me);
        return `<details class="cc-ev${inIt ? " mine" : ""}" id="ev-${id}">
          <summary><span class="t"><b>${esc(e.title)}</b><small>${esc(e.when)} · ${esc(e.venue)}</small></span>
          <span class="n">${e.going.length} going${inIt ? " · ✓ you" : ""}<br><em>${p ? `${hk(p)} each ≈ ${fx(p)}` : "Split evenly after"}</em></span></summary>
          ${p ? `<p class="cc-split">${e.expenses.map((x) => `${esc(x.what)} ${hk(+x.hkd)} (paid by ${esc(x.paidBy)})`).join(" + ")} ÷ ${e.going.length} people = <b>${hk(p)}</b> each · ${["USD", "GBP", "EUR", "JPY"].map((c) => fx(p, c)).join(" · ")}</p>` : `<p class="cc-split muted">The bill gets added here after the event, then split evenly between everyone who went.</p>`}
          <div class="cc-names">${e.going.map((n) => `<span class="${n === me ? "me" : ""}">${esc(n)}</span>`).join("")}</div>
        </details>`;
      }).join("")}</div>
      ${overview(evs)}
      <div class="cc-pay">
        <h3>💸 Settle up</h3>
        ${settle(bal)}
        <p class="muted">${esc(data.payNote)}</p>
        ${payButtons(me ? Math.max(0, -(bal[me] || 0)) : 0)}
        <ul>${data.methods.map(([em, n, d]) => `<li><span>${em}</span><b>${esc(n)}</b> ${esc(d)}</li>`).join("")}</ul>
        <p class="muted small">Prices in other currencies are ${live ? "today's rates" : "approximate"}. ${esc(data.payTo)} receives HKD.</p>
      </div>
      <details class="cc-groups"><summary>📚 Becker study groups</summary>
        <div class="cc-grid">${data.groups.map(([g, ns]) => `<div><h4>${esc(g)}</h4><ul>${ns.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>`).join("")}</div>
        <p class="muted small">${esc(data.groupsNote)}</p>
      </details>`;
    $("#cc-me").addEventListener("change", (e) => { me = e.target.value; set("hk-me-v1", me); render(); });
    $("#cc-cur").addEventListener("change", (e) => { cur = e.target.value; set("hk-cur-v1", cur); render(); });
    $("#cc-relock").addEventListener("click", () => { data = null; localStorage.removeItem("hk-pass-v1"); render(); });
    fillPlan();
  }

  // One-tap ways to pay. Rienno's details live only in the encrypted data; buttons appear once they're added.
  function payButtons(amt) {
    const L = data.payLinks || {};
    const a = Math.round(amt);
    const btns = [
      L.paypal && `<a class="paybtn" href="${esc(L.paypal.replace(/\/$/, ""))}${a ? `/${a}HKD` : ""}" target="_blank" rel="noopener">💳 Pay ${a ? hk(a) : ""} by card or PayPal</a>`,
      L.payme && `<a class="paybtn" href="${esc(L.payme)}" target="_blank" rel="noopener">📱 PayMe</a>`,
      L.fps && `<button class="paybtn" type="button" data-copy="${esc(L.fps)}">⚡ Copy FPS ID</button>`,
      L.bank && `<button class="paybtn" type="button" data-copy="${esc(L.bank)}">🌍 Copy bank details</button>`,
    ].filter(Boolean);
    return btns.length ? `<div class="paybtns">${btns.join("")}</div>`
      : `<p class="cc-split muted">Payment links coming soon. ${esc(data.payTo)}'s PayPal, FPS and bank details will appear here as one-tap buttons.</p>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    (navigator.clipboard?.writeText(b.dataset.copy) || Promise.reject()).then(() => { b.textContent = "Copied ✓"; }, () => prompt("Copy this:", b.dataset.copy));
  });

  function settle(bal) {
    const owe = Object.entries(bal).filter(([, v]) => v < -0.5).sort((a, b) => a[1] - b[1]);
    const get = Object.entries(bal).filter(([, v]) => v > 0.5);
    if (!owe.length) return `<p class="muted">Nothing to settle yet. Once bills are in, this shows exactly who owes what, like Tricount.</p>`;
    return `<p>${get.map(([n, v]) => `<b>${esc(n)}</b> is owed ${hk(v)}`).join(" · ")}</p>
      <ul class="cc-owes">${owe.map(([n, v]) => `<li class="${n === me ? "me" : ""}"><span>${esc(n)}</span><b>${hk(-v)}</b></li>`).join("")}</ul>`;
  }

  // Everyone × every event, with each person's total: the "who owes what" sheet
  const SHORT = { "sun-dimsum": "Sun dim sum", "mon-hotpot": "Mon hotpot", "wed-tram": "Wed tram", "thu-dpd": "Thu dai pai dong", "thu-duck": "Thu duck" };
  function overview(evs) {
    const ppl = people();
    const tot = (n) => evs.reduce((t, [, e]) => t + (e.going.includes(n) ? each(e) || 0 : 0), 0);
    const grand = evs.reduce((t, [, e]) => t + total(e), 0);
    return `<details class="cc-all"><summary>📋 Full list: who's going to what</summary>
      <div class="cc-scroll"><table>
        <thead><tr><th>Name</th>${evs.map(([id, e]) => `<th>${esc(SHORT[id] || e.title)}</th>`).join("")}<th>Share</th></tr></thead>
        <tbody>${ppl.map((n) => `<tr class="${n === me ? "me" : ""}"><td>${esc(n)}</td>${evs.map(([, e]) => `<td>${e.going.includes(n) ? "✓" : ""}</td>`).join("")}<td>${tot(n) ? hk(tot(n)) : "–"}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td>${ppl.length} people</td>${evs.map(([, e]) => `<td>${e.going.length}<br><small>${total(e) ? hk(total(e)) : "bill after"}</small></td>`).join("")}<td>${grand ? hk(grand) : "–"}</td></tr></tfoot>
      </table></div>
      <button type="button" class="cc-csv" id="cc-csv">Copy as spreadsheet (CSV)</button>
    </details>`;
  }
  document.addEventListener("click", (e) => {
    if (e.target.id !== "cc-csv" || !data) return;
    const evs = Object.entries(data.events);
    const rows = [["Name", ...evs.map(([id, ev]) => SHORT[id] || ev.title), "Share (HKD)"]];
    people().forEach((n) => rows.push([n, ...evs.map(([, ev]) => (ev.going.includes(n) ? "1" : "")), Math.round(evs.reduce((t, [, ev]) => t + (ev.going.includes(n) ? each(ev) || 0 : 0), 0)) || ""]));
    rows.push(["Bill HKD", ...evs.map(([, ev]) => total(ev) || ""), ""]);
    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    (navigator.clipboard?.writeText(csv) || Promise.reject()).then(() => { e.target.textContent = "Copied ✓ Paste into Sheets or Excel"; }, () => prompt("Copy this:", csv));
  });

  // the week plan shows a one-line summary under each booked event
  function fillPlan() {
    document.querySelectorAll("[data-evinfo]").forEach((el) => {
      const e = data && data.events[el.dataset.evinfo];
      if (!e) { el.innerHTML = data ? "" : `<button class="evlock" data-cclink="1">🔒 Who's going</button>`; return; }
      const p = each(e);
      el.innerHTML = `<button class="evlock open" data-cclink="${el.dataset.evinfo}">👥 ${e.going.length} going${e.going.includes(me) ? " · ✓ you" : ""} · ${p ? `${hk(p)} each` : "split evenly after"}</button>`;
    });
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cclink]");
    if (!b) return;
    const d = document.getElementById(`ev-${b.dataset.cclink}`);
    if (d) d.open = true;
    (d || root).scrollIntoView({ behavior: "smooth", block: "center" });
    if (!d) setTimeout(() => $("#cc-pass")?.focus(), 400);
  });
  window.HK_PRIVATE_RENDER = fillPlan;

  render();
  const saved = get("hk-pass-v1");
  if (saved) unlock(saved, true);
})();
