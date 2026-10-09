from django.apps import AppConfig


class HostConfig(AppConfig):
    """The host itself (`config`), as an app only for what has to join
    several modules - System > Insights' cross-module sections
    (`config/insights.py`). No models."""

    name = "config"
    label = "host"

    def ready(self):
        from config import insights

        insights.register()
