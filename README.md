# Boothies in HK · Becker Section guide

An interactive map guide for Chicago Booth EMBA classmates in Hong Kong (14–22 Nov 2026), covering food and drinks near the Booth campus in Sai Wan, a first-timer's checklist, sights, hikes and shopping.

It's a plain static site (no build step): `index.html`, `styles.css`, `app.js`, `data.js`.

## Run locally

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## Update the places

`data.js` is generated. Edit `tools/extras.json` (week plan, tips, essentials, hand-added places) or the research JSON files, then run:

```bash
python3 -I tools/build_data.py tools/research
```

## Deploy on Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New → Project**, import the repository, and keep the defaults (Framework preset: **Other**, no build command, output directory `.`).
3. Every push to `main` redeploys automatically.
