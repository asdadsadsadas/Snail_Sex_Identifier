#!/usr/bin/env python3
"""
Build colab/train_snail_pipeline.ipynb from colab/train_snail_pipeline.py.

The .py file uses "# ── Cell N: <title>" comment markers to delimit cells.
This script converts those into proper Jupyter notebook cells (a markdown
title cell followed by a code cell), so you can open it directly in Colab:

    File → Upload notebook → colab/train_snail_pipeline.ipynb

Run:  python scripts/build_colab_notebook.py
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "colab" / "train_snail_pipeline.py"
DST = ROOT / "colab" / "train_snail_pipeline.ipynb"

MARKER = re.compile(r"^#\s*── Cell (\d+):\s*(.+?)\s*─*\s*$")
COMMENT = re.compile(r"^\s*#")


def strip_title_dashes(text: str) -> str:
    return re.sub(r"\s*─+\s*$", "", text).strip()


def main() -> None:
    lines = SRC.read_text(encoding="utf-8").splitlines()

    notebook_cells: list[dict] = []

    # ── leading comment block → one markdown cell ──
    top: list[str] = []
    i = 0
    while i < len(lines) and not MARKER.match(lines[i]):
        top.append(lines[i])
        i += 1
    if top:
        notebook_cells.append(
            {"cell_type": "markdown", "metadata": {}, "source": "\n".join(top)}
        )

    # ── walk the rest, splitting on cell markers ──
    code: list[str] = []
    current_md: list[str] | None = None

    def flush_md():
        nonlocal current_md
        if current_md is not None:
            notebook_cells.append(
                {"cell_type": "markdown", "metadata": {}, "source": "\n".join(current_md)}
            )
            current_md = None

    def flush_code():
        nonlocal code
        if code:
            notebook_cells.append(
                {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": "\n".join(code)}
            )
            code = []

    while i < len(lines):
        line = lines[i]
        m = MARKER.match(line)
        if m:
            flush_code()
            flush_md()
            title = strip_title_dashes(m.group(2))
            current_md = [f"### Cell {m.group(1)}: {title}", ""]
            # absorb immediately-following comment lines into the title cell
            j = i + 1
            while j < len(lines) and COMMENT.match(lines[j]) and not MARKER.match(lines[j]):
                content = lines[j].strip().lstrip("#").strip()
                if content:
                    current_md.append(content)
                j += 1
            i = j
            continue
        code.append(line)
        i += 1

    flush_code()
    flush_md()

    notebook = {
        "cells": notebook_cells,
        "metadata": {
            "colab": {"provenance": [], "gpuType": "T4"},
            "kernelspec": {"display_name": "Python 3", "name": "python3"},
            "language_info": {"name": "python"},
            "accelerator": "GPU",
        },
        "nbformat": 4,
        "nbformat_minor": 0,
    }

    DST.write_text(json.dumps(notebook, ensure_ascii=False, indent=1), encoding="utf-8")

    code_cells = [c for c in notebook_cells if c["cell_type"] == "code"]
    md_cells = [c for c in notebook_cells if c["cell_type"] == "markdown"]
    print(f"[OK] Wrote {DST.name}")
    print(f"   markdown cells: {len(md_cells)} | code cells: {len(code_cells)}")


if __name__ == "__main__":
    main()
