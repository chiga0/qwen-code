#!/usr/bin/env python3
"""Measure terminal screenshot density (chrome / content / whitespace).

Usage:
  measure-density.py <png>...                 # JSON output, one entry per image
  measure-density.py --table <png>...         # markdown table for quick read

Per-row classification:
  - empty: row has < INK_THRESHOLD non-background pixels (whitespace)
  - solid_bar: row has > SOLID_THRESHOLD of width as single non-bg color (chrome)
  - text: anything else (rendered glyphs)

Aggregates:
  - rows_top_margin / rows_bottom_margin: leading/trailing empty rows
  - rows_middle_empty: empty rows BETWEEN content (turn separators / panel padding)
  - rows_solid_bar: chrome-like rows
  - rows_text: rendered text rows
  - All as pixel counts and % of image height
"""

import sys
import json
from pathlib import Path
from PIL import Image
import numpy as np

BG_TOLERANCE = 8       # max channel diff to consider pixel as background
INK_THRESHOLD = 0.02   # row with less ink than this = empty
SOLID_THRESHOLD = 0.50 # row with this much of one non-bg color = solid bar


def detect_bg(arr):
    """Most common color (quantized) in the image."""
    flat = arr.reshape(-1, 3)
    # Sample for speed on large images
    step = max(1, len(flat) // 10000)
    sample = flat[::step]
    quantized = (sample // 8) * 8
    # Convert to a hashable view for unique
    view = quantized.view([("", quantized.dtype)] * 3)
    unique, counts = np.unique(view, return_counts=True)
    top = unique[counts.argmax()]
    return np.array([int(top["f0"]), int(top["f1"]), int(top["f2"])])


def classify_row(row, is_bg_row, w):
    ink_ratio = 1 - is_bg_row.sum() / w
    if ink_ratio < INK_THRESHOLD:
        return "empty", ink_ratio
    non_bg = row[~is_bg_row]
    if len(non_bg) == 0:
        return "empty", ink_ratio
    quantized = (non_bg // 16) * 16
    view = quantized.view([("", quantized.dtype)] * 3)
    unique, counts = np.unique(view, return_counts=True)
    top_count = int(counts.max())
    if top_count / w > SOLID_THRESHOLD:
        return "solid_bar", ink_ratio
    return "text", ink_ratio


def measure(path):
    img = Image.open(path).convert("RGB")
    arr = np.array(img)
    h, w, _ = arr.shape
    bg = detect_bg(arr)
    diff = np.abs(arr.astype(int) - bg).max(axis=2)
    is_bg = diff <= BG_TOLERANCE  # h x w bool
    classes = []
    for i in range(h):
        cls, _ = classify_row(arr[i], is_bg[i], w)
        classes.append(cls)
    counts = {"empty": 0, "solid_bar": 0, "text": 0}
    for c in classes:
        counts[c] += 1
    # Leading / trailing margins
    top = 0
    for c in classes:
        if c == "empty":
            top += 1
        else:
            break
    bottom = 0
    for c in reversed(classes):
        if c == "empty":
            bottom += 1
        else:
            break
    middle_empty = counts["empty"] - top - bottom
    # First content row to last content row span
    first_text = next((i for i, c in enumerate(classes) if c != "empty"), None)
    last_text = next((i for i, c in enumerate(reversed(classes)) if c != "empty"), None)
    last_text = (h - 1 - last_text) if last_text is not None else None
    content_span = (last_text - first_text + 1) if first_text is not None else 0

    return {
        "file": str(path),
        "width": w,
        "height": h,
        "bg_color": [int(c) for c in bg],
        "rows_total": h,
        "rows_top_margin": top,
        "rows_bottom_margin": bottom,
        "rows_middle_empty": middle_empty,
        "rows_solid_bar": counts["solid_bar"],
        "rows_text": counts["text"],
        "rows_empty_total": counts["empty"],
        "content_span_rows": content_span,
        "pct_top_margin": round(top / h * 100, 1),
        "pct_bottom_margin": round(bottom / h * 100, 1),
        "pct_middle_empty": round(middle_empty / h * 100, 1),
        "pct_solid_bar": round(counts["solid_bar"] / h * 100, 1),
        "pct_text": round(counts["text"] / h * 100, 1),
        "pct_used": round((counts["solid_bar"] + counts["text"]) / h * 100, 1),
    }


def print_table(results):
    cols = [
        ("file", "file"),
        ("h", "rows_total"),
        ("top", "rows_top_margin"),
        ("text", "rows_text"),
        ("bar", "rows_solid_bar"),
        ("mid_empty", "rows_middle_empty"),
        ("bot", "rows_bottom_margin"),
        ("span", "content_span_rows"),
        ("%text", "pct_text"),
        ("%bar", "pct_solid_bar"),
        ("%used", "pct_used"),
        ("%mid_empty", "pct_middle_empty"),
    ]
    print("| " + " | ".join(c[0] for c in cols) + " |")
    print("|" + "|".join("---" for _ in cols) + "|")
    for r in results:
        row = []
        for label, key in cols:
            v = r.get(key, "")
            if key == "file":
                v = Path(v).name
            row.append(str(v))
        print("| " + " | ".join(row) + " |")


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__, file=sys.stderr)
        sys.exit(1)
    table_mode = False
    if args[0] == "--table":
        table_mode = True
        args = args[1:]
    results = []
    for p in args:
        try:
            results.append(measure(Path(p)))
        except Exception as e:
            print(f"error: {p}: {e}", file=sys.stderr)
    if table_mode:
        print_table(results)
    else:
        print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
