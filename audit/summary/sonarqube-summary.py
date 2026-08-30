#!/usr/bin/env python3
import json
from collections import Counter

FILE = "audit/quality/sonarqube-issues.json"
MAX_RULES = 40
MAX_FILES = 30
MAX_ISSUES = 80

with open(FILE, encoding="utf-8") as f:
    data = json.load(f)

issues = data.get("issues", [])

print("=== SONARQUBE SUMMARY ===")
print(f"Issues in report: {len(issues)}")

if "total" in data:
    print(f"Total according to API: {data['total']}")

if not issues:
    print("\nVerdict: CLEAN / NO ISSUES IN EXPORT")
    raise SystemExit

print("\nBy type:")
for key, count in Counter(
    x.get("type", "UNKNOWN")
    for x in issues
).most_common():
    print(f"  {count:5}  {key}")

print("\nBy severity:")
for key, count in Counter(
    x.get("severity", "UNKNOWN")
    for x in issues
).most_common():
    print(f"  {count:5}  {key}")

print("\nTop rules:")

for key, count in Counter(
    x.get("rule", "UNKNOWN")
    for x in issues
).most_common(MAX_RULES):
    print(f"  {count:5}  {key}")

print("\nTop files/components:")

for key, count in Counter(
    x.get("component", "UNKNOWN")
    for x in issues
).most_common(MAX_FILES):
    print(f"  {count:5}  {key}")

print("\nImportant issues:")

priority = {
    "BLOCKER": 0,
    "CRITICAL": 1,
    "MAJOR": 2,
    "MINOR": 3,
    "INFO": 4,
}

ordered = sorted(
    issues,
    key=lambda x: (
        priority.get(x.get("severity", "INFO"), 99),
        x.get("component", ""),
        x.get("line") or 0,
    ),
)

for i, issue in enumerate(ordered[:MAX_ISSUES], 1):
    component = issue.get("component", "?")
    line = issue.get("line", "?")
    severity = issue.get("severity", "?")
    issue_type = issue.get("type", "?")
    rule = issue.get("rule", "?")
    message = issue.get("message", "").replace("\n", " ")

    print(f"{i:3}. {component}:{line}")
    print(f"     [{severity}] [{issue_type}] {rule}")
    print(f"     {message}")

print("\nVerdict:")

critical = sum(
    1 for x in issues
    if x.get("severity") in {"BLOCKER", "CRITICAL"}
)

security = sum(
    1 for x in issues
    if x.get("type") == "VULNERABILITY"
)

if critical:
    print(f"  REVIEW REQUIRED — {critical} BLOCKER/CRITICAL issues")
elif security:
    print(f"  REVIEW REQUIRED — {security} security issues")
else:
    print("  NO BLOCKER/CRITICAL SECURITY ISSUES IN EXPORT")
