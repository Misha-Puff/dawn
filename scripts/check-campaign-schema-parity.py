#!/usr/bin/env python3
"""Assert that the campaign_* block schemas are identical across the two
collection grid sections.

The campaign-view *rendering* is shared via snippets/campaign-blocks.liquid,
but Shopify section schemas cannot be shared, so the block definitions are
duplicated in both sections. This check fails CI when they drift.

Usage: python3 scripts/check-campaign-schema-parity.py   (exit 0 = parity)
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SECTIONS = [
    ROOT / "sections/main-collection-product-grid.liquid",
    ROOT / "sections/collection-preview-grid.liquid",
]
PREFIX = "campaign_"


def campaign_blocks(path):
    text = path.read_text(encoding="utf-8")
    m = re.search(r"{%-?\s*schema\s*-?%}(.*?){%-?\s*endschema\s*-?%}", text, re.S)
    if not m:
        sys.exit(f"{path}: no {{% schema %}} block found")
    schema = json.loads(m.group(1))
    blocks = [b for b in schema.get("blocks", []) if str(b.get("type", "")).startswith(PREFIX)]
    return {b["type"]: b for b in blocks}, [b["type"] for b in blocks]


def main():
    (a, a_order), (b, b_order) = (campaign_blocks(p) for p in SECTIONS)
    a_name, b_name = (p.relative_to(ROOT) for p in SECTIONS)
    errors = []
    if a_order != b_order:
        errors.append(f"block type set/order differs:\n  {a_name}: {a_order}\n  {b_name}: {b_order}")
    for t in sorted(set(a) & set(b)):
        if a[t] != b[t]:
            ja = json.dumps(a[t], indent=2, sort_keys=True).splitlines()
            jb = json.dumps(b[t], indent=2, sort_keys=True).splitlines()
            import difflib
            diff = "\n".join(difflib.unified_diff(ja, jb, str(a_name), str(b_name), lineterm="", n=1))
            errors.append(f"block '{t}' differs:\n{diff}")
    if errors:
        print("campaign_* block schema PARITY FAILED\n")
        print("\n\n".join(errors))
        sys.exit(1)
    print(f"campaign_* block schema parity OK ({len(a_order)} blocks: {', '.join(a_order)})")


if __name__ == "__main__":
    main()
