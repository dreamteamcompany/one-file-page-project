#!/usr/bin/env python3

import re
from collections import Counter
from pathlib import Path


REPORT = Path("audit/quality/lizard-backend.txt")

PATTERN = re.compile(
    r"^(?P<file>.+?):(?P<line>\d+): warning: "
    r"(?P<function>.+?) has "
    r"(?P<nloc>\d+) NLOC, "
    r"(?P<ccn>\d+) CCN, "
    r"(?P<token>\d+) token, "
    r"(?P<param>\d+) PARAM, "
    r"(?P<length>\d+) length, "
    r"(?P<nd>\d+) ND$"
)


def main():
    if not REPORT.exists():
        print(f"ERROR: report not found: {REPORT}")
        return

    rows = []

    for raw in REPORT.read_text(errors="replace").splitlines():
        raw = raw.strip()
        match = PATTERN.match(raw)

        if not match:
            continue

        item = match.groupdict()

        for key in ("line", "nloc", "ccn", "token", "param", "length", "nd"):
            item[key] = int(item[key])

        rows.append(item)

    print("=== LIZARD COMPLEXITY SUMMARY ===")
    print(f"Report: {REPORT}")
    print(f"Parsed warning rows: {len(rows)}")

    if not rows:
        print("\nVerdict: NO PARSEABLE LIZARD FINDINGS")
        return

    files = Counter(x["file"] for x in rows)

    print(f"Files with warnings: {len(files)}")

    print("\nMetrics:")
    print(f"  Max NLOC:   {max(x['nloc'] for x in rows)}")
    print(f"  Max CCN:    {max(x['ccn'] for x in rows)}")
    print(f"  Max length: {max(x['length'] for x in rows)}")
    print(f"  Max PARAM:  {max(x['param'] for x in rows)}")

    print("\nTop complexity findings:")

    # Сначала самые сложные по CCN, затем по NLOC.
    top = sorted(
        rows,
        key=lambda x: (x["ccn"], x["nloc"], x["length"]),
        reverse=True,
    )[:15]

    for x in top:
        print(
            f"  {x['file']}:{x['line']} "
            f"{x['function']} — "
            f"NLOC={x['nloc']}, "
            f"CCN={x['ccn']}, "
            f"length={x['length']}, "
            f"PARAM={x['param']}"
        )

    print("\nWorst files:")

    file_stats = []

    for filename in files:
        items = [x for x in rows if x["file"] == filename]

        file_stats.append(
            (
                filename,
                len(items),
                max(x["ccn"] for x in items),
                max(x["nloc"] for x in items),
            )
        )

    file_stats.sort(key=lambda x: (x[1], x[2], x[3]), reverse=True)

    for filename, count, max_ccn, max_nloc in file_stats[:10]:
        print(
            f"  {count:2} warnings  "
            f"max CCN={max_ccn:2}  "
            f"max NLOC={max_nloc:3}  "
            f"{filename}"
        )

    max_ccn = max(x["ccn"] for x in rows)
    max_nloc = max(x["nloc"] for x in rows)

    print("\nVerdict:")

    if max_ccn >= 20 or max_nloc >= 100:
        print(
            "  REFACTOR RECOMMENDED — several functions have high "
            "cyclomatic complexity and/or excessive size."
        )
    elif max_ccn >= 10 or max_nloc >= 50:
        print(
            "  REVIEW RECOMMENDED — some functions are moderately "
            "complex or large."
        )
    else:
        print(
            "  ACCEPTABLE — no severe complexity hotspots detected "
            "in the reported warnings."
        )


if __name__ == "__main__":
    main()
