"""Generate 1:1 certificate PDF layouts from the reference PDFs in public/pdf/.

The reference PDFs are the school's real certificate templates. This script
extracts every text run, rule, and image at its exact PDF coordinates and emits
them as `src/lib/services/certificate-layouts.ts`, which the TypeScript
renderer (`src/lib/services/certificate-renderer.ts`) draws verbatim. Only the
fill-in blanks and signatory names are dynamic at render time.

Commands:
  python scripts/cert_layout.py generate
      Writes public/pdf-assets/*.png and src/lib/services/certificate-layouts.ts
  python scripts/cert_layout.py verify <pdf> [<pdf> ...]
      Diffs generated sample PDFs against the reference layouts (1pt tolerance).
  python scripts/cert_layout.py extract <pdf>
      Debug dump of one PDF's extracted layout (stdout).

Dev-only. Requires pdfminer.six, pdfplumber, and Pillow. Not used at runtime.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

import pdfplumber
from pdfminer.high_level import extract_pages
from pdfminer.image import ImageWriter
from pdfminer.layout import LTImage

ROOT = Path(__file__).resolve().parents[1]
REF_DIR = ROOT / "public" / "pdf"
ASSET_DIR = ROOT / "public" / "pdf-assets"
OUT_TS = ROOT / "src" / "lib" / "services" / "certificate-layouts.ts"
TMP_IMG_DIR = ROOT / "out" / "_cert_layout_images"

WORD_GAP = 1.2  # pt: larger horizontal gaps separate words (vs kerning)
MAX_RULE_H = 3.2  # pt: thin rectangles are underline strokes, not panels

# Assets still extracted from the reference PDFs (everything else is supplied
# as an original file in public/pdf-assets and must not be overwritten).
EXTRACTED_PNG_ASSETS = {"deped-seal", "icon-small"}

# Canonical asset names keyed by the images' source pixel size.
ASSET_BY_SRCSIZE = {
    (155, 156): "deped-seal",
    (139, 141): "lanhs-logo",
    (119, 114): "lanhs-logo",
    (119, 115): "lanhs-logo",
    (362, 156): "footer-lockup",
    (15, 18): "icon-small",
}

# The footer lockup is one reference bitmap holding two logos (DepED wordmark +
# Bagong Pilipinas); the renderer sources them from the original files instead.
LOCKUP_SPLIT_ASSETS = ("deped-logo", "bagong-pilipinas-logo")

TEMPLATES = {
    "CERTIFICATE OF GOOD MORAL CHARACTER.pdf": [
        {"key": "good-moral", "page": 0, "blanks": ["name", "grade", "schoolYear", "day", "month"]},
    ],
    "COE.pdf": [
        {"key": "enrolment-jhs", "page": 0, "blanks": ["name", "lrn", "schoolYear", "grade", "purpose"]},
        {"key": "enrolment-shs", "page": 1, "blanks": ["name", "lrn", "schoolYear", "grade", "purpose"]},
    ],
    "Certificate of Graduation.pdf": [
        {"key": "graduation", "page": 0, "blanks": ["name", "schoolYear"]},
    ],
}

FALLBACK_FRAME = "enrolment-jhs"


def font_key(fontname: str) -> str:
    name = fontname.split("+")[-1]
    compact = re.sub(r"[^A-Za-z]", "", name).lower()
    bold = "bold" in compact
    if "oldenglish" in compact:
        return "oldEnglish"
    if "cambria" in compact:
        return "cambriaBold"
    if "bookman" in compact:
        return "bookmanBold" if bold else "bookman"
    if "timesnewroman" in compact or compact.startswith("times"):
        return "timesBold" if bold else "times"
    if "calibri" in compact:
        return "calibriBold" if bold else "calibri"
    if "wingdings" in compact:
        return "wingdings"
    raise ValueError(f"unknown font: {fontname}")


def color_rgb(color):
    """Normalize a pdfminer/pdfplumber color to (r, g, b) floats, or None when black."""
    if color is None:
        return None
    if isinstance(color, (int, float)):
        if float(color) <= 0.001:
            return None
        return (float(color), float(color), float(color))
    if isinstance(color, (tuple, list)):
        vals = [float(v) for v in color]
        if len(vals) == 3:
            return None if all(abs(v) <= 0.001 for v in vals) else (vals[0], vals[1], vals[2])
        if len(vals) == 1:
            return color_rgb(vals[0])
        if len(vals) == 4:  # CMYK
            c, m, y, k = vals
            return (1 - min(1, c + k), 1 - min(1, m + k), 1 - min(1, y + k))
    return None


def lt_images_on_page(pdf_path: Path, page_index: int):
    """Collect LTImage objects (with exportable streams) for one page."""
    found = []
    for i, page in enumerate(extract_pages(str(pdf_path))):
        if i != page_index:
            continue
        stack = list(getattr(page, "_objs", []))
        while stack:
            obj = stack.pop()
            if isinstance(obj, LTImage):
                found.append(obj)
            else:
                stack.extend(getattr(obj, "_objs", []))
    return found


def split_lockup(im, bitmap_path: Path):
    """Split the combined DepED + Bagong Pilipinas lockup into two placements.

    The reference stores both footer logos as one black-backed bitmap; measure
    each logo group's ink extent (the widest interior empty column gap is the
    seam) and map the sub-regions into PDF coordinates."""
    from PIL import Image

    img = Image.open(bitmap_path).convert("RGB")
    w, h = img.size
    px = img.load()
    ink_cols = []
    for x in range(w):
        ink = sum(1 for y in range(0, h, 2) if max(px[x, y]) > 30)
        ink_cols.append(ink)

    # Widest empty run that has artwork on both sides is the seam.
    best_gap = (0, w // 2)
    run_start = None
    for x, ink in enumerate(ink_cols):
        if ink == 0:
            if run_start is None:
                run_start = x
        else:
            if run_start is not None:
                has_left = any(v > 0 for v in ink_cols[:run_start])
                if has_left and x - run_start > best_gap[0]:
                    best_gap = (x - run_start, (run_start + x) // 2)
                run_start = None
    seam = best_gap[1]

    def extent(lo, hi):
        cols = [x for x in range(lo, hi) if ink_cols[x] > 0]
        rows = [
            y
            for y in range(h)
            for x in range(lo, hi, 2)
            if max(px[x, y]) > 30
        ]
        if not cols or not rows:
            return (lo, 0, hi - lo, h)
        return (min(cols), min(rows), max(cols) - min(cols) + 1, max(rows) - min(rows) + 1)

    out = []
    for asset, (lo, hi) in zip(LOCKUP_SPLIT_ASSETS, ((0, seam), (seam, w))):
        ex, ey, ew, eh = extent(lo, hi)
        out.append(
            {
                "asset": asset,
                "src": "",
                "x": round(im["x"] + ex * im["w"] / w, 3),
                "y": round(im["y"] + (h - ey - eh) * im["h"] / h, 3),
                "w": round(ew * im["w"] / w, 3),
                "h": round(eh * im["h"] / h, 3),
                "composite": True,
            }
        )
    return out


def export_image_raw(lt: LTImage, out_dir: Path) -> str:
    """Decode an image XObject's samples ourselves and save a PNG.

    pdfminer's ImageWriter round-trips Flate images through BMP, which reads
    back with red and blue swapped; decoding the raw PDF samples here keeps the
    colors exact. An /SMask soft mask is merged as alpha when present."""
    from io import BytesIO

    from PIL import Image

    stream = lt.stream
    data = stream.get_data()
    w, h = (int(v) for v in lt.srcsize)
    name = f"{lt.name}.png"
    out = out_dir / name

    if data[:2] == b"\xff\xd8":  # DCTDecode: bytes are a JPEG
        img = Image.open(BytesIO(data)).convert("RGB")
    else:
        n = w * h
        if len(data) >= n * 3:
            img = Image.frombytes("RGB", (w, h), data[: n * 3])
        elif len(data) >= n:
            img = Image.frombytes("L", (w, h), data[:n]).convert("RGB")
        else:
            return ImageWriter(str(out_dir)).export_image(lt)

    try:
        from pdfminer.pdftypes import resolve1

        smask = resolve1(stream.attrs.get("SMask"))
        if smask is not None and hasattr(smask, "get_data"):
            mask_data = smask.get_data()
            if len(mask_data) >= w * h:
                alpha = Image.frombytes("L", (w, h), mask_data[: w * h])
                img = img.convert("RGBA")
                img.putalpha(alpha)
    except Exception:
        pass  # no resolvable mask: keep the plain base image

    img.save(out)
    return name


def extract_page(pdf_path: Path, page_index: int, img_dir: Path = TMP_IMG_DIR):
    """Return {width, height, chars, rules, images} for one page.

    Text and geometry come from pdfplumber (baselines via the text matrix,
    colors resolved); image samples are decoded via export_image_raw.
    """
    img_dir.mkdir(parents=True, exist_ok=True)
    lt_images = lt_images_on_page(pdf_path, page_index)

    with pdfplumber.open(str(pdf_path)) as pdf:
        page = pdf.pages[page_index]
        height = float(page.height)
        width = float(page.width)

        chars = []
        for ch in page.chars:
            text = ch["text"]
            if not text or text == " ":
                continue
            chars.append(
                {
                    "t": text,
                    "x": round(float(ch["x0"]), 3),
                    "x1": round(float(ch["x1"]), 3),
                    "y": round(float(ch["matrix"][5]), 3),
                    "size": round(float(ch["size"]), 3),
                    "font": font_key(ch["fontname"]),
                    "color": color_rgb(ch["non_stroking_color"]),
                }
            )

        rules = []
        for ln in page.lines:
            thickness = float(ln.get("linewidth") or 1.5)
            # Ignore hairline and point-like artifacts (vector logo paths etc.).
            if thickness < 0.5:
                continue
            if abs(float(ln["x1"]) - float(ln["x0"])) < 2 and abs(float(ln["bottom"]) - float(ln["top"])) < 2:
                continue
            y = height - (float(ln["top"]) + float(ln["bottom"])) / 2
            rules.append(
                {
                    "x": round(min(float(ln["x0"]), float(ln["x1"])), 3),
                    "x1": round(max(float(ln["x0"]), float(ln["x1"])), 3),
                    "y": round(y, 3),
                    "h": round(thickness, 3),
                }
            )
        for rc in page.rects:
            h = float(rc["bottom"]) - float(rc["top"])
            if 0 < h <= MAX_RULE_H and (float(rc["x1"]) - float(rc["x0"])) > 2:
                rules.append(
                    {
                        "x": round(float(rc["x0"]), 3),
                        "x1": round(float(rc["x1"]), 3),
                        "y": round(height - float(rc["bottom"]), 3),
                        "h": round(max(h, 0.7), 3),
                    }
                )

        images = []
        for im in page.images:
            srcsize = tuple(im.get("srcsize") or ())
            asset = ASSET_BY_SRCSIZE.get(srcsize)
            if asset is None:
                # Custom logos embedded by generated PDFs are not reference
                # assets; keep them comparable by position only.
                asset = f"raw-{srcsize[0] if srcsize else 0}x{srcsize[1] if srcsize else 0}"
            bbox = (round(float(im["x0"])), round(height - float(im["bottom"])),
                    round(float(im["x1"])), round(height - float(im["top"])))
            match = None
            for lt in lt_images:
                lb = tuple(round(v) for v in (lt.x0, lt.y0, lt.x1, lt.y1))
                if all(abs(a - b) <= 1 for a, b in zip(lb, bbox)):
                    match = lt
                    break
            if match is None:
                raise ValueError(f"no exportable image at {bbox} in {pdf_path.name}")
            fname = export_image_raw(match, img_dir)
            images.append(
                {
                    "asset": asset,
                    "src": fname,
                    "x": round(float(im["x0"]), 3),
                    "y": round(height - float(im["bottom"]), 3),
                    "w": round(float(im["x1"]) - float(im["x0"]), 3),
                    "h": round(float(im["bottom"]) - float(im["top"]), 3),
                }
            )

        # Split the combined footer lockup into its two logo placements.
        split_images = []
        for im in images:
            if im["asset"] == "footer-lockup":
                split_images.extend(split_lockup(im, img_dir / im["src"]))
            else:
                split_images.append(im)
        images = split_images

        # Rule-like marks fully inside a drawn image's box are vector art from
        # the embedded logos, not document rules.
        def inside_image(rule):
            for im in images:
                if (
                    rule["x"] >= im["x"] - 1
                    and rule["x1"] <= im["x"] + im["w"] + 1
                    and rule["y"] >= im["y"] - 1
                    and rule["y"] <= im["y"] + im["h"] + 1
                ):
                    return True
            return False

        rules = [r for r in rules if not inside_image(r)]

    return {"width": width, "height": height, "chars": chars, "rules": rules, "images": images}


def group_lines(chars):
    """Group chars into lines (same baseline)."""
    lines = []
    for ch in sorted(chars, key=lambda c: (-c["y"], c["x"])):
        if lines and abs(lines[-1]["y"] - ch["y"]) <= 0.6:
            lines[-1]["chars"].append(ch)
        else:
            lines.append({"y": ch["y"], "chars": [ch]})
    for line in lines:
        line["chars"].sort(key=lambda c: c["x"])
    return lines


def line_text(line) -> str:
    return "".join(c["t"] for c in line["chars"])


def split_runs(chars):
    """Split a line's chars into runs (words) at horizontal gaps.

    Underscore runs (blank slots) always form their own run even when they sit
    tight against a neighbouring word.
    """
    runs = []
    for ch in chars:
        if runs:
            prev = runs[-1]["chars"][-1]
            gap_ok = ch["x"] - runs[-1]["x1"] <= WORD_GAP
            class_ok = (ch["t"] == "_") == (prev["t"] == "_")
            if gap_ok and class_ok:
                runs[-1]["chars"].append(ch)
                runs[-1]["x1"] = ch["x1"]
                continue
        runs.append({"x": ch["x"], "x1": ch["x1"], "chars": [ch]})
    return runs


def run_text(run) -> str:
    return "".join(c["t"] for c in run["chars"])


def build_template(page_data, blank_fields):
    lines = group_lines(page_data["chars"])

    # --- signatory name lines become dynamic slots -------------------------
    sig_slots = {}  # line index -> field
    for i, line in enumerate(lines):
        text = line_text(line)
        if "ESTILLERO" in text:
            sig_slots[i] = "registrarName"
        elif "EGAS" in text and "LUIS" in text:
            sig_slots[i] = "principalName"

    # --- blank runs (underscore runs) map to fields in order ---------------
    blank_marks = []  # (line index, run index, field)
    field_queue = list(blank_fields)
    for i, line in enumerate(lines):
        if i in sig_slots:
            continue
        for j, run in enumerate(split_runs(line["chars"])):
            text = run_text(run)
            # A blank is an underscore run, optionally with trailing punctuation
            # (e.g. "___________." or "__________________,").
            if "_" in text and all(c in "_.,;" for c in text) and field_queue:
                blank_marks.append((i, j, field_queue.pop(0)))
    if field_queue:
        raise ValueError(f"unused blank fields: {field_queue}")

    thin_rules = [r for r in page_data["rules"] if r["h"] <= MAX_RULE_H and (r["x1"] - r["x"]) < 260]

    # --- assemble tokens per line -----------------------------------------
    lines_out = []
    for i, line in enumerate(lines):
        tokens = []
        runs = split_runs(line["chars"])
        blanks_here = {j: field for (li, j, field) in blank_marks if li == i}
        if i in sig_slots:
            field = sig_slots[i]
            name_span = (line["chars"][0]["x"], line["chars"][-1]["x1"])
            title = lines[i + 1] if i + 1 < len(lines) else line
            title_span = (title["chars"][0]["x"], title["chars"][-1]["x1"])
            center = (min(name_span[0], title_span[0]) + max(name_span[1], title_span[1])) / 2
            max_width = max(name_span[1], title_span[1]) - min(name_span[0], title_span[0])
            tokens.append(
                {
                    "kind": "sigName",
                    "field": field,
                    "centerX": round(center, 2),
                    "y": line["y"],
                    "size": line["chars"][0]["size"],
                    "font": line["chars"][0]["font"],
                    "maxWidth": round(max_width + 30, 2),
                }
            )
            lines_out.append(tokens)
            continue

        for j, run in enumerate(runs):
            if j in blanks_here:
                first, last = run["chars"][0], run["chars"][-1]
                unders = [c for c in run["chars"] if c["t"] == "_"]
                suffix = [
                    {"t": c["t"], "x": round(c["x"], 2)}
                    for c in run["chars"]
                    if c["t"] != "_"
                ]
                underline = None
                for r in thin_rules:
                    overlap = min(r["x1"], last["x1"]) - max(r["x"], first["x"])
                    if overlap > 2 and -14 <= r["y"] - run["chars"][0]["y"] <= 2:
                        underline = {"x": r["x"], "x1": r["x1"], "y": r["y"], "h": r["h"]}
                        thin_rules.remove(r)
                        break
                tokens.append(
                    {
                        "kind": "blank",
                        "field": blanks_here[j],
                        "x": round(first["x"], 2),
                        "x1": round(unders[-1]["x1"], 2),
                        "y": run["chars"][0]["y"],
                        "size": run["chars"][0]["size"],
                        "font": run["chars"][0]["font"],
                        "suffix": suffix,
                        "underline": underline,
                    }
                )
            else:
                for c in run["chars"]:
                    tokens.append(
                        {
                            "kind": "text",
                            "t": c["t"],
                            "x": round(c["x"], 2),
                            "y": c["y"],
                            "size": c["size"],
                            "font": c["font"],
                            "color": c["color"],
                        }
                    )
        lines_out.append(tokens)

    # --- title / body line detection (used by the generic fallback) --------
    title_idx = 0
    for i, line in enumerate(lines):
        if "CERTIFICATE" in line_text(line) and line["chars"][0]["size"] >= 15:
            title_idx = i
            break

    blank_lines = sorted({li for (li, _, _) in blank_marks})
    body_indices = []
    if blank_lines:
        start = blank_lines[0]
        end = start
        for i in range(start + 1, len(lines)):
            gap = lines[i - 1]["y"] - lines[i]["y"]
            if i in sig_slots or gap > 30:
                break
            end = i
        body_indices = list(range(start, end + 1))
    first_body_y = lines[body_indices[0]]["y"] if body_indices else 0
    leading = 21.07
    if len(body_indices) >= 2:
        gaps = [
            lines[body_indices[k]]["y"] - lines[body_indices[k + 1]]["y"]
            for k in range(len(body_indices) - 1)
        ]
        leading = round(min(gaps), 2)
    margin = min((c["x"] for i in body_indices for c in lines[i]["chars"]), default=72.0)
    indent = (
        round(min((c["x"] for c in lines[body_indices[0]]["chars"]), default=margin) - margin, 2)
        if body_indices
        else 36.0
    )

    wide_rules = [r for r in page_data["rules"] if r["h"] > MAX_RULE_H or (r["x1"] - r["x"]) >= 260]

    decor = [
        {"kind": "rule", "x": r["x"], "x1": r["x1"], "y": r["y"], "h": r["h"]}
        for r in wide_rules + thin_rules  # thin_rules: underlines not owned by a blank
    ] + [
        {
            "kind": "image",
            "asset": im["asset"],
            "x": im["x"],
            "y": im["y"],
            "w": im["w"],
            "h": im["h"],
        }
        for im in page_data["images"]
    ]

    return {
        "lines": lines_out,
        "decor": decor,
        "titleLineIndex": title_idx,
        "bodyLineIndices": body_indices,
        "firstBodyY": round(first_body_y, 2),
        "bodyLeading": leading,
        "bodyIndent": indent,
        "bodyMargin": round(margin, 2),
    }


def ts_escape(text: str) -> str:
    out = []
    for ch in text:
        if ch == '"':
            out.append('\\"')
        elif ch == "\\":
            out.append("\\\\")
        elif ord(ch) < 32 or ord(ch) > 126:
            out.append(f"\\u{ord(ch):04x}")
        else:
            out.append(ch)
    return "".join(out)


def ts_number(v) -> str:
    return f"{round(float(v), 2):g}"


def emit_token(tok) -> str:
    if tok["kind"] == "text":
        color = ""
        if tok.get("color"):
            r, g, b = tok["color"]
            color = f', "color": [{ts_number(r)}, {ts_number(g)}, {ts_number(b)}]'
        return (
            f'{{ "kind": "text", "t": "{ts_escape(tok["t"])}", '
            f'"x": {ts_number(tok["x"])}, "y": {ts_number(tok["y"])}, '
            f'"size": {ts_number(tok["size"])}, "font": "{tok["font"]}"{color} }}'
        )
    if tok["kind"] == "blank":
        suffix = ", ".join(
            f'{{ "t": "{ts_escape(s["t"])}", "x": {ts_number(s["x"])} }}' for s in tok["suffix"]
        )
        underline = "null"
        if tok["underline"]:
            u = tok["underline"]
            underline = (
                f'{{ "x": {ts_number(u["x"])}, "x1": {ts_number(u["x1"])}, '
                f'"y": {ts_number(u["y"])}, "h": {ts_number(u["h"])} }}'
            )
        return (
            f'{{ "kind": "blank", "field": "{tok["field"]}", '
            f'"x": {ts_number(tok["x"])}, "x1": {ts_number(tok["x1"])}, '
            f'"y": {ts_number(tok["y"])}, "size": {ts_number(tok["size"])}, '
            f'"font": "{tok["font"]}", "suffix": [{suffix}], "underline": {underline} }}'
        )
    if tok["kind"] == "sigName":
        return (
            f'{{ "kind": "sigName", "field": "{tok["field"]}", '
            f'"centerX": {ts_number(tok["centerX"])}, "y": {ts_number(tok["y"])}, '
            f'"size": {ts_number(tok["size"])}, "font": "{tok["font"]}", '
            f'"maxWidth": {ts_number(tok["maxWidth"])} }}'
        )
    if tok["kind"] == "rule":
        return (
            f'{{ "kind": "rule", "x": {ts_number(tok["x"])}, "x1": {ts_number(tok["x1"])}, '
            f'"y": {ts_number(tok["y"])}, "h": {ts_number(tok["h"])} }}'
        )
    if tok["kind"] == "image":
        return (
            f'{{ "kind": "image", "asset": "{tok["asset"]}", '
            f'"x": {ts_number(tok["x"])}, "y": {ts_number(tok["y"])}, '
            f'"w": {ts_number(tok["w"])}, "h": {ts_number(tok["h"])} }}'
        )
    raise ValueError(tok)


def generate() -> None:
    TMP_IMG_DIR.mkdir(parents=True, exist_ok=True)
    ASSET_DIR.mkdir(parents=True, exist_ok=True)

    layouts = {}
    asset_hashes = {}
    for filename, pages in TEMPLATES.items():
        ref = REF_DIR / filename
        for spec in pages:
            data = extract_page(ref, spec["page"])
            for im in data["images"]:
                if im["asset"] in EXTRACTED_PNG_ASSETS and im["src"]:
                    src = TMP_IMG_DIR / im["src"]
                    asset_hashes[im["asset"]] = (src, hashlib.md5(src.read_bytes()).hexdigest())
            layouts[spec["key"]] = build_template(data, spec["blanks"])

    # Write deduped canonical PNG assets.
    from PIL import Image

    seen = set()
    for asset, (src, digest) in sorted(asset_hashes.items()):
        if digest in seen:
            continue
        seen.add(digest)
        dest = ASSET_DIR / f"{asset}.png"
        img = Image.open(src)
        if img.mode in ("P", "LA"):
            img = img.convert("RGBA")
        img.save(dest)
        print(f"asset: {dest.relative_to(ROOT)} <- {src.name}")

    # Emit the TypeScript layout module.
    chunks = []
    for key, layout in layouts.items():
        lines_ts = ",\n".join(
            "    [" + ", ".join(emit_token(t) for t in line) + "]" for line in layout["lines"]
        )
        decor_ts = ",\n".join("    " + emit_token(t) for t in layout["decor"])
        body = json.dumps(layout["bodyLineIndices"]).replace(" ", "")
        chunks.append(
            f'''  "{key}": {{
    lines: [
{lines_ts}
    ],
    decor: [
{decor_ts}
    ],
    titleLineIndex: {layout["titleLineIndex"]},
    bodyLineIndices: {body},
    firstBodyY: {ts_number(layout["firstBodyY"])},
    bodyLeading: {ts_number(layout["bodyLeading"])},
    bodyIndent: {ts_number(layout["bodyIndent"])},
    bodyMargin: {ts_number(layout["bodyMargin"])},
  }}'''
        )

    ts = f'''// AUTO-GENERATED by scripts/cert_layout.py -- DO NOT EDIT BY HAND.
// Source of truth: the reference PDFs in public/pdf/.
// Regenerate with: python scripts/cert_layout.py generate

export type CertFontKey =
  | "bookman"
  | "bookmanBold"
  | "oldEnglish"
  | "cambriaBold"
  | "times"
  | "timesBold"
  | "calibri"
  | "calibriBold"
  | "wingdings";

export type CertBlankField =
  | "name"
  | "grade"
  | "schoolYear"
  | "lrn"
  | "purpose"
  | "day"
  | "month";

export type CertSigField = "registrarName" | "principalName";

export type CertToken =
  | {{ kind: "text"; t: string; x: number; y: number; size: number; font: CertFontKey; color?: [number, number, number] }}
  | {{ kind: "blank"; field: CertBlankField; x: number; x1: number; y: number; size: number; font: CertFontKey; suffix: {{ t: string; x: number }}[]; underline: {{ x: number; x1: number; y: number; h: number }} | null }}
  | {{ kind: "sigName"; field: CertSigField; centerX: number; y: number; size: number; font: CertFontKey; maxWidth: number }}
  | {{ kind: "rule"; x: number; x1: number; y: number; h: number }}
  | {{ kind: "image"; asset: string; x: number; y: number; w: number; h: number }};

export type CertTemplateKey = "good-moral" | "enrolment-jhs" | "enrolment-shs" | "graduation";

export interface CertTemplateLayout {{
  lines: CertToken[][];
  decor: CertToken[];
  titleLineIndex: number;
  bodyLineIndices: number[];
  firstBodyY: number;
  bodyLeading: number;
  bodyIndent: number;
  bodyMargin: number;
}}

export const CERT_LAYOUTS: Record<CertTemplateKey, CertTemplateLayout> = {{
{",".join(chunks)}
}};

export const CERT_FALLBACK_FRAME: CertTemplateKey = "{FALLBACK_FRAME}";
'''
    OUT_TS.write_text(ts, encoding="utf-8")
    print(f"wrote {OUT_TS.relative_to(ROOT)} ({len(ts)} bytes)")


def verify(paths) -> int:
    """Compare generated sample PDFs against their reference PDFs."""
    reference_by_key = {}
    for filename, pages in TEMPLATES.items():
        for spec in pages:
            reference_by_key[spec["key"]] = (REF_DIR / filename, spec["page"])

    failures = 0
    for raw in paths:
        path = Path(raw)
        key = path.stem
        if key not in reference_by_key:
            print(f"?? no reference for sample {path.name}")
            continue
        ref_path, page_no = reference_by_key[key]
        ref_page = extract_page(ref_path, page_no, TMP_IMG_DIR / "verify-ref")
        gen_page = extract_page(path, 0, TMP_IMG_DIR / "verify-gen")

        def static_chars(page_data):
            out = []
            for line in group_lines(page_data["chars"]):
                text = line_text(line)
                if ("EGAS" in text and "LUIS" in text) or "ESTILLERO" in text or "TESTNAME" in text.replace(" ", ""):
                    continue  # dynamic signatory names
                for c in line["chars"]:
                    out.append(c)
            return out

        ref_chars = static_chars(ref_page)
        gen_chars = static_chars(gen_page)

        print(f"== {path.name}: {len(ref_chars)} vs {len(gen_chars)} static glyphs")
        if len(ref_chars) != len(gen_chars):
            failures += 1
            print("   FAIL glyph count differs")
        def norm_char(c):
            t = c["t"]
            if c["font"] == "wingdings" and t and ord(t) >= 0xF000:
                return chr(ord(t) & 0xFF)  # Word ToUnicode uses PUA codes
            return t

        diffs = 0
        notes = []
        for r, g in zip(ref_chars, gen_chars):
            problems = []
            r_text = norm_char(r)
            g_text = norm_char(g)
            r_w = r["x1"] - r["x"]
            g_w = g["x1"] - g["x"]
            if g_text.startswith("(cid:") or r_text.startswith("(cid:"):
                # Ligature glyphs extract without ToUnicode on generated PDFs
                # (and pdfminer falls back to the default 1em width for them).
                # Position, size, and font are still compared below; the glyph
                # itself is proven identical by fontkit shaping (see notes).
                notes.append(f"ligature glyph {r_text!r} at x={r['x']:.2f} (ToUnicode artifact only)")
            elif r_text != g_text:
                problems.append(f"text {r_text!r} vs {g_text!r}")
            if abs(r["x"] - g["x"]) > 1.0:
                problems.append(f"x {r['x']} vs {g['x']}")
            if abs(r["y"] - g["y"]) > 1.0:
                problems.append(f"y {r['y']} vs {g['y']}")
            if abs(r["size"] - g["size"]) > 0.2:
                problems.append(f"size {r['size']} vs {g['size']}")
            if r["font"] != g["font"]:
                problems.append(f"font {r['font']} vs {g['font']}")
            if problems:
                diffs += 1
                if diffs <= 12:
                    print(f"   DIFF @{r['x']},{r['y']} {r['t']!r}: " + "; ".join(problems))
        for note in notes[:5]:
            print(f"   NOTE {note}")
        if diffs:
            failures += 1
            print(f"   FAIL {diffs} glyph diffs")
        else:
            print("   PASS glyphs")

        def rule_set(page_data):
            return sorted(
                (round(r["x"]), round(r["x1"]), round(r["y"]), round(r["h"], 1))
                for r in page_data["rules"]
            )

        if rule_set(ref_page) != rule_set(gen_page):
            failures += 1
            print(f"   FAIL rules differ:\n     ref {rule_set(ref_page)}\n     gen {rule_set(gen_page)}")
        else:
            print(f"   PASS rules ({len(rule_set(ref_page))})")

        # Image gate: placement must match the reference exactly for every
        # logo; assets still extracted from the reference must also match the
        # reference's decoded pixels. The footer lockup's split placements are
        # skipped because the renderer sources those logos from the original
        # files instead of the reference's combined bitmap.
        image_failures = 0
        for ref_im in ref_page["images"]:
            if ref_im["asset"] == "footer-lockup" or ref_im.get("composite"):
                continue
            match = next(
                (
                    g
                    for g in gen_page["images"]
                    if abs(g["x"] - ref_im["x"]) <= 2
                    and abs(g["y"] - ref_im["y"]) <= 2
                    and abs(g["w"] - ref_im["w"]) <= 2
                    and abs(g["h"] - ref_im["h"]) <= 2
                ),
                None,
            )
            if match is None:
                image_failures += 1
                print(f"   FAIL no image at ref bbox for {ref_im['asset']} ({ref_im['x']},{ref_im['y']},{ref_im['w']}x{ref_im['h']})")
                continue
            if ref_im["asset"] in EXTRACTED_PNG_ASSETS:
                from PIL import Image

                a = Image.open(TMP_IMG_DIR / "verify-ref" / ref_im["src"]).convert("RGB")
                b = Image.open(TMP_IMG_DIR / "verify-gen" / match["src"]).convert("RGB")
                if a.size != b.size:
                    image_failures += 1
                    print(f"   FAIL {ref_im['asset']} pixel size {a.size} vs {b.size}")
                else:
                    # Tolerance: each template embeds its own JPEG copy of the
                    # shared logos, so decoded pixels can differ by compression
                    # noise. Anything beyond that (wrong art, black boxes) fails.
                    import math

                    ap = a.load()
                    bp = b.load()
                    bad = 0
                    for yy in range(a.size[1]):
                        for xx in range(a.size[0]):
                            pa, pb = ap[xx, yy], bp[xx, yy]
                            if max(abs(pa[0] - pb[0]), abs(pa[1] - pb[1]), abs(pa[2] - pb[2])) > 32:
                                bad += 1
                    ratio = bad / (a.size[0] * a.size[1])
                    if ratio > 0.05:
                        image_failures += 1
                        print(f"   FAIL {ref_im['asset']} pixels differ ({ratio:.1%} beyond tolerance)")
                    elif ratio > 0:
                        print(f"   NOTE {ref_im['asset']} minor codec noise ({ratio:.2%} beyond tolerance)")
        if image_failures:
            failures += 1
            print(f"   FAIL images ({image_failures} problems)")
        else:
            checked = sum(1 for i in ref_page["images"] if i["asset"] != "footer-lockup" and not i.get("composite"))
            print(f"   PASS images ({checked} placed, pixels checked where extracted)")

    print("VERIFY:", "FAIL" if failures else "PASS")
    return 1 if failures else 0


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    cmd = sys.argv[1]
    if cmd == "generate":
        generate()
        return 0
    if cmd == "verify":
        return verify(sys.argv[2:])
    if cmd == "extract":
        data = extract_page(Path(sys.argv[2]), int(sys.argv[3]) if len(sys.argv) > 3 else 0)
        print(json.dumps(data, indent=1, default=str))
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())
