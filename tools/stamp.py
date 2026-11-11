"""Add a content hash to the site's own files in index.html (app.js?v=1a2b3c4d), so phones and in-app
browsers always fetch the new version after a deploy instead of a copy they saved earlier.
Run after changing any of them (build_data.py runs it too): python3 -I tools/stamp.py"""
import hashlib, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = ["styles.css", "data.js", "app.js", "private.enc.js", "class.js"]

def stamp():
    idx = ROOT / "index.html"
    html = idx.read_text()
    for f in FILES:
        v = hashlib.sha1((ROOT / f).read_bytes()).hexdigest()[:8]
        html = re.sub(r'((?:src|href)=")' + re.escape(f) + r'(\?v=[0-9a-f]*)?"', lambda m: f'{m.group(1)}{f}?v={v}"', html)
    idx.write_text(html)
    print("stamped index.html")

if __name__ == "__main__":
    stamp()
