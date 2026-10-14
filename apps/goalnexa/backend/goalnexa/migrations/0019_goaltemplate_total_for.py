from django.db import migrations, models

import goalnexa.models.template


def keep_current_totals(apps, schema_editor):
    """Totals were automatic for every team with sub-teams: tick the ones
    that exist, so nothing disappears."""
    GoalTemplate = apps.get_model("goalnexa", "GoalTemplate")
    Goal = apps.get_model("goalnexa", "Goal")
    for template in GoalTemplate.objects.all():
        teams = (
            Goal.objects.filter(template_goal__template_id=template.id, is_rollup=True, team_id__isnull=False)
            .values_list("team_id", flat=True)
            .distinct()
        )
        template.total_for = ["org", *sorted(str(t) for t in teams)]
        template.save(update_fields=["total_for"])


class Migration(migrations.Migration):
    dependencies = [("goalnexa", "0018_goal_check_ins_for_a_period")]

    operations = [
        migrations.AddField(
            model_name="goaltemplate",
            name="total_for",
            field=models.JSONField(
                blank=True, default=goalnexa.models.template.default_total_for, null=True, verbose_name="totals for"
            ),
        ),
        migrations.RunPython(keep_current_totals, migrations.RunPython.noop),
    ]
