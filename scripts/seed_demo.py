#!/usr/bin/env python3
"""Seed a demo account with realistic goals, metrics and ~3 months of
weekly check-ins, through the public REST API (so it works against any
running instance, no DB access). This is the data behind the README's
screenshots and walkthrough.

    python3 scripts/seed_demo.py                      # http://localhost:55607
    python3 scripts/seed_demo.py --url https://goals.example.com --reset

Signs the demo user up (or logs in if it exists). `--reset` first
deletes that user's check-ins, metrics, goals and organizations. Only
the standard library is used.
"""

import argparse
import datetime as dt
import json
import random
import urllib.error
import urllib.request

GOALS = [
    # (team goal?, title, target date, description, [(metric, unit, base, target, progress reached by now)])
    (True, "Launch v2 of the mobile app", "2026-12-15", "Ship the redesigned app to both stores with a public beta first.", [
        ("Beta testers", "users", 0, 500, 0.72), ("App Store rating", "★", 3.8, 4.6, 0.55), ("Crash-free sessions", "%", 97.0, 99.5, 0.64)]),
    (True, "Grow the newsletter to 10k subscribers", "2026-12-31", "", [
        ("Subscribers", "", 2400, 10000, 0.58), ("Open rate", "%", 38, 45, 0.47)]),
    (True, "Cut customer response time", "2026-10-31", "Median first response under two hours, without hurting resolution rate.", [
        ("Median first response", "hours", 12, 2, 0.81), ("Tickets resolved / week", "", 80, 150, 0.6)]),
    (True, "Hire the Q4 platform team", "2026-11-30", "", [
        ("Engineers hired", "", 0, 4, 0.5)]),
    (False, "Run a half marathon", "2026-11-08", "Autumn city half. Build base, then long runs.", [
        ("Weekly distance", "km", 10, 40, 0.68), ("Longest run", "km", 5, 21, 0.62)]),
    (False, "Read 24 books this year", "2026-12-31", "", [
        ("Books finished", "", 0, 24, 0.7)]),
]
NOTES = ["", "", "", "Good week", "Slower than planned", "Big jump after launch post", "Back on track", ""]


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--url", default="http://localhost:55607")
    parser.add_argument("--email", default="alex@northwind.example")
    parser.add_argument("--password", default="CorrectHorse!Battery9")
    parser.add_argument("--name", default="Alex Rivera")
    parser.add_argument("--org", default="Northwind Studio")
    parser.add_argument("--start", default="2026-07-01", help="date of the first weekly check-in")
    parser.add_argument("--weeks", type=int, default=12)
    parser.add_argument("--reset", action="store_true", help="delete the demo user's existing data first")
    args = parser.parse_args()
    api = args.url.rstrip("/") + "/api/v1"

    def call(method, path, body=None, token=None):
        request = urllib.request.Request(
            api + path,
            method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})},
        )
        try:
            with urllib.request.urlopen(request) as response:
                raw = response.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            raise SystemExit(f"{method} {path} -> {error.code} {error.read()[:300]!r}") from None

    try:
        token = call("POST", "/auth/login", {"email": args.email, "password": args.password})["access_token"]
    except SystemExit:
        token = call("POST", "/auth/signup", {"email": args.email, "name": args.name, "password": args.password})["access_token"]

    if args.reset:
        for resource in ("check-ins", "metrics", "goals", "orgs"):
            while items := call("GET", f"/{resource}?page_size=100", token=token)["items"]:
                for item in items:
                    call("DELETE", f"/{resource}/{item['id']}", token=token)

    org = call("POST", "/orgs", {"name": args.org}, token)
    random.seed(7)  # same data every run
    start = dt.datetime.fromisoformat(args.start).replace(hour=9, minute=30, tzinfo=dt.timezone.utc)

    for team, title, target_date, description, metrics in GOALS:
        goal = call("POST", "/goals", {
            "title": title, "status": "in_progress", "target_date": target_date,
            "description": description, "org_id": org["id"] if team else None,
        }, token)
        for name, unit, base, target, reach in metrics:
            metric = call("POST", "/metrics", {"name": name, "unit": unit, "goal": goal["id"], "base_value": base, "target_value": target}, token)
            whole = float(base).is_integer() and float(target).is_integer() and abs(target - base) >= 4
            progress = 0.0
            for week in range(1, args.weeks + 1):
                # Eases towards `reach`, with noise and the odd flat week.
                aim = reach * (week / args.weeks) ** 0.9
                progress = max(0.0, min(1.0, progress + (aim - progress) * 0.8 + random.uniform(-0.035, 0.03)))
                value = base + (target - base) * progress
                when = start + dt.timedelta(days=7 * (week - 1) + random.randint(0, 2), hours=random.randint(0, 8))
                call("POST", "/check-ins", {
                    "metric": metric["id"], "value": round(value) if whole else round(value, 2),
                    "note": random.choice(NOTES), "checked_in_at": when.isoformat(),
                }, token)
        print(f"seeded {title}")
    print(f"\nLog in at {args.url} as {args.email} / {args.password}")


if __name__ == "__main__":
    main()
