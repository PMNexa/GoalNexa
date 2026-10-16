"""What happens to a user's goals when their account is deleted
(`core_api.system.user_removed`):

- with `transfer_to`: their goals and cycles become that user's, and
  their goal memberships move to them (unless they already have one);
- without: their goals (with metrics and check-ins) and personal cycles
  are deleted, org cycles they created stay with the org. Their goal
  memberships, reminder settings and public dashboard links go either
  way. Comments, check-ins and feed entries by them on other people's
  goals stay, unattributed when erasing.
"""

from goalnexa.models import (
    Activity,
    CheckIn,
    Cycle,
    DashboardShare,
    Goal,
    GoalComment,
    GoalMember,
    GoalStatus,
    GoalTemplate,
    Metric,
    OnboardingChoice,
    ReminderSettings,
)


def on_user_removed(sender, user_id, transfer_to=None, **kwargs):
    ReminderSettings.objects.filter(user_id=user_id).delete()
    OnboardingChoice.objects.filter(user_id=user_id).delete()
    # A public link speaks for whoever made it - never handed on.
    DashboardShare.objects.filter(owner_id=user_id).delete()
    if transfer_to:
        Goal.objects.filter(owner_id=user_id).update(owner_id=transfer_to)
        Cycle.objects.filter(owner_id=user_id).update(owner_id=transfer_to)
        GoalTemplate.objects.filter(owner_id=user_id).update(owner_id=transfer_to)
        for member in GoalMember.objects.filter(user_id=user_id):
            if GoalMember.objects.filter(goal_id=member.goal_id, user_id=transfer_to).exists() or Goal.objects.filter(
                id=member.goal_id, owner_id=transfer_to
            ).exists():
                member.delete()
            else:
                GoalMember.objects.filter(id=member.id).update(user_id=transfer_to)
        return
    GoalMember.objects.filter(user_id=user_id).delete()
    # A template and its teams' instances are the org's: they stay, owned by
    # nobody in particular (an org owner/admin edits a template anyway).
    _keep_org_work(user_id)
    Goal.objects.filter(owner_id=user_id).delete()
    Cycle.objects.filter(owner_id=user_id, org_id__isnull=True).delete()
    GoalComment.objects.filter(author_id=user_id).delete()
    CheckIn.objects.filter(author_id=user_id).update(author_id=None)
    Activity.objects.filter(actor_id=user_id).update(actor_id=None)


def _keep_org_work(user_id) -> None:
    """Team instances and totals of an erased user: handed to the
    template's owner (else the instance's other team work stays orphaned)."""
    for goal in Goal.objects.filter(owner_id=user_id, template_goal__isnull=False).select_related("template_goal__template"):
        owner = goal.template_goal.template.owner_id
        if str(owner) != str(user_id):
            Goal.objects.filter(id=goal.id).update(owner_id=owner)


def on_org_removed(sender, org_id, **kwargs):
    """An org's goals (with their metrics and check-ins), cycles and goal templates go with it."""
    Goal.objects.filter(org_id=org_id).delete()
    Cycle.objects.filter(org_id=org_id).delete()
    GoalTemplate.objects.filter(org_id=org_id).delete()


def on_team_removed(sender, team_id, org_id, parent_id=None, instances="move", **kwargs):
    """A deleted team's goals move to its parent team, or are archived
    (`instances`). Its template instances move only if the parent team has
    none of its own in that cycle (one instance per team); otherwise - and
    always for a top-level team - they're archived and detached from the
    template, so their history stays as ordinary goals. Its totals go."""
    from goalnexa.templates import tree_goals

    Goal.objects.filter(team_id=team_id, is_rollup=True).delete()
    goals = Goal.objects.filter(team_id=team_id)
    roots = goals.filter(template_goal__isnull=False, template_goal__parent__isnull=True).select_related("template_goal")
    for root in roots:
        template_id = root.template_goal.template_id
        ids = list(tree_goals(template_id, team_id, root.cycle_id, False).values_list("id", flat=True))
        taken = parent_id is None or tree_goals(template_id, parent_id, root.cycle_id, False).exists()
        if instances == "archive" or taken:
            Metric.objects.filter(goal_id__in=ids).update(template_metric=None)
            Goal.objects.filter(id__in=ids).update(template_goal=None, status=GoalStatus.ARCHIVED)
    if instances == "archive":
        goals.update(status=GoalStatus.ARCHIVED)
    Goal.objects.filter(team_id=team_id).update(team_id=parent_id)


def on_team_changed(sender, team_id=None, org_id=None, **kwargs):
    """The team tree changed - every total of the org follows it."""
    from goalnexa.rollups import recompute_org

    if org_id:
        recompute_org(org_id)


def usage() -> list[dict]:
    """Numbers for the admin's Status page."""
    from datetime import timedelta

    from django.db.models import Count
    from django.utils import timezone

    from goalnexa.models import GoalHealth, GoalStatus, Metric

    now = timezone.now()
    live = Goal.objects.exclude(status__in=[GoalStatus.COMPLETED, GoalStatus.ARCHIVED])
    health = dict(live.values_list("health").annotate(n=Count("id")))

    def check_ins(days: int) -> dict:
        """Who logged the check-ins of the last `days` days: web, AI agent, ingest."""
        rows = CheckIn.objects.filter(created_at__gte=now - timedelta(days=days))
        sources = dict(rows.values_list("source").annotate(n=Count("id")))
        total = sum(sources.values())
        shares = (
            f"{source} {sources.get(source, 0)} ({round(sources.get(source, 0) * 100 / total) if total else 0}%)"
            for source in ("web", "mobile", "agent", "ingest")
        )
        return {"label": f"Check-ins, last {days} days", "value": total, "hint": " · ".join(shares)}

    return [
        {"label": "Goals in progress", "value": live.count()},
        {"label": "On track / at risk / off track", "value": " / ".join(
            str(health.get(h, 0)) for h in (GoalHealth.ON_TRACK, GoalHealth.AT_RISK, GoalHealth.OFF_TRACK))},
        check_ins(7),
        check_ins(30),
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
    onboarding = OnboardingChoice.objects.filter(user_id=user_id).first()
    return {
        "onboarding_choice": onboarding.choice if onboarding else None,
        "goals": goals,
        "cycles": CycleSerializer(Cycle.objects.filter(owner_id=user_id), many=True).data,
        "goal_templates": [
            {"id": str(t.id), "title": t.title, "org_id": str(t.org_id)} for t in GoalTemplate.objects.filter(owner_id=user_id)
        ],
        "goal_memberships": [str(g) for g in GoalMember.objects.filter(user_id=user_id).values_list("goal_id", flat=True)],
        "comments": GoalCommentSerializer(GoalComment.objects.filter(author_id=user_id), many=True).data,
        "check_ins_on_other_goals": CheckInSerializer(
            CheckIn.objects.filter(author_id=user_id).exclude(metric__goal__owner_id=user_id), many=True
        ).data,
        "dashboard_shares": [
            {"title": s.title, "goals": s.goal_ids, "created_at": s.created_at.isoformat()}
            for s in DashboardShare.objects.filter(owner_id=user_id)
        ],
        "reminder_settings": {
            "enabled": reminder.enabled, "urls": reminder.url_list(), "email": reminder.email,
            "digest": reminder.digest, "timezone": reminder.timezone,
        } if reminder else None,
    }
