#!/usr/bin/env python3
"""
Verify and optionally backfill missing websites in Biznesinfo companies.jsonl
using iBiz (`ibiz2.sqlite3`) as a secondary source.

Default behavior is dry-run verification only.
Use `--apply` to update missing `websites` in-place.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sqlite3
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_IBIZ_DB = Path("/home/mlweb/Info-ibiz/ibiz2.sqlite3")
IMPORTED_SOURCE_ID_PREFIX = "biznesinfo-"
STRONG_EVIDENCE = {"direct_source_id", "phone", "email", "unp"}


def now_utc_compact() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def norm_space(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def norm_text(value: str) -> str:
    return norm_space(value).casefold()


def normalize_phone(raw: str) -> str:
    return "".join(re.findall(r"\d+", raw or ""))


def normalize_email(raw: str) -> str:
    return (raw or "").strip().casefold()


def normalize_unp(raw: str) -> str:
    return "".join(re.findall(r"\d+", raw or ""))


def uniq_keep_order(values: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for v in values:
        s = (v or "").strip()
        if not s:
            continue
        if s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


def parse_json_list(raw: Any) -> list[str]:
    if isinstance(raw, list):
        return [str(x) for x in raw if isinstance(x, (str, int, float))]
    if not isinstance(raw, str):
        return []
    s = raw.strip()
    if not s:
        return []
    try:
        value = json.loads(s)
    except Exception:
        return []
    if not isinstance(value, list):
        return []
    return [str(x) for x in value if isinstance(x, (str, int, float))]


def normalize_websites(values: list[str]) -> list[str]:
    out: list[str] = []
    for raw in values:
        s = (raw or "").strip()
        if not s:
            continue
        if s.lower().startswith(("mailto:", "tel:")):
            continue
        if not re.match(r"^https?://", s, flags=re.IGNORECASE):
            s = f"https://{s}"
        out.append(s)
    return uniq_keep_order(out)


def source_prefix(source_id: str) -> str:
    sid = (source_id or "").strip()
    if sid.startswith(IMPORTED_SOURCE_ID_PREFIX):
        return IMPORTED_SOURCE_ID_PREFIX
    if sid.isdigit():
        return "digits"
    return "other"


@dataclass(frozen=True)
class IbizCompany:
    subdomain: str
    name: str
    address: str
    unp: str
    phones: tuple[str, ...]
    emails: tuple[str, ...]
    websites: tuple[str, ...]


@dataclass
class MatchDecision:
    source_id: str
    name: str
    address: str
    source_prefix: str
    evidence_by_candidate: dict[str, set[str]]
    match_type: str
    auto_candidate: str | None


def load_ibiz_companies(db_path: Path) -> dict[str, IbizCompany]:
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT subdomain, name, address, unp, phones_json, emails_json, websites_json
            FROM companies
            WHERE status='done'
              AND websites_json IS NOT NULL
              AND TRIM(websites_json) NOT IN ('', '[]', 'null')
            """
        ).fetchall()
    finally:
        conn.close()

    out: dict[str, IbizCompany] = {}
    for row in rows:
        subdomain = str(row["subdomain"] or "").strip()
        if not subdomain:
            continue
        websites = normalize_websites(parse_json_list(row["websites_json"]))
        if not websites:
            continue
        phones = uniq_keep_order(
            [p for p in (normalize_phone(x) for x in parse_json_list(row["phones_json"])) if len(p) >= 9]
        )
        emails = uniq_keep_order([e for e in (normalize_email(x) for x in parse_json_list(row["emails_json"])) if e])
        unp = normalize_unp(str(row["unp"] or ""))
        out[subdomain] = IbizCompany(
            subdomain=subdomain,
            name=norm_space(str(row["name"] or "")),
            address=norm_space(str(row["address"] or "")),
            unp=unp,
            phones=tuple(phones),
            emails=tuple(emails),
            websites=tuple(websites),
        )
    return out


