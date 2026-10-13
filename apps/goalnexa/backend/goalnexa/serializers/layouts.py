"""How the generic forms lay out goalnexa's resources (`Meta.form_layout`,
sent in each resource's schema - platform-core's `FormLayout`): sections in
the order people fill them in, the rarely touched ones folded into
"Advanced", and period fields shown only where they apply."""

#: Shown only with a target per day or week.
COUNT_DAYS = {"name": "count_days", "show_if": {"field": "target_per", "in": ["day", "week"]}}
#: Shown only with a target per period.
PROGRESS_BY = {"name": "progress_by", "show_if": {"field": "target_per", "not_in": [""]}}

CHECK_INS = {
    "title": "Check-ins",
    "fields": ["aggregation", "snap_to", "one_per", "check_in_every"],
}

GOAL_LAYOUT = [
    {"title": "Goal", "fields": ["title", "description", "target_date", "status"]},
    {
        "title": "Who sees it",
        "fields": [
            "org_id",
            {"name": "team_id", "show_if": {"field": "org_id", "not_in": [""]}},
            "visibility",
            "cycle",
        ],
    },
    {"title": "Check-ins", "fields": ["snap_to"]},
    {"title": "Advanced", "collapsed": True, "fields": ["parent"]},
]

METRIC_LAYOUT = [
    {"title": "Metric", "fields": ["name", "unit", "description"]},
    CHECK_INS,
    {
        "title": "Target",
        "description": "Progress runs from the start to the target. With a target per period, the target is the amount for each period.",
        "fields": ["base_value", "target_value", "target_per", COUNT_DAYS, PROGRESS_BY],
    },
    {"title": "Advanced", "collapsed": True, "fields": ["current_value", "goal", "parent"]},
]

TEMPLATE_GOAL_LAYOUT = [
    {"title": "Goal", "fields": ["title", "description"]},
    {"title": "Advanced", "collapsed": True, "fields": ["template", "parent", "position"]},
]

TEMPLATE_METRIC_LAYOUT = [
    {"title": "Metric", "fields": ["name", "unit", "description"]},
    CHECK_INS,
    {
        "title": "Target",
        "description": "What each new team copy starts with. With a target per period, the target is the amount for each period.",
        "fields": ["default_base", "default_target", "target_per", COUNT_DAYS, PROGRESS_BY],
    },
    {"title": "Team totals", "fields": ["rollup"]},
    {"title": "Advanced", "collapsed": True, "fields": ["template_goal", "parent", "position"]},
]
