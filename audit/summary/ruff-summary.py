#!/usr/bin/env python3
import json
from collections import Counter

FILE = "audit/quality/ruff-backend.json"
MAX_RULES = 40
MAX_FILES = 30

with open(FILE, encoding="utf-8") as f:
    data = json.load(f)

print("=== RUFF BACKEND SUMMARY ===")
print(f"Total findings: {len(data)}")

if not data:
    print("Verdict: CLEAN")
    raise SystemExit

rules = Counter(x.get("code", "UNKNOWN") for x in data)
files = Counter(x.get("filename", "UNKNOWN") for x in data)

print("\nTop rules:")
for rule, count in rules.most_common(MAX_RULES):
    print(f"  {count:5}  {rule}")

print("\nTop files:")
for path, count in files.most_common(MAX_FILES):
    print(f"  {count:5}  {path}")

groups = {
    "Security": ("S",),
    "Bugs/correctness": ("B", "F"),
    "Exception handling": ("BLE",),
    "Complexity/design": ("C90", "PLR", "PLC"),
    "Code quality": ("RUF", "SIM", "RET", "FURB"),
    "Style/imports": ("E", "W", "I"),
    "Modernization": ("UP",),
}

print("\nBy category:")

for category, prefixes in groups.items():
    total = sum(
        count
        for code, count in rules.items()
        if any(code.startswith(p) for p in prefixes)
    )
    print(f"  {total:5}  {category}")

security = sum(
    count for code, count in rules.items()
    if code.startswith("S")
)

bugs = sum(
    count for code, count in rules.items()
    if code.startswith(("B", "F"))
)

print("\nVerdict:")

if security:
    print(f"  REVIEW REQUIRED — {security} security findings")
elif bugs:
    print(f"  REVIEW REQUIRED — {bugs} correctness findings")
else:
    print("  NO DIRECT SECURITY BLOCKER DETECTED")

print("\nMost important rules:")
for rule in ["S", "B", "BLE", "F", "RUF", "UP"]:
    matches = [
        (code, count)
        for code, count in rules.items()
        if code.startswith(rule)
    ]

    if matches:
        print(f"  {rule}: {sum(x[1] for x in matches)}")
