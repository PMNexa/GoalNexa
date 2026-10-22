from django.apps import AppConfig


class GoalnexaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'goalnexa'

    def ready(self):
        from django.conf import settings

        from core_api.system import (
            INT,
            LIST,
            STRING,
            RetentionRule,
            SessionProvider,
            SettingDef,
            UsageProvider,
            org_removed,
            register_export_provider,
            register_retention_rule,
            register_session_provider,
            team_changed,
            team_removed,
            register_setting,
            register_usage_provider,
            user_removed,
        )
        from goalnexa.accounts import export, on_org_removed, on_team_changed, on_team_removed, on_user_removed, usage

        register_setting(SettingDef(
            "reminders.allowed_schemes", "Reminder services allowed", LIST,
            default=list(getattr(settings, "GOALNEXA_REMINDER_SCHEMES", None) or []), group="Reminders",
            help="Apprise URL schemes users may send reminders to (e.g. tgram, slack). Empty: any - only safe when "
                 "you trust every user, since json://, form:// and the like make the server call any address.",
        ))
        from goalnexa import push

        register_setting(SettingDef(
            "push.relay_url", "Push relay", STRING, default=push.DEFAULT_RELAY_URL, group="Reminders",
            env="PUSH_RELAY_URL",
            help="Where reminders to the GoalNexa phone apps go out (docs/mobile-app.md). It only ever sees a "
                 "notification's kind and id, never what it says. Empty or off: no push on this instance.",
        ))
        # A phone is signed in for push: "sign out everywhere" stops it too.
        register_session_provider(SessionProvider("push", "Phone notifications", push.list_devices, push.forget_devices))
        from goalnexa.models import PushDevice, PushMessage

        register_retention_rule(RetentionRule(
            "push_messages", "phone notification texts",
            lambda cutoff: PushMessage.objects.filter(created_at__lt=cutoff).delete()[0],
            help="What each push said; the app fetches it when the push arrives.", default_days=30,
        ))
        register_retention_rule(RetentionRule(
            "push_devices", "phones not seen",
            lambda cutoff: PushDevice.objects.filter(last_seen_at__lt=cutoff).delete()[0],
            help="A phone registers again every time the app starts; one silent this long is forgotten.",
            default_days=180,
        ))
        user_removed.connect(on_user_removed, dispatch_uid="goalnexa.user_removed")
        org_removed.connect(on_org_removed, dispatch_uid="goalnexa.org_removed")
        team_removed.connect(on_team_removed, dispatch_uid="goalnexa.team_removed")
        team_changed.connect(on_team_changed, dispatch_uid="goalnexa.team_changed")
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