def build_ibiz_indexes(
    companies: dict[str, IbizCompany],
) -> tuple[dict[str, set[str]], dict[str, set[str]], dict[str, set[str]], dict[str, set[str]]]:
    by_phone: dict[str, set[str]] = defaultdict(set)
    by_email: dict[str, set[str]] = defaultdict(set)
    by_unp: dict[str, set[str]] = defaultdict(set)
    by_name_addr: dict[str, set[str]] = defaultdict(set)

    for subdomain, company in companies.items():
        for phone in company.phones:
            by_phone[phone].add(subdomain)
        for email in company.emails:
            by_email[email].add(subdomain)
        if len(company.unp) >= 6:
            by_unp[company.unp].add(subdomain)
        key = f"{norm_text(company.name)}||{norm_text(company.address)}"
        if key != "||":
            by_name_addr[key].add(subdomain)

    return by_phone, by_email, by_unp, by_name_addr


def collect_candidates(
    *,
    company: dict[str, Any],
    ibiz_companies: dict[str, IbizCompany],
    by_phone: dict[str, set[str]],
    by_email: dict[str, set[str]],
    by_unp: dict[str, set[str]],
    by_name_addr: dict[str, set[str]],
) -> dict[str, set[str]]:
    candidates: dict[str, set[str]] = defaultdict(set)

    source_id = str(company.get("source_id") or "").strip()
    if source_id and source_id in ibiz_companies:
        candidates[source_id].add("direct_source_id")

    for raw_phone in company.get("phones") or []:
        phone = normalize_phone(str(raw_phone))
        if len(phone) < 9:
            continue
        for subdomain in by_phone.get(phone, set()):
            candidates[subdomain].add("phone")

    for raw_email in company.get("emails") or []:
        email = normalize_email(str(raw_email))
        if not email:
            continue
        for subdomain in by_email.get(email, set()):
            candidates[subdomain].add("email")

    unp = normalize_unp(str(company.get("unp") or ""))
    if len(unp) >= 6:
        for subdomain in by_unp.get(unp, set()):
            candidates[subdomain].add("unp")

    name_addr_key = f"{norm_text(str(company.get('name') or ''))}||{norm_text(str(company.get('address') or ''))}"
    if name_addr_key != "||":
        for subdomain in by_name_addr.get(name_addr_key, set()):
            candidates[subdomain].add("name_addr")

    return dict(candidates)


def decide_match(
    *,
    source_id: str,
    name: str,
    address: str,
    candidates: dict[str, set[str]],
    allow_weak_name_address: bool,
) -> MatchDecision:
    prefix = source_prefix(source_id)
    if not candidates:
        return MatchDecision(
            source_id=source_id,
            name=name,
            address=address,
            source_prefix=prefix,
            evidence_by_candidate={},
            match_type="no_match",
            auto_candidate=None,
        )

    if len(candidates) > 1:
        return MatchDecision(
            source_id=source_id,
            name=name,
            address=address,
            source_prefix=prefix,
            evidence_by_candidate=candidates,
            match_type="ambiguous",
            auto_candidate=None,
        )

    only_candidate = next(iter(candidates.keys()))
    evidence = candidates[only_candidate]
    if evidence & STRONG_EVIDENCE:
        match_type = "auto"
        auto_candidate = only_candidate
    elif allow_weak_name_address and evidence == {"name_addr"}:
        match_type = "auto_weak_name_addr"
        auto_candidate = only_candidate
    else:
        match_type = "weak_unique"
        auto_candidate = None

    return MatchDecision(
        source_id=source_id,
        name=name,
        address=address,
        source_prefix=prefix,
        evidence_by_candidate=candidates,
        match_type=match_type,
        auto_candidate=auto_candidate,
    )


def write_report_csv(
    *,
    report_csv: Path,
    decisions: list[MatchDecision],
    ibiz_companies: dict[str, IbizCompany],
) -> None:
    report_csv.parent.mkdir(parents=True, exist_ok=True)
    with report_csv.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "source_id",
                "name",
                "address",
                "source_prefix",
                "match_type",
                "candidate_subdomain",
                "evidence",
                "candidate_name",
                "candidate_address",
                "candidate_unp",
                "candidate_websites",
            ]
        )
        for decision in decisions:
            if not decision.evidence_by_candidate:
                continue
            for subdomain in sorted(decision.evidence_by_candidate.keys()):
                ev = ",".join(sorted(decision.evidence_by_candidate[subdomain]))
                candidate = ibiz_companies.get(subdomain)
                if candidate:
                    websites = " | ".join(candidate.websites)
                    c_name = candidate.name
                    c_addr = candidate.address
                    c_unp = candidate.unp
                else:
                    websites = ""
                    c_name = ""
                    c_addr = ""
                    c_unp = ""
                w.writerow(
                    [
                        decision.source_id,
                        decision.name,
                        decision.address,
                        decision.source_prefix,
                        decision.match_type,
                        subdomain,
                        ev,
                        c_name,
                        c_addr,
                        c_unp,
                        websites,
                    ]
                )


