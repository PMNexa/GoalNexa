from django.apps import AppConfig


class GoalnexaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'goalnexa'

    def ready(self):
        from django.conf import settings

        from core_api.system import (
            INT,
            LIST,
            SettingDef,
            UsageProvider,
            org_removed,
            register_export_provider,
            register_setting,
            register_usage_provider,
            user_removed,
        )
        from goalnexa.accounts import export, on_org_removed, on_user_removed, usage

        register_setting(SettingDef(
            "reminders.allowed_schemes", "Reminder services allowed", LIST,
            default=list(getattr(settings, "GOALNEXA_REMINDER_SCHEMES", None) or []), group="Reminders",
            help="Apprise URL schemes users may send reminders to (e.g. tgram, slack). Empty: any - only safe when "
                 "you trust every user, since json://, form:// and the like make the server call any address.",
        ))
        user_removed.connect(on_user_removed, dispatch_uid="goalnexa.user_removed")
        org_removed.connect(on_org_removed, dispatch_uid="goalnexa.org_removed")
        register_usage_provider(UsageProvider("Goals", usage))
        register_export_provider("goals", export)
        from goalnexa.insights import register_insights

        register_insights()
        from goalnexa.lifecycle import register as register_lifecycle

        register_lifecycle()
        register_setting(SettingDef(
            "limits.max_goals", "Goals per organization", INT, default=0, group="Limits", env="LIMIT_MAX_GOALS",
            help="Goals that aren't archived. 0: unlimited. An organization's own limit (All organizations) wins.",
        ))
