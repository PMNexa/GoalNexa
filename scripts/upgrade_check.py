#!/usr/bin/env python3
"""The data half of the upgrade test (scripts/upgrade_test.sh): what the
demo account sees through the REST API before an upgrade must still be
there, unchanged, after it - and the upgraded instance must still take
writes.

    python3 scripts/upgrade_check.py snapshot snapshot.json --url http://localhost:8765
    ... upgrade ...
    python3 scripts/upgrade_check.py verify snapshot.json --url http://localhost:8765

`snapshot` records every row of each resource the old release serves
(one it doesn't have yet is skipped); `verify` checks each row is still
there with the same values in the fields a person entered, then logs a
check-in and expects the metric to move. Only the standard library, and
only the public API - so it runs against any release.
"""

import argparse
import json
import sys
import urllib.error
import urllib.request

# Per resource, the fields a person entered - what an upgrade must never
# change. Computed fields (progress, health, due dates) may be recomputed.
RESOURCES = {
    "orgs": ["name"],
    "goals": ["title", "description", "target_date", "status"],
    "metrics": ["name", "unit", "base_value", "target_value", "current_value"],
    "check-ins": ["value", "note", "checked_in_at"],
    "cycles": ["name", "starts_on", "ends_on"],
    "goal-comments": ["body"],
}


class Api:
    def __init__(self, url, email, password):
        self.base = url.rstrip("/") + "/api/v1"
        self.token = None
        self.token = self.call("POST", "/auth/login", {"email": email, "password": password})["access_token"]

    def call(self, method, path, body=None, missing_ok=False):
        request = urllib.request.Request(
            self.base + path,
            method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {self.token}"} if self.token else {})},
        )
        try:
            with urllib.request.urlopen(request) as response:
                raw = response.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            if missing_ok and error.code == 404:
                return None
            raise SystemExit(f"FAIL {method} {path} -> {error.code} {error.read()[:300]!r}") from None

    def rows(self, resource):
        """Every row, or None when this release doesn't serve the resource."""
        rows, page = [], 1
        while True:
            data = self.call("GET", f"/{resource}?page_size=100&page={page}", missing_ok=True)
            if data is None:
                return None
            rows += data["items"]
            if len(rows) >= data["total"] or not data["items"]:
                return rows
            page += 1


def same(before, after):
    try:
        return float(before) == float(after)
    except (TypeError, ValueError):
        return before == after


def snapshot(api, path):
    data = {}
    for resource, fields in RESOURCES.items():
        rows = api.rows(resource)
        if rows is None:
            print(f"  {resource}: not in this release")
            continue
        data[resource] = {row["id"]: {f: row[f] for f in fields if f in row} for row in rows}
        print(f"  {resource}: {len(rows)}")
    if not data.get("goals") or not data.get("check-ins"):
        raise SystemExit("FAIL nothing to snapshot - seed the instance first (scripts/seed_demo.py)")
    with open(path, "w") as out:
        json.dump(data, out, indent=1)


def verify(api, path):
    with open(path) as source:
        before = json.load(source)
    problems = []
    for resource, old_rows in before.items():
        rows = api.rows(resource)
        if rows is None:
            problems.append(f"{resource}: the resource is gone")
            continue
        now = {row["id"]: row for row in rows}
        if len(now) != len(old_rows):
            problems.append(f"{resource}: {len(old_rows)} rows before, {len(now)} after")
        for row_id, old in old_rows.items():
            if row_id not in now:
                problems.append(f"{resource}/{row_id}: missing")
                continue
            for field, value in old.items():
                if field not in now[row_id]:
                    problems.append(f"{resource}/{row_id}: field {field} is gone")
                elif not same(value, now[row_id][field]):
                    problems.append(f"{resource}/{row_id}.{field}: {value!r} -> {now[row_id][field]!r}")
        print(f"  {resource}: {len(old_rows)} rows checked")
    if problems:
        raise SystemExit("FAIL the upgrade changed data:\n  " + "\n  ".join(problems[:40]))

    # Still takes writes: a check-in moves its metric.
    metric = api.rows("metrics")[0]
    value = float(metric["target_value"])
    api.call("POST", "/check-ins", {"metric": metric["id"], "value": value, "note": "after the upgrade"})
    current = float(api.call("GET", f"/metrics/{metric['id']}")["current_value"])
    if metric.get("aggregation") != "sum" and current != value:
        raise SystemExit(f"FAIL a check-in of {value} left the metric at {current}")
    print(f"  wrote a check-in; {metric['name']!r} is now {current}")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("mode", choices=["snapshot", "verify"])
    parser.add_argument("file")
    parser.add_argument("--url", default="http://localhost:8765")
    # scripts/seed_demo.py's defaults.
    parser.add_argument("--email", default="alex@northwind.example")
    parser.add_argument("--password", default="CorrectHorse!Battery9")
    args = parser.parse_args()
    api = Api(args.url, args.email, args.password)
    {"snapshot": snapshot, "verify": verify}[args.mode](api, args.file)
    print(f"{args.mode}: ok")


if __name__ == "__main__":
    sys.exit(main())
