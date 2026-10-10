"""Lifecycle email that needs more than one module (`core_api.lifecycle`;
goalnexa's own journeys are in `goalnexa/lifecycle.py`):

- signals from platform-auth and platform-org writes, caught here with
  Django's `post_save` so neither module has to know about lifecycle
  email: `signup` (a new account - the onboarding journey and the digest
  default start from it) and `invite_sent`;
- the team journeys, which join organizations, activity and goals:
  **team-invite** (active two separate weeks, still alone: invite
  someone) and **team-quiet** (an organization whose members stopped
  checking in: a summary for its owner).
"""

from __future__ import annotations

from datetime import timedelta

from django.db.models.signals import post_save

from core_api.lifecycle import Enrolled, Journey, Message, Step, StepContext, record_signal, register_journey


def _on_user_saved(sender, instance, created, **kwargs):
    if created:
        record_signal(instance.id, "signup")


def _on_invitation_saved(sender, instance, created, **kwargs):
    if created:
        record_signal(instance.invited_by, "invite_sent", org_id=str(instance.org_id))


def _teammates(user_id) -> bool:
    """Shares an organization with someone, or has invited someone."""
    from platform_org.models import OrgInvitation, OrgMembership
    from platform_org.models.org_membership import OrgMembershipStatus

    orgs = OrgMembership.objects.filter(user_id=user_id, status=OrgMembershipStatus.ACTIVE).values("org_id")
    shared = (
        OrgMembership.objects.filter(org_id__in=orgs, status=OrgMembershipStatus.ACTIVE).exclude(user_id=user_id).exists()
    )
    return shared or OrgInvitation.objects.filter(invited_by=user_id).exists()


def _two_active_weeks(now):
    """Users active in at least two different weeks of the last four."""
    from platform_system.models import UserDay

    weeks: dict[str, set] = {}
    for user_id, day in UserDay.objects.filter(date__gte=(now - timedelta(days=28)).date()).values_list("user_id", "date"):
        weeks.setdefault(user_id, set()).add(day.isocalendar()[:2])
    for user_id, seen in weeks.items():
        if len(seen) >= 2 and not _teammates(user_id):
            yield user_id, "", {}


def _has_team(enrollment: Enrolled, now) -> str | None:
    return "has a team" if _teammates(enrollment.user_id) else None


def _invite(ctx: StepContext) -> Message | None:
    from platform_org.models import OrgMembership

    if _teammates(ctx.user_id):
        return None
    has_org = OrgMembership.objects.filter(user_id=ctx.user_id).exists()
    return Message(
        "Track this with your team",
        ["You've been at it for a couple of weeks now. Goals move faster when the people working on them see "
         "the same numbers.",
         "Invite a teammate to your organization: they see its goals, check in on their metrics, and you all "
         "get one dashboard." if has_org else
         "Create an organization for your team and invite them: everyone sees its goals and checks in on their "
         "own metrics."],
        ("Invite your team", "/platform-org/orgs"),
    )


def _quiet_orgs(now):
    """Organizations with 2+ members, check-ins in the 30 days before, none
    in the last 7 - their owner gets one summary a month at most."""
    from goalnexa.models import CheckIn
    from platform_org.models import OrgMembership
    from platform_org.models.org_membership import OrgMembershipStatus, OrgRole

    week, month = now - timedelta(days=7), now - timedelta(days=37)
    active = OrgMembership.objects.filter(status=OrgMembershipStatus.ACTIVE)
    for owner in active.filter(role=OrgRole.OWNER):
        if active.filter(org_id=owner.org_id).count() < 2:
            continue
        check_ins = CheckIn.objects.filter(metric__goal__org_id=owner.org_id)
        if check_ins.filter(checked_in_at__gte=week).exists() or not check_ins.filter(checked_in_at__gte=month).exists():
            continue
        yield str(owner.user_id), f"{owner.org_id}:{now:%Y-%m}", {"org_id": str(owner.org_id)}


def _quiet_summary(ctx: StepContext) -> Message | None:
    from django.db.models import Max

    from config.user_directory import lookup_users
    from goalnexa.models import CheckIn
    from platform_org.models import Organization, OrgMembership
    from platform_org.models.org_membership import OrgMembershipStatus

    org = Organization.objects.filter(id=ctx.data.get("org_id")).first()
    if org is None:
        return None
    check_ins = CheckIn.objects.filter(metric__goal__org_id=org.id)
    if check_ins.filter(checked_in_at__gte=ctx.now - timedelta(days=7)).exists():
        return None  # they picked it up again
    members = list(
        OrgMembership.objects.filter(org_id=org.id, status=OrgMembershipStatus.ACTIVE).values_list("user_id", flat=True)
    )
    names = lookup_users([str(m) for m in members])
    last = dict(check_ins.values("author_id").annotate(at=Max("checked_in_at")).values_list("author_id", "at"))
    lines = []
    for member in members:
        name = (names.get(str(member)) or {}).get("name") or (names.get(str(member)) or {}).get("email") or "Someone"
        at = last.get(member)
        lines.append(f"- {name}: {'last check-in ' + at.strftime('%b %d') if at else 'no check-ins yet'}")
    return Message(
        f"{org.name}: no check-ins this week",
        [f"Nobody in {org.name} has checked in for a week. Here's where everyone was:", "\n".join(lines),
         "A quick round of check-ins - or a word in your next team meeting - gets the dashboard current again."],
        ("Open the team dashboard", "/dashboard"),
    )


TEAM_INVITE = Journey(
    "team-invite", "Team: invite", "tips", enter=_two_active_weeks, exit=_has_team,
    description="Active in two separate weeks with nobody to share goals with: invite a teammate.",
    steps=[Step("invite", timedelta(0), _invite, target="invite_sent", label="Invite your team")],
)

TEAM_QUIET = Journey(
    "team-quiet", "Team: gone quiet", "progress", enter=_quiet_orgs,
    description="An organization whose members stopped checking in for a week: a summary for its owner.",
    steps=[Step("summary", timedelta(0), _quiet_summary, target="check_in", label="Owner summary")],
)


def register() -> None:
    from platform_auth.models import User
    from platform_org.models import OrgInvitation

    post_save.connect(_on_user_saved, sender=User, dispatch_uid="host.lifecycle.signup")
    post_save.connect(_on_invitation_saved, sender=OrgInvitation, dispatch_uid="host.lifecycle.invite_sent")
    register_journey(TEAM_INVITE)
    register_journey(TEAM_QUIET)
