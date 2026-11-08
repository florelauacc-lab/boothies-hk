// Encrypts tools/private/private.json with the class passcode (tools/private/passcode.txt) into private.enc.js.
// Only the encrypted file is published; the site decrypts it in the browser once someone types the passcode.
// Usage: node tools/build_private.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";

const root = new URL("..", import.meta.url);
const pass = readFileSync(new URL("tools/private/passcode.txt", root), "utf8").trim().toLowerCase();
const data = JSON.parse(readFileSync(new URL("tools/private/private.json", root), "utf8"));
delete data._readme;

const ITER = 250000;
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data))));
const b64 = (u) => Buffer.from(u).toString("base64");
writeFileSync(new URL("private.enc.js", root), `window.HK_LOCKED = ${JSON.stringify({ v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) })};\n`);
console.log(`wrote private.enc.js (${Object.keys(data.events).length} events, ${data.groups.length} study groups)`);
