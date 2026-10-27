from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7
from goalnexa.models.cycle import Cycle


class GoalStatus(models.TextChoices):
    NOT_STARTED = "not_started", "Not started"
    IN_PROGRESS = "in_progress", "In progress"
    COMPLETED = "completed", "Completed"
    ARCHIVED = "archived", "Archived"


class GoalVisibility(models.TextChoices):
    PUBLIC = "public", "Public"
    PRIVATE = "private", "Private"
    TEAM = "team", "Team"


class SnapTo(models.TextChoices):
    """What a check-in is for (P-63): any moment, or a whole period - its
    time is then snapped to the period's first day (`CheckIn.save`)."""

    ANY = "", "Any time"
    DAY = "day", "A day"
    WEEK = "week", "A week"
    MONTH = "month", "A month"
    QUARTER = "quarter", "A quarter"
    YEAR = "year", "A year"


class Weekday(models.IntegerChoices):
    MONDAY = 1, "Monday"
    TUESDAY = 2, "Tuesday"
    WEDNESDAY = 3, "Wednesday"
    THURSDAY = 4, "Thursday"
    FRIDAY = 5, "Friday"
    SATURDAY = 6, "Saturday"
    SUNDAY = 7, "Sunday"


class QuarterMonth(models.IntegerChoices):
    FIRST = 1, "1st month (Jan, Apr, Jul, Oct)"
    SECOND = 2, "2nd month (Feb, May, Aug, Nov)"
    THIRD = 3, "3rd month (Mar, Jun, Sep, Dec)"


class Month(models.IntegerChoices):
    JANUARY = 1, "January"
    FEBRUARY = 2, "February"
    MARCH = 3, "March"
    APRIL = 4, "April"
    MAY = 5, "May"
    JUNE = 6, "June"
    JULY = 7, "July"
    AUGUST = 8, "August"
    SEPTEMBER = 9, "September"
    OCTOBER = 10, "October"
    NOVEMBER = 11, "November"
    DECEMBER = 12, "December"


#: The times a check-in's moment can be at, every 30 minutes.
SNAP_TIMES = [(f"{h:02d}:{m:02d}", f"{h:02d}:{m:02d}") for h in range(24) for m in (0, 30)]


class SnapMoment(models.Model):
    """When in its period a check-in for a period is (P-80): its time is
    set to this moment, and with `snap_due` it's also when the period's
    check-in is due (flagged and reminded). Which fields apply depends on
    `snap_to`: a day - the time; a week - the weekday; a month - the day of
    the month; a quarter - its month and the day; a year - the month and the
    day. A day past a month's end is its last day. The defaults are the
    period's first day, 00:00 - where check-ins were stamped before P-80.
    On a goal or metric following another (`Goal.snap_to_parent`,
    `Metric.snap_to_goal`) these hold the values in effect, like `snap_to`."""

    snap_weekday = models.PositiveSmallIntegerField(
        "day of the week", choices=Weekday.choices, default=Weekday.MONDAY, db_default=Weekday.MONDAY
    )
    snap_quarter_month = models.PositiveSmallIntegerField(
        "month of the quarter", choices=QuarterMonth.choices, default=QuarterMonth.FIRST, db_default=QuarterMonth.FIRST
    )
    snap_month = models.PositiveSmallIntegerField("month", choices=Month.choices, default=Month.JANUARY, db_default=Month.JANUARY)
    snap_day = models.PositiveSmallIntegerField(
        "day of the month", default=1, db_default=1, validators=[MinValueValidator(1), MaxValueValidator(31)]
    )
    snap_time = models.CharField("time", max_length=5, choices=SNAP_TIMES, default="00:00", db_default="00:00")
    # db_default False: rows from before P-80 keep their own schedule (`check_in_every`).
    snap_due = models.BooleanField("due at that moment", default=True, db_default=False)

    class Meta:
        abstract = True


class GoalHealth(models.TextChoices):
    """Where a goal is heading - see `goalnexa.progress.goal_health`."""

    UNKNOWN = "unknown", "Unknown"
    ON_TRACK = "on_track", "On track"
    AT_RISK = "at_risk", "At risk"
    OFF_TRACK = "off_track", "Off track"
    ACHIEVED = "achieved", "Achieved"


