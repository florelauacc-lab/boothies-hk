// Shared class list: who's going to what, bills, extra events. Stored in Upstash Redis (Vercel Marketplace).
// Every request must carry the class passcode; the server checks it against a hash kept in an env var,
// so names and money never leave the database without it.
import { createHash, randomBytes } from "node:crypto";

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PASS_HASH = process.env.CLASS_PASS_SHA256;
// a second, organiser-only code (Florence and Rienno): payment details and confirming money received
const ORG_HASH = process.env.ORGANISER_PASS_SHA256;
// key prefix: production has the real list; previews and local testing use their own keys
const P = process.env.VERCEL_ENV === "production" ? "c1:" : "dev1:";

async function redis(cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).map((x) => {
    if (x.error) throw new Error(x.error);
    return x.result;
  });
}
const sha = (s) => createHash("sha256").update(String(s || "").trim().toLowerCase()).digest("hex");
const id = () => randomBytes(5).toString("hex");
const clean = (s, n = 80) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const pairs = (arr) => { const o = {}; for (let i = 0; i < (arr || []).length; i += 2) o[arr[i]] = arr[i + 1]; return o; };

async function state(org) {
  const [meta, events, settle, bills, profiles, xfers] = await redis([["GET", `${P}meta`], ["HGETALL", `${P}events`], ["HGETALL", `${P}settle`],
    ["HGETALL", `${P}bills`], ["HGETALL", `${P}profiles`], ["HGETALL", `${P}xfers`]]);
  const ev = Object.entries(pairs(events)).map(([k, v]) => ({ id: k, ...JSON.parse(v) }));
  const res = ev.length ? await redis(ev.flatMap((e) => [["SMEMBERS", `${P}going:${e.id}`], ["HGETALL", `${P}exp:${e.id}`]])) : [];
  ev.forEach((e, i) => {
    e.going = (res[2 * i] || []).sort((a, b) => a.localeCompare(b));
    e.expenses = Object.entries(pairs(res[2 * i + 1])).map(([k, v]) => ({ id: k, ...JSON.parse(v) }));
  });
  ev.sort((a, b) => (a.iso || "").localeCompare(b.iso || "") || (a.order ?? 50) - (b.order ?? 50) || (a.created || 0) - (b.created || 0));
  const m = meta ? JSON.parse(meta) : null;
  const st = Object.fromEntries(Object.entries(pairs(settle)).map(([k, v]) => [k, JSON.parse(v)]));
  const list = (h) => Object.entries(pairs(h)).map(([k, v]) => ({ id: k, ...JSON.parse(v) })).sort((a, b) => (a.at || 0) - (b.at || 0));
  // people's own payment details; the PIN hash never leaves the server
  const prof = Object.fromEntries(Object.entries(pairs(profiles)).map(([k, v]) => { const { pinHash, ...rest } = JSON.parse(v); return [k, { ...rest, locked: !!pinHash }]; }));
  return { seeded: !!m, ...(m || {}), events: ev, settle: st, bills: list(bills), profiles: prof, xfers: list(xfers), organiser: !!org };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  if (!URL_ || !TOKEN || !PASS_HASH) return res.status(503).json({ error: "not configured" });
  if (sha(req.headers["x-class-pass"]) !== PASS_HASH) return res.status(401).json({ error: "wrong passcode" });
  try {
    const org = !!ORG_HASH && sha(req.headers["x-organiser-pass"]) === ORG_HASH;
    if (req.method === "GET") return res.status(200).json(await state(org));
    if (req.method !== "POST") return res.status(405).end();
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    if (["setPay", "setInfo", "confirmPaid", "unconfirmPaid"].includes(b.op) && !org) return res.status(403).json({ error: "organisers only" });
    if (b.op === "markPaid" && b.confirmed && !org) return res.status(403).json({ error: "organisers only" });
    const by = clean(b.by, 60);
    const ev = clean(b.ev, 40);
    switch (b.op) {
      case "seed": { // first load only: roster, payment info and the poll results
        const [has] = await redis([["EXISTS", `${P}meta`]]);
        if (has && !b.force) return res.status(409).json({ error: "already seeded" });
        const d = b.data || {};
        const cmds = [["SET", `${P}meta`, JSON.stringify({ payTo: d.payTo, payNote: d.payNote, methods: d.methods, payLinks: d.payLinks || {}, groups: d.groups, groupsNote: d.groupsNote, extra: d.extra || [] })]];
        Object.entries(d.events || {}).forEach(([k, e], i) => {
          cmds.push(["HSET", `${P}events`, k, JSON.stringify({ title: e.title, when: e.when, venue: e.venue, iso: e.iso, order: i, created: Date.now() })]);
          if (e.going?.length) cmds.push(["SADD", `${P}going:${k}`, ...e.going]);
        });
        await redis(cmds);
        break;
      }
      case "toggle": {
        const name = clean(b.name, 60);
        if (!ev || !name) return res.status(400).json({ error: "missing" });
        await redis([[b.on ? "SADD" : "SREM", `${P}going:${ev}`, name]]);
        break;
      }
      case "addEvent": {
        const title = clean(b.title, 70);
        if (!title) return res.status(400).json({ error: "missing title" });
        const k = `x-${id()}`;
        await redis([["HSET", `${P}events`, k, JSON.stringify({ title, when: clean(b.when, 50), venue: clean(b.venue, 80), iso: clean(b.iso, 10), order: 90, created: Date.now(), by })]]);
        if (by) await redis([["SADD", `${P}going:${k}`, by]]);
        break;
      }
      case "editEvent": {
        const [cur] = await redis([["HGET", `${P}events`, ev]]);
        if (!cur) return res.status(404).json({ error: "no event" });
        const e = JSON.parse(cur);
        ["title", "when", "venue"].forEach((f) => { if (b[f] != null) e[f] = clean(b[f], f === "venue" ? 80 : 70); });
        await redis([["HSET", `${P}events`, ev, JSON.stringify(e)]]);
        break;
      }
      case "setPrice": { // fixed price per person, so nobody owes more (or gets refunds) when people join or drop
        const [cur] = await redis([["HGET", `${P}events`, ev]]);
        if (!cur) return res.status(404).json({ error: "no event" });
        const e = JSON.parse(cur);
        // organisers enter the total bill; it's split by the number ticked and then fixed per person
        const total = b.total != null ? Math.round(+b.total) : null, count = Math.round(+b.count) || 0;
        const price = total === 0 ? 0 : total && count ? Math.round(total / count) : Math.round(+b.price || 0); // a total of 0 clears it
        if (!(price >= 0) || price > 100000 || (total != null && !(total >= 0))) return res.status(400).json({ error: "bad amount" });
        e.price = price || null; e.priceBy = by;
        if (total != null) { e.total = total || null; e.priceCount = count || null; }
        await redis([["HSET", `${P}events`, ev, JSON.stringify(e)]]);
        break;
      }
      /* ---- table bookings (e.g. 20:15 for 8, 20:30 for 9) ---- */
      case "addTable": case "editTable": case "delTable": case "seat": {
        const [cur] = await redis([["HGET", `${P}events`, ev]]);
        if (!cur) return res.status(404).json({ error: "no event" });
        const e = JSON.parse(cur);
        e.tables = e.tables || [];
        if (b.op === "addTable") {
          const size = Math.round(+b.size) || null;
          e.tables.push({ id: id(), time: clean(b.time, 20), size, label: clean(b.label, 40), names: [] });
          e.tables.sort((a, c) => (a.time || "").localeCompare(c.time || ""));
        } else {
          const t = e.tables.find((x) => x.id === clean(b.table, 20));
          if (!t && b.op !== "seat") return res.status(404).json({ error: "no table" });
          if (b.op === "editTable") { if (b.time != null) t.time = clean(b.time, 20); if (b.size != null) t.size = Math.round(+b.size) || null; if (b.label != null) t.label = clean(b.label, 40); }
          if (b.op === "delTable") e.tables = e.tables.filter((x) => x !== t);
          if (b.op === "seat") { // one table per person: seating someone moves them
            const name = clean(b.name, 60);
            e.tables.forEach((x) => { x.names = (x.names || []).filter((n) => n !== name); });
            if (t && b.on) t.names.push(name);
          }
        }
        await redis([["HSET", `${P}events`, ev, JSON.stringify(e)]]);
        break;
      }
      case "delEvent":
        await redis([["HDEL", `${P}events`, ev], ["DEL", `${P}going:${ev}`], ["DEL", `${P}exp:${ev}`]]);
        break;
      case "addExpense": {
        const hkd = Math.round(+b.hkd * 100) / 100;
        if (!ev || !(hkd > 0) || hkd > 1e6) return res.status(400).json({ error: "bad amount" });
        await redis([["HSET", `${P}exp:${ev}`, id(), JSON.stringify({ what: clean(b.what, 40) || "Bill", paidBy: clean(b.paidBy, 60) || "Rienno", hkd, by, at: Date.now() })]]);
        break;
      }
      case "delExpense":
        await redis([["HDEL", `${P}exp:${ev}`, clean(b.xid, 20)]]);
        break;
      case "addPerson": {
        const name = clean(b.name, 60);
        if (!name) return res.status(400).json({ error: "missing" });
        const [cur] = await redis([["GET", `${P}meta`]]);
        const m = JSON.parse(cur || "{}");
        m.extra = [...new Set([...(m.extra || []), name])];
        await redis([["SET", `${P}meta`, JSON.stringify(m)]]);
        break;
      }
      case "setInfo": { // organisers: payment wording shown to everyone
        const [cur] = await redis([["GET", `${P}meta`]]);
        const m = JSON.parse(cur || "{}");
        if (b.payNote != null) m.payNote = clean(b.payNote, 300);
        if (Array.isArray(b.methods)) m.methods = b.methods.slice(0, 8).map((x) => [clean(x[0], 4), clean(x[1], 40), clean(x[2], 200)]);
        await redis([["SET", `${P}meta`, JSON.stringify(m)]]);
        break;
      }
      case "setPay": {
        const [cur] = await redis([["GET", `${P}meta`]]);
        const m = JSON.parse(cur || "{}");
        m.payLinks = { ...(m.payLinks || {}) };
        ["paypal", "payme", "fps", "bank", "accName", "bankName", "accNo", "swift", "wechat"].forEach((k) => { if (b[k] != null) m.payLinks[k] = clean(b[k], 200) || null; });
        if (m.payLinks.paypal && !/^https:\/\/(www\.)?paypal\.me\//i.test(m.payLinks.paypal)) return res.status(400).json({ error: "PayPal link must start with https://paypal.me/" });
        if (m.payLinks.payme && !/^https:\/\/(payme\.hsbc|pay\.payme)\./i.test(m.payLinks.payme)) return res.status(400).json({ error: "PayMe link must be an HSBC PayMe link" });
        await redis([["SET", `${P}meta`, JSON.stringify(m)]]);
        break;
      }
      // settling up: the payer marks "I've paid", the collector (Rienno) confirms they received it
      case "markPaid": {
        const name = clean(b.name, 60), hkd = Math.round(+b.hkd);
        if (!name || !(hkd > 0)) return res.status(400).json({ error: "missing" });
        const [cur] = await redis([["HGET", `${P}settle`, name]]);
        const prev = cur ? JSON.parse(cur) : { payments: [] };
        // a classmate's "I've paid" is a heads-up; only the organiser (Rienno) can record a payment as received
        const confirmed = !!(org && b.confirmed);
        const evs = Array.isArray(b.evs) ? b.evs.slice(0, 20).map((x) => clean(x, 40)).filter(Boolean) : [];
        prev.payments = [...(prev.payments || []), { hkd, evs, method: clean(b.method, 30), at: Date.now(), confirmed, confirmedBy: confirmed ? by : undefined }];
        await redis([["HSET", `${P}settle`, name, JSON.stringify(prev)]]);
        break;
      }
      case "undoPaidEv": { // take one event out of an unconfirmed payment (e.g. "Everything" paid, one by mistake)
        const name = clean(b.name, 60), evId = clean(b.ev, 40), amt = Math.round(+b.hkd) || 0;
        const [cur] = await redis([["HGET", `${P}settle`, name]]);
        if (!cur) return res.status(404).json({ error: "no payment" });
        const prev = JSON.parse(cur);
        const i = (prev.payments || []).findIndex((p) => !p.confirmed && (p.evs || []).includes(evId));
        if (i < 0) return res.status(404).json({ error: "Rienno has already confirmed this one, so ask him to undo it" });
        const p = prev.payments[i];
        p.evs = p.evs.filter((x) => x !== evId);
        p.hkd = Math.max(0, p.hkd - amt);
        if (!p.evs.length || p.hkd <= 0) prev.payments.splice(i, 1);
        await redis([["HSET", `${P}settle`, name, JSON.stringify(prev)]]);
        break;
      }
      case "confirmPaid": case "unconfirmPaid": case "undoPaid": {
        const name = clean(b.name, 60), i = +b.i;
        const [cur] = await redis([["HGET", `${P}settle`, name]]);
        if (!cur) return res.status(404).json({ error: "no payment" });
        const prev = JSON.parse(cur);
        if (!prev.payments?.[i]) return res.status(404).json({ error: "no payment" });
        if (b.op === "undoPaid") {
          if (prev.payments[i].confirmed && !org) return res.status(403).json({ error: "Rienno has already confirmed this payment" });
          prev.payments.splice(i, 1);
        }
        else { prev.payments[i].confirmed = b.op === "confirmPaid"; prev.payments[i].confirmedBy = by; }
        await redis([["HSET", `${P}settle`, name, JSON.stringify(prev)]]);
        break;
      }
      /* ---- splitting bills between anyone (dinners by table, own events) ---- */
      case "addBill": {
        const hkd = Math.round(+b.hkd * 100) / 100, among = [...new Set((b.among || []).map((n) => clean(n, 60)).filter(Boolean))].slice(0, 80);
        const paidBy = clean(b.paidBy, 60);
        if (!(hkd > 0) || hkd > 1e6 || !paidBy || !among.length) return res.status(400).json({ error: "Add the total, who paid and who it's split between" });
        // shares: equal by default, or custom amounts per person that must add up to the total
        let shares = null;
        if (b.shares && typeof b.shares === "object") {
          shares = Object.fromEntries(among.map((n) => [n, Math.round((+b.shares[n] || 0) * 100) / 100]));
          const sum = Object.values(shares).reduce((t, x) => t + x, 0);
          if (Math.abs(sum - hkd) > 1) return res.status(400).json({ error: `The amounts add up to HK$${Math.round(sum)}, not HK$${Math.round(hkd)}` });
        }
        await redis([["HSET", `${P}bills`, `b-${id()}`, JSON.stringify({ what: clean(b.what, 60) || "Bill", ev: clean(b.ev, 40) || null, paidBy, hkd, among, shares, by, at: Date.now() })]]);
        break;
      }
      case "delBill":
        await redis([["HDEL", `${P}bills`, clean(b.id, 20)]]);
        break;
      case "setProfile": { // your own payment details, optionally locked with a PIN
        const name = clean(b.name, 60);
        if (!name) return res.status(400).json({ error: "missing name" });
        const [cur] = await redis([["HGET", `${P}profiles`, name]]);
        const prevP = cur ? JSON.parse(cur) : {};
        if (prevP.pinHash && !org && sha(`${name}|${b.pin || ""}`) !== prevP.pinHash) return res.status(403).json({ error: "Wrong PIN for these payment details" });
        const url = (v) => { const u = clean(v, 200); return !u ? "" : /^https:\/\//i.test(u) ? u : null; };
        const paypal = url(b.paypal), wise = url(b.wiseLink);
        if (paypal === null || wise === null) return res.status(400).json({ error: "Links must start with https://" });
        const next = { paypal, fps: clean(b.fps, 60), bank: clean(b.bank, 160), accName: clean(b.accName, 80), bankName: clean(b.bankName, 80), accNo: clean(b.accNo, 40), swift: clean(b.swift, 20), wechat: clean(b.wechat, 60),
          wiseLink: wise, cash: !!b.cash, note: clean(b.note, 120), pinHash: prevP.pinHash || null };
        if (b.newPin) next.pinHash = sha(`${name}|${clean(b.newPin, 12)}`);
        await redis([["HSET", `${P}profiles`, name, JSON.stringify(next)]]);
        break;
      }
      case "markXfer": { // "I've paid X" for a bill split; X confirms when it arrives
        const from = clean(b.from, 60), to = clean(b.to, 60), hkd = Math.round(+b.hkd);
        if (!from || !to || from === to || !(hkd > 0)) return res.status(400).json({ error: "missing" });
        await redis([["HSET", `${P}xfers`, `t-${id()}`, JSON.stringify({ from, to, hkd, method: clean(b.method, 30), by, at: Date.now(), confirmed: false })]]);
        break;
      }
      case "confirmXfer": case "unconfirmXfer": case "undoXfer": {
        const k = clean(b.id, 20);
        const [cur] = await redis([["HGET", `${P}xfers`, k]]);
        if (!cur) return res.status(404).json({ error: "no payment" });
        const x = JSON.parse(cur);
        if (b.op === "undoXfer") {
          if (x.confirmed && !org) return res.status(403).json({ error: `${x.to} has already confirmed it` });
          await redis([["HDEL", `${P}xfers`, k]]);
        } else {
          x.confirmed = b.op === "confirmXfer"; x.confirmedBy = by;
          await redis([["HSET", `${P}xfers`, k, JSON.stringify(x)]]);
        }
        break;
      }
      default:
        return res.status(400).json({ error: "unknown op" });
    }
    return res.status(200).json(await state(org));
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 120) });
  }
}
