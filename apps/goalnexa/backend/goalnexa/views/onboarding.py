"""`POST /api/v1/onboarding-choice` - `{"choice": "web" | "agent"}`: how the
caller said they'll use GoalNexa on the onboarding wizard (for the admin's
activation funnel). Only the first answer is kept; `GET` returns it."""

from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from goalnexa.models import OnboardingChoice


class OnboardingChoiceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        row = OnboardingChoice.objects.filter(user_id=request.user.id).first()
        return Response({"choice": row.choice if row else None})

    def post(self, request):
        choice = request.data.get("choice")
        if choice not in OnboardingChoice.Choice.values:
            raise ValidationError({"choice": [f"One of: {', '.join(OnboardingChoice.Choice.values)}."]})
        row, _ = OnboardingChoice.objects.get_or_create(user_id=request.user.id, defaults={"choice": choice})
        return Response({"choice": row.choice})