class Goal(TimestampedModel, SnapMoment):
    """`owner_id` is a bare UUIDField, not a ForeignKey - this module
    shares nothing at the DB level with whatever module owns the actual
    User table (platform-auth), same convention as platform-org's
    `OrgMembership.user_id`. The value is trusted to be a real user id
    because it comes from `request.user.id` (see GoalViewSet.perform_create),
    not looked up or validated against a users table here.

    `org_id` is the same kind of bare id, for platform-org's Organization -
    null for a personal goal (only its owner sees it), set for a team one,
    which every member of that org sees and works on too (`access.py`,
    asking platform-org's own viewset which orgs the caller is in - no
    Python import of its models). Setting it is checked the same way
    (`BaseViewSet._check_cross_module_ids`): only an org you belong to.

    `visibility` narrows that for an org goal: PUBLIC (the default) is
    seen by every member of the org, PRIVATE only by its owner and its
    `members` (`GoalMember`). A personal goal is private either way. Only
    the owner changes it (`GoalViewSet.perform_update`).

    `progress`, `projected_progress` and `health` are computed by the
    server (`goalnexa.progress.refresh_goal`) whenever a check-in, one of
    its metrics or its target date changes - the same math as the
    dashboard, stored so an agent, a digest or a filter
    (`?filter{health}=at_risk`) doesn't redo it.
    """

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    owner_id = models.UUIDField()
    org_id = models.UUIDField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=GoalStatus.choices, default=GoalStatus.NOT_STARTED)
    target_date = models.DateField(null=True, blank=True)
    # db_default too: the previous release's code, still running while a
    # deploy migrates, inserts goals without this column.
    visibility = models.CharField(
        max_length=16,
        choices=GoalVisibility.choices,
        default=GoalVisibility.PUBLIC,
        db_default=GoalVisibility.PUBLIC,
        help_text="Public: every member of its organization sees it. Private: only you and the goal's members. "
        "Team: its team (and the teams under it) and the organization's owners and admins.",
    )
    # What its metrics' check-ins are for (P-64): the default for every
    # metric set to "same as goal" (`Metric.snap_to_goal`).
    snap_to = models.CharField(
        "check-ins are for", max_length=8, choices=SnapTo.choices, default=SnapTo.ANY, db_default=SnapTo.ANY,
        blank=True,
    )
    # P-80: a sub-goal's setting follows its parent goal's (the API shows
    # `snap_to` as "parent"; a top-level goal following nothing is any
    # time). Like `Metric.snap_to_goal`, the stored fields hold what's in
    # effect. db_default False: the previous release's code sends `snap_to`.
    snap_to_parent = models.BooleanField("same as parent goal", default=True, db_default=False)
    progress = models.DecimalField(
        max_digits=9, decimal_places=2, null=True, blank=True, help_text="Mean progress of its root metrics, in %."
    )
    projected_progress = models.DecimalField(
        max_digits=9,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Progress expected by the target date if each metric keeps its check-in trend, in %.",
    )
    health = models.CharField(
        max_length=16,
        choices=GoalHealth.choices,
        default=GoalHealth.UNKNOWN,
        db_default=GoalHealth.UNKNOWN,
        help_text="Where the goal is heading: from its projected progress at the target date.",
    )
    # The period it's set for (optional) - SET_NULL: deleting a cycle
    # leaves its goals. Same org as the goal (GoalViewSet._resolve_cycle).
    cycle = models.ForeignKey(
        Cycle, on_delete=models.SET_NULL, null=True, blank=True, db_column="cycle_id", related_name="goals"
    )
    # Self-referential, optional - a sub-goal under a bigger one. SET_NULL
    # (not CASCADE): deleting a parent goal shouldn't silently destroy its
    # whole sub-tree, just detach the children back to top-level. No cycle
    # check (A -> B -> A) yet - see GoalViewSet._resolve_parent's own note.
    parent = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, db_column="parent_id", related_name="sub_goals"
    )

    # Order among its siblings - goals under the same parent (top-level goals: in the same org, or the owner's personal ones); lowest first. Set by
    # `POST <resource>/reorder` (drag and drop); a new one goes last.
    # `db_default` so the previous release's code can still insert rows
    # while a deploy migrates first.
    position = models.PositiveIntegerField(default=0, db_default=0)

    # Teams and templates (docs/team-templates.md). `team_id` is a bare id
    # (platform-org's Team), in the goal's org. A template instance has
    # `template_goal` set: its shape (title, structure) follows the
    # template, its numbers are the team's. A rollup goal (`is_rollup`) is
    # the total of every instance under `team_id` (null: the whole org) -
    # written by `goalnexa.rollups`, read-only to everyone.
    team_id = models.UUIDField(null=True, blank=True)
    template_goal = models.ForeignKey(
        "goalnexa.TemplateGoal", on_delete=models.SET_NULL, null=True, blank=True, db_column="template_goal_id",
        related_name="instances",
    )
    is_rollup = models.BooleanField(default=False, db_default=False)
    # A team member's share of their team's instance (docs/team-templates.md
    # "Members"): a bare user id, set on every goal of that member's copy -
    # owned by the member, its targets set by the team's lead. Null on the
    # team's own copy, on totals and on every other goal.
    assignee_id = models.UUIDField(null=True, blank=True)

    class Meta:
        db_table = "goal"