def write_report_json(report_json: Path, report: dict[str, Any]) -> None:
    report_json.parent.mkdir(parents=True, exist_ok=True)
    report_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def apply_backfill(
    *,
    companies_jsonl: Path,
    backup: bool,
    auto_matches: dict[str, str],
    ibiz_companies: dict[str, IbizCompany],
) -> int:
    if backup:
        backup_path = companies_jsonl.with_suffix(f".backup-{now_utc_compact()}.jsonl")
        backup_path.write_bytes(companies_jsonl.read_bytes())
        print(f"Backup: {companies_jsonl} -> {backup_path}")

    updated = 0
    tmp_path = companies_jsonl.with_suffix(companies_jsonl.suffix + ".tmp")
    with companies_jsonl.open("r", encoding="utf-8") as src, tmp_path.open("w", encoding="utf-8") as dst:
        for line in src:
            raw = line.strip()
            if not raw:
                continue
            try:
                obj = json.loads(raw)
            except Exception:
                continue

            source_id = str(obj.get("source_id") or "").strip()
            current_websites = normalize_websites(obj.get("websites") or [])
            if source_id in auto_matches and not current_websites:
                candidate_subdomain = auto_matches[source_id]
                candidate = ibiz_companies.get(candidate_subdomain)
                if candidate and candidate.websites:
                    obj["websites"] = list(candidate.websites)
                    updated += 1

            dst.write(json.dumps(obj, ensure_ascii=False) + "\n")

    tmp_path.replace(companies_jsonl)
    return updated


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    default_companies_jsonl = repo_root / "app" / "public" / "data" / "biznesinfo" / "companies.jsonl"

    parser = argparse.ArgumentParser(
        description="Verify and optionally backfill missing websites in Biznesinfo from iBiz",
    )
    parser.add_argument("--companies-jsonl", default=str(default_companies_jsonl), help="Path to Biznesinfo companies.jsonl")
    parser.add_argument("--ibiz-db", default=str(DEFAULT_IBIZ_DB), help="Path to ibiz2.sqlite3")
    parser.add_argument("--report-json", default="", help="Write verification summary JSON to this path")
    parser.add_argument("--report-csv", default="", help="Write match details CSV to this path")
    parser.add_argument("--apply", action="store_true", help="Apply auto backfill updates in-place to companies.jsonl")
    parser.add_argument("--allow-weak-name-address", action="store_true", help="Allow auto backfill for unique name+address-only matches")
    parser.add_argument("--max-companies", type=int, default=0, help="Limit number of missing-website companies to process (0 = all)")
    parser.add_argument("--backup", dest="backup", action="store_true", default=True, help="Create backup before --apply")
    parser.add_argument("--no-backup", dest="backup", action="store_false", help="Do not create backup before --apply")
    args = parser.parse_args()

    companies_jsonl = Path(args.companies_jsonl)
    ibiz_db = Path(args.ibiz_db)

    if not companies_jsonl.exists():
        raise FileNotFoundError(f"companies.jsonl not found: {companies_jsonl}")
    if not ibiz_db.exists():
        raise FileNotFoundError(f"iBiz DB not found: {ibiz_db}")

    ibiz_companies = load_ibiz_companies(ibiz_db)
    by_phone, by_email, by_unp, by_name_addr = build_ibiz_indexes(ibiz_companies)

    total_companies = 0
    missing_websites_total = 0
    source_prefix_counts: Counter[str] = Counter()
    decisions: list[MatchDecision] = []

    with companies_jsonl.open("r", encoding="utf-8") as f:
        for line in f:
            raw = line.strip()
            if not raw:
                continue
            try:
                obj = json.loads(raw)
            except Exception:
                continue

            total_companies += 1
            source_id = str(obj.get("source_id") or "").strip()
            websites = normalize_websites(obj.get("websites") or [])
            if websites:
                continue

            missing_websites_total += 1
            source_prefix_counts[source_prefix(source_id)] += 1

            if args.max_companies and len(decisions) >= args.max_companies:
                continue

            candidates = collect_candidates(
                company=obj,
                ibiz_companies=ibiz_companies,
                by_phone=by_phone,
                by_email=by_email,
                by_unp=by_unp,
                by_name_addr=by_name_addr,
            )
            decision = decide_match(
                source_id=source_id,
                name=norm_space(str(obj.get("name") or "")),
                address=norm_space(str(obj.get("address") or "")),
                candidates=candidates,
                allow_weak_name_address=bool(args.allow_weak_name_address),
            )
            decisions.append(decision)

    counts: Counter[str] = Counter()
    by_prefix_and_type: Counter[str] = Counter()
    reason_combo_counts: Counter[str] = Counter()
    auto_matches: dict[str, str] = {}

    for decision in decisions:
        counts[decision.match_type] += 1
        by_prefix_and_type[f"{decision.source_prefix}:{decision.match_type}"] += 1

        if decision.evidence_by_candidate:
            for evidence in decision.evidence_by_candidate.values():
                combo = ",".join(sorted(evidence))
                reason_combo_counts[combo] += 1

        if decision.auto_candidate:
            auto_matches[decision.source_id] = decision.auto_candidate

    report = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "companies_jsonl": str(companies_jsonl),
        "ibiz_db": str(ibiz_db),
        "total_companies": total_companies,
        "missing_websites_total": missing_websites_total,
        "missing_websites_processed": len(decisions),
        "ibiz_companies_with_websites": len(ibiz_companies),
        "match_type_counts": dict(counts),
        "missing_source_prefix_counts": dict(source_prefix_counts),
        "prefix_match_type_counts": dict(by_prefix_and_type),
        "reason_combo_counts": dict(reason_combo_counts),
        "auto_backfill_count": len(auto_matches),
        "auto_examples": [
            {
                "source_id": d.source_id,
                "name": d.name,
                "candidate_subdomain": d.auto_candidate,
                "evidence": sorted(list(d.evidence_by_candidate.get(d.auto_candidate or "", set()))),
            }
            for d in decisions
            if d.auto_candidate
        ][:25],
        "ambiguous_examples": [
            {
                "source_id": d.source_id,
                "name": d.name,
                "candidates": sorted(d.evidence_by_candidate.keys()),
            }
            for d in decisions
            if d.match_type == "ambiguous"
        ][:25],
    }

    print(f"Total companies: {total_companies}")
    print(f"Missing websites: {missing_websites_total}")
    print(f"iBiz candidates with websites: {len(ibiz_companies)}")
    print(f"Match counts: {dict(counts)}")
    print(f"Auto backfill candidates: {len(auto_matches)}")
    if args.allow_weak_name_address:
        print("Weak name+address-only auto matching is ENABLED")
    else:
        print("Weak name+address-only auto matching is DISABLED")

    if args.report_json:
        report_json_path = Path(args.report_json)
        write_report_json(report_json_path, report)
        print(f"Report JSON: {report_json_path}")

    if args.report_csv:
        report_csv_path = Path(args.report_csv)
        write_report_csv(report_csv=report_csv_path, decisions=decisions, ibiz_companies=ibiz_companies)
        print(f"Report CSV: {report_csv_path}")

    if args.apply:
        updated = apply_backfill(
            companies_jsonl=companies_jsonl,
            backup=bool(args.backup),
            auto_matches=auto_matches,
            ibiz_companies=ibiz_companies,
        )
        print(f"Updated companies with backfilled websites: {updated}")
        if updated != len(auto_matches):
            print(
                "Note: updated count differs from auto matches (likely duplicate source_id or rows already non-empty at write time)."
            )
    else:
        print("Dry-run complete (no file changes).")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
