#!/usr/bin/env python3
import json
from collections import Counter, defaultdict

FILE = "audit/security/osv.json"
MAX_FINDINGS = 100

with open(FILE, encoding="utf-8") as f:
    data = json.load(f)

results = data.get("results", [])

vulns = []
packages = []

for result in results:
    packages_found = result.get("packages", [])
    packages.extend(packages_found)

    for pkg in packages_found:
        for vuln in pkg.get("vulnerabilities", []):
            item = dict(vuln)
            item["_package"] = pkg.get("package", {}).get("name", "UNKNOWN")
            item["_version"] = pkg.get("package", {}).get("version", "UNKNOWN")
            vulns.append(item)

print("=== OSV-SCANNER SUMMARY ===")
print(f"Results: {len(results)}")
print(f"Affected packages: {len(packages)}")
print(f"Vulnerabilities: {len(vulns)}")

if not vulns:
    print("\nVerdict: CLEAN")
    raise SystemExit

print("\nVerdict: VULNERABILITIES FOUND")

ids = Counter()
packages_by_vuln = defaultdict(set)

for v in vulns:
    vid = v.get("id", "UNKNOWN")
    ids[vid] += 1
    packages_by_vuln[vid].add(
        f"{v['_package']}@{v['_version']}"
    )

print("\nTop vulnerability IDs:")
for vid, count in ids.most_common(40):
    pkgs = ", ".join(sorted(packages_by_vuln[vid])[:5])
    print(f"  {count:3}  {vid}  ({pkgs})")

print("\nUnique vulnerability IDs:")
print(f"  {len(ids)}")

print("\nDetailed findings:")
seen = set()

for i, v in enumerate(vulns, 1):
    vid = v.get("id", "UNKNOWN")
    pkg = v["_package"]
    version = v["_version"]

    key = (vid, pkg, version)
    if key in seen:
        continue
    seen.add(key)

    summary = v.get("summary", "")
    print(f"{i:3}. {pkg}@{version}")
    print(f"     {vid}: {summary}")

    if i >= MAX_FINDINGS:
        break
