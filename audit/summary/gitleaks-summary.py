#!/usr/bin/env python3
import json
from collections import Counter

FILE = "audit/security/gitleaks-current.json"
MAX_LINES = 150

with open(FILE, encoding="utf-8") as f:
    data = json.load(f)

if isinstance(data, dict):
    findings = data.get("findings", [])
else:
    findings = data

print("=== GITLEAKS SUMMARY ===")
print(f"Total findings: {len(findings)}")

if not findings:
    print("Verdict: CLEAN")
    raise SystemExit

print("Verdict: FINDINGS")

print("\nTop rules/secrets:")
for key, count in Counter(
    x.get("RuleID", x.get("ruleID", "UNKNOWN"))
    for x in findings
).most_common(20):
    print(f"  {count:4}  {key}")

print("\nTop files:")
for key, count in Counter(
    x.get("File", x.get("file", "UNKNOWN"))
    for x in findings
).most_common(20):
    print(f"  {count:4}  {key}")

print("\nFindings:")
for i, x in enumerate(findings[:100], 1):
    rule = x.get("RuleID", x.get("ruleID", "UNKNOWN"))
    path = x.get("File", x.get("file", "UNKNOWN"))
    line = x.get("StartLine", x.get("startLine", "?"))
    desc = x.get("Description", x.get("description", ""))
    print(f"{i:3}. {path}:{line} [{rule}] {desc}")
