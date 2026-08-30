#!/usr/bin/env python3
import json
from collections import Counter

FILE = "audit/quality/jscpd-report.json"
MAX_ITEMS = 80

with open(FILE, encoding="utf-8") as f:
    data = json.load(f)

duplicates = data.get("duplicates", [])
stats = data.get("statistics", {})

print("=== JSCPD DUPLICATION SUMMARY ===")
print(f"Duplicate blocks: {len(duplicates)}")

print("\nStatistics:")

if isinstance(stats, dict):
    for key, value in stats.items():
        if isinstance(value, dict):
            print(f"  {key}:")
            for k, v in value.items():
                print(f"    {k}: {v}")
        else:
            print(f"  {key}: {value}")

if not duplicates:
    print("\nVerdict: LOW / NO DUPLICATION")
    raise SystemExit

pairs = Counter()
files = Counter()
lines = Counter()

for d in duplicates:
    a = d.get("firstFile", {}).get("name", "?")
    b = d.get("secondFile", {}).get("name", "?")
    token_count = d.get("tokens", 0)
    line_count = d.get("lines", 0)

    pair = tuple(sorted((a, b)))
    pairs[pair] += 1
    files[a] += 1
    files[b] += 1
    lines[a] += line_count
    lines[b] += line_count

print("\nTop duplicated files:")

for path, count in files.most_common(30):
    print(
        f"  {count:4} duplicates  "
        f"{lines[path]:5} duplicate-lines  {path}"
    )

print("\nTop duplicated file pairs:")

for (a, b), count in pairs.most_common(30):
    print(f"  {count:4}  {a} <-> {b}")

print("\nLargest duplicate blocks:")

largest = sorted(
    duplicates,
    key=lambda x: (
        x.get("tokens", 0),
        x.get("firstFile", {}).get("end", 0)
        - x.get("firstFile", {}).get("start", 0),
    ),
    reverse=True,
)

for i, d in enumerate(largest[:MAX_ITEMS], 1):
    a = d.get("firstFile", {})
    b = d.get("secondFile", {})

    print(
        f"{i:3}. {a.get('name', '?')}:{a.get('start', '?')}-"
        f"{a.get('end', '?')} <-> "
        f"{b.get('name', '?')}:{b.get('start', '?')}-"
        f"{b.get('end', '?')} "
        f"tokens={d.get('tokens', '?')}"
    )

print("\nVerdict: DUPLICATION REVIEW REQUIRED")
