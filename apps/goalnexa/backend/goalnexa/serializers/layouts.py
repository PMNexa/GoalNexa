"""How the generic forms lay out goalnexa's resources (`Meta.form_layout`,
sent in each resource's schema - platform-core's `FormLayout`): sections in
the order people fill them in, the rarely touched ones folded into
"Advanced", and period fields shown only where they apply."""

#: Shown only with a target per day or week.
COUNT_DAYS = {"name": "count_days", "show_if": {"field": "target_per", "in": ["day", "week"]}}
#: Shown only with a target per period.
PROGRESS_BY = {"name": "progress_by", "show_if": {"field": "target_per", "not_in": [""]}}

def snap_moment(off: list[str], resnap: bool = True) -> list:
    """The frequency (`snap_to`) and its moment fields (`SnapMoment`), drawn as
    one picker (goalnexa-frontend's `CheckInMomentField`, widget
    "check-in-moment"); without it, each field shows only for the
    frequencies it applies to. `off` = the `snap_to` values with no moment.
    `resnap`: the "move existing check-ins" choice (goals and metrics; a
    template always moves its teams' check-ins)."""
    return [
        {
            "name": "snap_to",
            "widget": "check-in-moment",
            "with": [
                {"name": "snap_weekday", "show_if": {"field": "snap_to", "in": ["week"]}},
                {"name": "snap_quarter_month", "show_if": {"field": "snap_to", "in": ["quarter"]}},
                {"name": "snap_month", "show_if": {"field": "snap_to", "in": ["year"]}},
                {"name": "snap_day", "show_if": {"field": "snap_to", "in": ["month", "quarter", "year"]}},
                {"name": "snap_time", "show_if": {"field": "snap_to", "not_in": off}},
                *([{"name": "resnap"}] if resnap else []),
            ],
        },
    ]


# Which check-ins in a period count follows "Each check-in is": the last
# new value wins (ties go to the latest made), every amount adds up - so
# `one_per` isn't asked. When check-ins are due is the frequency (P-93), so
# `check_in_every` isn't either. Each shows only on a row that already has
# one, so it can still be cleared.
CHECK_INS = {
    "title": "Check-ins",
    "fields": [
        "aggregation",
        {"name": "one_per", "show_if": {"field": "one_per", "not_in": [""]}},
        {"name": "check_in_every", "show_if": {"field": "check_in_every", "not_in": [""]}},
    ],
}

GOAL_LAYOUT = [
    {"title": "Goal", "fields": ["title", *snap_moment(["", "parent"]), "description", "target_date", "status"]},
    {
        "title": "Who sees it",
        "fields": [
            "org_id",
            {"name": "team_id", "show_if": {"field": "org_id", "not_in": [""]}},
            "visibility",
            "cycle",
        ],
    },
    {"title": "Advanced", "collapsed": True, "fields": ["parent"]},
]

METRIC_LAYOUT = [
    {"title": "Metric", "fields": ["name", *snap_moment(["", "goal"]), "unit", "description"]},
    CHECK_INS,
    {
        "title": "Target",
        "description": "Progress runs from the start to the target. With a target per period, the target is the amount for each period.",
        "fields": ["base_value", "target_value", "target_per", COUNT_DAYS, PROGRESS_BY],
    },
    {"title": "Advanced", "collapsed": True, "fields": ["current_value", "goal", "parent"]},
]

TEMPLATE_GOAL_LAYOUT = [
    {"title": "Goal", "fields": ["title", *snap_moment(["", "parent"], resnap=False), "description"]},
    {"title": "Advanced", "collapsed": True, "fields": ["template", "parent", "position"]},
]

TEMPLATE_METRIC_LAYOUT = [
    {"title": "Metric", "fields": ["name", *snap_moment(["", "goal"], resnap=False), "unit", "description"]},
    CHECK_INS,
    {
        "title": "Target",
        "description": "What each new team copy starts with. With a target per period, the target is the amount for each period.",
        "fields": ["default_base", "default_target", "target_per", COUNT_DAYS, PROGRESS_BY],
    },
    {"title": "Team totals", "fields": ["rollup"]},
    {"title": "Advanced", "collapsed": True, "fields": ["template_goal", "parent", "position"]},
]
