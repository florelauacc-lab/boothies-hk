// Local test server: serves the site and runs api/class.js like Vercel does (test keys only, never production).
// Usage: node tools/dev_server.mjs  (reads .env.local from `vercel env pull`)
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
for (const line of (existsSync(join(root, ".env.local")) ? readFileSync(join(root, ".env.local"), "utf8") : "").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
process.env.VERCEL_ENV = "development";
const PORT = +(process.argv[2] || 4180);
if (process.argv[3]) process.env.CLASS_PREFIX = `${process.argv[3]}:`; // e.g. a throwaway demo list
const { default: handler } = await import(pathToFileURL(join(root, "api/class.js")).href);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/class") {
    let body = "";
    for await (const c of req) body += c;
    req.body = body ? JSON.parse(body) : {};
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
    return handler(req, res);
  }
  const p = normalize(join(root, url.pathname === "/" ? "index.html" : url.pathname));
  if (!p.startsWith(root) || /\/(tools|\.env|\.vercel|api)\b/.test(p.slice(root.length)) || !existsSync(p) || statSync(p).isDirectory()) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("Content-Type", TYPES[extname(p)] || "application/octet-stream");
  res.end(readFileSync(p));
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
