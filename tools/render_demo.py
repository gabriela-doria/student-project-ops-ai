"""Render the Drive Map web app locally with fictitious data and save a screenshot.

No Google account is needed: the Apps Script template tag is replaced with the
sample tree, and google.script.run is stubbed.

Usage:
    pip install -r requirements.txt && playwright install chromium
    python tools/render_demo.py
Outputs:
    sample-data/fake-drive-tree.json
    docs/images/drive-map-demo.png   (metadata stripped)
"""
import json
import pathlib
import tempfile

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
FOLDER = "application/vnd.google-apps.folder"
MIME = {
    "doc": "application/vnd.google-apps.document",
    "sheet": "application/vnd.google-apps.spreadsheet",
    "slides": "application/vnd.google-apps.presentation",
    "form": "application/vnd.google-apps.form",
    "pdf": "application/pdf",
    "png": "image/png",
    "mp4": "video/mp4",
}

# Fictitious structure (numbered ranges, reserved range left for growth).
TREE = {
    "00-09 Start here": {
        "00 Read me": ["Quick guide to this Drive.doc", "Naming rules.pdf"],
        "01 Inbox": ["Untitled notes.doc"],
        "02 Templates": ["Document template.doc", "Data sheet template.sheet", "Feedback form.form"],
    },
    "10-19 Team operations": {
        "11 Calendar and schedule": ["Activity calendar.sheet"],
        "12 Meeting notes": ["Weekly notes.doc"],
    },
    "20-29 Research": {
        "21 Research plan": ["Plan overview.doc"],
        "22 Data": ["Dataset - round 1.sheet", "Dataset - round 2.sheet"],
        "23 Photos": ["Photo 01.png", "Photo 02.png"],
    },
    "30-39 Workstream B": {"31 Progress log": ["Progress log.doc", "Recap video.mp4"]},
    "40-49 Outreach": {"41 Social posts": ["Post calendar.sheet"], "42 Printed material": ["Leaflet.pdf"]},
    "50-59 Events and partners": {"51 Talks": ["Talk schedule.sheet", "Speaker brief.doc"]},
    "60-69 Results and reports": {"61 Annual report": ["Annual report.pdf", "Results deck.slides"]},
}


def build():
    items, n = [], [0]

    def nid():
        n[0] += 1
        return f"fake-{n[0]:03d}"

    def add(name, mime, parent, day):
        i = nid()
        items.append({"i": i, "n": name, "t": mime, "p": parent, "m": f"2025-03-{day:02d}T12:00:00Z"})
        return i

    def walk(node, parent, depth):
        for k, (name, child) in enumerate(node.items()):
            fid = add(name, FOLDER, parent, 1 + (k + depth) % 27)
            if isinstance(child, dict):
                walk(child, fid, depth + 1)
            else:
                for j, f in enumerate(child):
                    stem, ext = f.rsplit(".", 1)
                    add(f"{stem}.{ext}" if ext in ("pdf", "png", "mp4") else stem, MIME[ext], fid, 1 + (j + k) % 27)

    walk(TREE, "fake-root", 0)
    return {"root": {"i": "fake-root", "n": "Example Project Drive"}, "items": items, "builtAt": 1741780800000}


def main():
    data = build()
    (ROOT / "sample-data" / "fake-drive-tree.json").write_text(json.dumps(data, indent=1), encoding="utf-8")

    html = (ROOT / "apps-script" / "drive-map-webapp" / "Index.html").read_text(encoding="utf-8")
    html = html.replace("<?!= bootJson ?>", json.dumps(data).replace("<", "\\u003c"))
    stub = "<script>window.google={script:{run:{withSuccessHandler(){return this},withFailureHandler(){return this},getTree(){}}}};</script>"
    html = html.replace("<head>", "<head>" + stub, 1)

    out = ROOT / "docs" / "images" / "drive-map-demo.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        page_path = pathlib.Path(tmp) / "index.html"
        page_path.write_text(html, encoding="utf-8")
        raw = pathlib.Path(tmp) / "raw.png"
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 960, "height": 860}, locale="en-US", timezone_id="UTC")
            page.goto(page_path.as_uri())
            # Open the first three top-level branches so the screenshot shows depth.
            for b in page.query_selector_all("#tree > ul > li > .row .arrow")[:3]:
                b.click()
            for label in ("Expand 02 Templates", "Expand 22 Data"):
                page.click(f'button[aria-label="{label}"]')
            page.wait_for_timeout(400)  # let the arrow rotation finish
            page.screenshot(path=str(raw), full_page=True)
            browser.close()
        # Re-encode pixels only, so no metadata chunk survives.
        img = Image.open(raw).convert("RGB")
        clean = Image.frombytes("RGB", img.size, img.tobytes())
        clean.save(out, format="PNG", optimize=True)
    print("wrote", out)


if __name__ == "__main__":
    main()
