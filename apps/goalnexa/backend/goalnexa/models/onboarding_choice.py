from django.db import models

from core_api.utils import TimestampedModel


class OnboardingChoice(TimestampedModel):
    """How a new user said they'll use GoalNexa, on the onboarding wizard's
    first step - the website or an AI assistant. Kept for the admin's
    activation funnel (System > Insights); the first answer stays."""

    class Choice(models.TextChoices):
        WEB = "web", "Website"
        AGENT = "agent", "AI assistant"

    user_id = models.UUIDField(unique=True)
    choice = models.CharField(max_length=16, choices=Choice.choices)

    class Meta:
        db_table = "onboarding_choice"
