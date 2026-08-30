#!/usr/bin/env python3

import json
from collections import Counter
from pathlib import Path


REPORT = Path("audit/security/semgrep.json")


def main():
    if not REPORT.exists():
        print(f"ERROR: report not found: {REPORT}")
        return

    with REPORT.open(encoding="utf-8") as f:
        data = json.load(f)

    results = data.get("results", [])
    errors = data.get("errors", [])

    print("=== SEMGREP SECURITY SUMMARY ===")
    print(f"Report: {REPORT}")

    # ------------------------------------------------------------
    # Real findings
    # ------------------------------------------------------------

    print(f"\nReal findings: {len(results)}")

    severity = Counter(
        r.get("extra", {}).get("severity", "UNKNOWN")
        for r in results
    )

    print("\nBy severity:")
    for name, count in severity.most_common():
        print(f"  {count:4}  {name}")

    print("\nTop rules:")
    for rule, count in Counter(
        r.get("check_id", "UNKNOWN")
        for r in results
    ).most_common(15):
        print(f"  {count:4}  {rule}")

    print("\nTop files:")
    for filename, count in Counter(
        r.get("path", "UNKNOWN")
        for r in results
    ).most_common(15):
        print(f"  {count:4}  {filename}")

    # ------------------------------------------------------------
    # Security-relevant findings
    # ------------------------------------------------------------

    print("\nSecurity-sensitive findings:")

    security_keywords = (
        "sql",
        "sqli",
        "ssrf",
        "xss",
        "secret",
        "credential",
        "crypto",
        "cert",
        "urllib",
        "path",
        "command",
        "exec",
        "injection",
        "prototype",
    )

    security_results = []

    for r in results:
        text = " ".join(
            [
                str(r.get("check_id", "")),
                str(r.get("extra", {}).get("message", "")),
            ]
        ).lower()

        if any(keyword in text for keyword in security_keywords):
            security_results.append(r)

    print(f"  {len(security_results)} findings")

    for r in security_results[:20]:
        extra = r.get("extra", {})

        print(
            f"  {r.get('path', '?')}:{r.get('start', {}).get('line', '?')} "
            f"[{extra.get('severity', 'UNKNOWN')}] "
            f"{r.get('check_id', 'UNKNOWN')}"
        )

    if len(security_results) > 20:
        print(f"  ... and {len(security_results) - 20} more")

    # ------------------------------------------------------------
    # Semgrep engine errors
    # ------------------------------------------------------------

    print("\nSemgrep engine errors/warnings:")

    if not errors:
        print("  None")
    else:
        print(f"  Total: {len(errors)}")

        error_codes = Counter(
            str(e.get("code", "UNKNOWN"))
            for e in errors
        )

        print("  By code:")
        for code, count in error_codes.most_common():
            print(f"    {count:4}  code={code}")

        error_files = Counter(
            e.get("path", "UNKNOWN")
            for e in errors
        )

        print("\n  Affected files:")
        for filename, count in error_files.most_common(10):
            print(f"    {count:4}  {filename}")

        # Group identical messages, because one engine limitation
        # can be repeated hundreds of times.
        messages = Counter(
            str(e.get("message", "")).splitlines()[-1]
            if e.get("message")
            else "UNKNOWN"
            for e in errors
        )

        print("\n  Main error types:")

        for message, count in messages.most_common(10):
            message = message.strip()
            if len(message) > 180:
                message = message[:177] + "..."

            print(f"    {count:4}  {message}")

    # ------------------------------------------------------------
    # Verdict
    # ------------------------------------------------------------

    print("\nVerdict:")

    if not results:
        if errors:
            print(
                "  INCOMPLETE — Semgrep produced no usable findings "
                "and reported engine errors."
            )
        else:
            print("  PASS — no findings reported.")
        return

    critical = severity.get("CRITICAL", 0)
    high = severity.get("HIGH", 0)
    error = severity.get("ERROR", 0)

    if critical or high:
        print(
            "  FAIL — high/critical security findings require remediation."
        )
    elif error:
        print(
            "  FAIL / REVIEW REQUIRED — security findings require "
            "triage and remediation."
        )
    else:
        print(
            "  REVIEW REQUIRED — findings exist, but none are marked "
            "HIGH/CRITICAL."
        )

    if errors:
        print(
            "  NOTE — Semgrep also reported engine/rule limitations; "
            "the scan is not equivalent to a fully successful Pro scan."
        )


if __name__ == "__main__":
    main()
