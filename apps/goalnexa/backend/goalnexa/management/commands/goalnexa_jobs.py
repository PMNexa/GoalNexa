"""`manage.py goalnexa_jobs [--loop SECONDS]` - goalnexa's time-driven work,
what no request triggers:

- goals whose target date just passed get their health recomputed
  (`goalnexa.progress` - an on-track goal past its date is off track);
- overdue check-in reminders go out (`goalnexa.reminders`);
- every goal gets its daily snapshot, and due digests go out
  (`goalnexa.digest`);
- the platform's own jobs run (`core_api.system.run_system_jobs`:
  retrying queued email).

Each run reports a heartbeat - the admin's Status page shows when the
scheduler last ran and whether it failed.

Once, or forever with `--loop` (the `scheduler` service in the compose
and stack files). Safe to run more than once at a time.
"""

import logging
import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections
from django.utils import timezone

from core_api.system import count, heartbeat, run_system_jobs
from goalnexa.digest import send_due_digests, snapshot_goals
from goalnexa.models import Goal, GoalHealth
from goalnexa.progress import refresh_goal
from goalnexa.reminders import send_due_reminders

logger = logging.getLogger(__name__)


def run_once() -> dict:
    today = timezone.localdate()
    lapsed = Goal.objects.filter(target_date__lt=today, health__in=[GoalHealth.ON_TRACK, GoalHealth.AT_RISK])
    refreshed = 0
    for goal_id in lapsed.values_list("id", flat=True):
        refresh_goal(goal_id)
        refreshed += 1
    return {
        "goals_refreshed": refreshed,
        "users_reminded": send_due_reminders(),
        "snapshots": snapshot_goals(today),
        "digests": send_due_digests(),
        # The platform's own periodic work (retrying queued email).
        **run_system_jobs(),
    }


class Command(BaseCommand):
    help = "Recompute time-dependent goal health and send due check-in reminders."

    def add_arguments(self, parser):
        parser.add_argument("--loop", type=int, default=0, metavar="SECONDS", help="Repeat every SECONDS (0 = once).")

    def handle(self, *args, loop, **options):
        while True:
            started = time.perf_counter()
            try:
                result = run_once()
                heartbeat("goalnexa_jobs", result=result)
                count("job", "goalnexa_jobs", ms=(time.perf_counter() - started) * 1000)
                if any(result.values()) or not loop:
                    self.stdout.write(f"{timezone.now().isoformat()} {result}")
            except Exception as exc:
                heartbeat("goalnexa_jobs", ok=False, error=f"{type(exc).__name__}: {exc}")
                count("job", "goalnexa_jobs", ok=False, ms=(time.perf_counter() - started) * 1000)
                if not loop:
                    raise
                logger.exception("goalnexa_jobs run failed")
            if not loop:
                return
            close_old_connections()
            time.sleep(loop)
