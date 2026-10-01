"""What happens to a user's goals when their account is deleted
(`core_api.system.user_removed`):

- with `transfer_to`: their goals and cycles become that user's, and
  their goal memberships move to them (unless they already have one);
- without: their goals (with metrics and check-ins) and personal cycles
  are deleted, org cycles they created stay with the org. Their goal
  memberships and reminder settings go either way. Comments, check-ins
  and feed entries by them on other people's goals stay, unattributed
  when erasing.
"""

from goalnexa.models import Activity, CheckIn, Cycle, Goal, GoalComment, GoalMember, ReminderSettings


def on_user_removed(sender, user_id, transfer_to=None, **kwargs):
    ReminderSettings.objects.filter(user_id=user_id).delete()
    if transfer_to:
        Goal.objects.filter(owner_id=user_id).update(owner_id=transfer_to)
        Cycle.objects.filter(owner_id=user_id).update(owner_id=transfer_to)
        for member in GoalMember.objects.filter(user_id=user_id):
            if GoalMember.objects.filter(goal_id=member.goal_id, user_id=transfer_to).exists() or Goal.objects.filter(
                id=member.goal_id, owner_id=transfer_to
            ).exists():
                member.delete()
            else:
                GoalMember.objects.filter(id=member.id).update(user_id=transfer_to)
        return
    GoalMember.objects.filter(user_id=user_id).delete()
    Goal.objects.filter(owner_id=user_id).delete()
    Cycle.objects.filter(owner_id=user_id, org_id__isnull=True).delete()
    GoalComment.objects.filter(author_id=user_id).delete()
    CheckIn.objects.filter(author_id=user_id).update(author_id=None)
    Activity.objects.filter(actor_id=user_id).update(actor_id=None)


def on_org_removed(sender, org_id, **kwargs):
    """An org's goals (with their metrics and check-ins) and cycles go with it."""
    Goal.objects.filter(org_id=org_id).delete()
    Cycle.objects.filter(org_id=org_id).delete()


def usage() -> list[dict]:
    """Numbers for the admin's Status page."""
    from datetime import timedelta

    from django.db.models import Count
    from django.utils import timezone

    from goalnexa.models import GoalHealth, GoalStatus, Metric

    now = timezone.now()
    live = Goal.objects.exclude(status__in=[GoalStatus.COMPLETED, GoalStatus.ARCHIVED])
    health = dict(live.values_list("health").annotate(n=Count("id")))
    week = CheckIn.objects.filter(created_at__gte=now - timedelta(days=7))
    sources = dict(week.values_list("source").annotate(n=Count("id")))
    return [
        {"label": "Goals in progress", "value": live.count()},
        {"label": "On track / at risk / off track", "value": " / ".join(
            str(health.get(h, 0)) for h in (GoalHealth.ON_TRACK, GoalHealth.AT_RISK, GoalHealth.OFF_TRACK))},
        {"label": "Check-ins, last 7 days", "value": week.count(),
         "hint": f"web {sources.get('web', 0)} · agent {sources.get('agent', 0)} · ingest {sources.get('ingest', 0)}"},
        {"label": "Metrics overdue", "value": Metric.objects.filter(check_in_due_at__lte=now).exclude(
            goal__status__in=[GoalStatus.COMPLETED, GoalStatus.ARCHIVED]).count()},
        {"label": "Active cycles", "value": Cycle.objects.filter(status="active").count()},
    ]


def export(user_id: str) -> dict:
    """The goals, cycles, comments and check-ins a user owns or wrote."""
    from goalnexa.serializers import CheckInSerializer, CycleSerializer, GoalCommentSerializer, GoalSerializer, MetricSerializer

    goals = []
    for goal in Goal.objects.filter(owner_id=user_id).prefetch_related("metrics__check_ins"):
        metrics = []
        for metric in goal.metrics.all():
            metrics.append({**MetricSerializer(metric).data,
                            "check_ins": CheckInSerializer(metric.check_ins.all(), many=True).data})
        goals.append({**GoalSerializer(goal).data, "metrics": metrics})
    reminder = ReminderSettings.objects.filter(user_id=user_id).first()
    return {
        "goals": goals,
        "cycles": CycleSerializer(Cycle.objects.filter(owner_id=user_id), many=True).data,
        "goal_memberships": [str(g) for g in GoalMember.objects.filter(user_id=user_id).values_list("goal_id", flat=True)],
        "comments": GoalCommentSerializer(GoalComment.objects.filter(author_id=user_id), many=True).data,
        "check_ins_on_other_goals": CheckInSerializer(
            CheckIn.objects.filter(author_id=user_id).exclude(metric__goal__owner_id=user_id), many=True
        ).data,
        "reminder_settings": {
            "enabled": reminder.enabled, "urls": reminder.url_list(), "email": reminder.email,
            "digest": reminder.digest, "timezone": reminder.timezone,
        } if reminder else None,
    }
