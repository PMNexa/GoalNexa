"""User lookups other modules need from platform-auth - platform-org's
(`PLATFORM_ORG_USER_DIRECTORY`, `PLATFORM_ORG_ACCOUNT_EXISTS`), goalnexa's
(`GOALNEXA_USER_DIRECTORY`, for emailing reminders) - and platform-auth's
own from platform-org (`PLATFORM_AUTH_IS_INVITED`). Main is the one place
that knows the modules, so the glue lives here."""

from platform_auth.models import User


def lookup_users(user_ids) -> dict[str, dict]:
    """Accounts, plus platform-org's placeholders (people in a team with no
    account yet) by name only - no email, so nothing is ever mailed to one."""
    from platform_org.placeholders import lookup

    ids = list(user_ids)
    found = {
        str(pid): {"name": row["name"], "email": None, "placeholder": True} for pid, row in lookup(ids).items()
    }
    found.update(
        (str(user_id), {"name": name, "email": email})
        for user_id, name, email in User.objects.filter(id__in=ids).values_list("id", "name", "email")
    )
    return found


def lifecycle_users(user_ids) -> dict[str, dict]:
    """platform-lifecycle's recipients (`PLATFORM_LIFECYCLE_USERS`): `ready`
    once the email is confirmed (or confirmation isn't asked for), the
    time zone the user's browser saved with their reminder settings."""
    from goalnexa.models import ReminderSettings
    from platform_auth.accounts import verification_required

    ids = [str(u) for u in user_ids]
    zones = {str(k): v for k, v in ReminderSettings.objects.filter(user_id__in=ids).values_list("user_id", "timezone")}
    must_confirm = verification_required()
    rows = User.objects.filter(id__in=ids).values_list("id", "name", "email", "is_active", "email_verified_at")
    return {
        str(user_id): {
            "name": name,
            "email": email,
            "active": is_active,
            "ready": verified is not None or not must_confirm,
            "timezone": zones.get(str(user_id)) or "UTC",
        }
        for user_id, name, email, is_active, verified in rows
    }


def account_exists(email: str) -> bool:
    return User.objects.filter(email=email.strip().lower()).exists()


def has_pending_invitation(email: str) -> bool:
    """platform-auth's invite-only signup (`PLATFORM_AUTH_IS_INVITED`): an
    email with an open platform-org invitation may sign up."""
    from django.utils import timezone

    from platform_org.models import OrgInvitation, OrgInvitationStatus

    return OrgInvitation.objects.filter(
        email=email.strip().lower(), status=OrgInvitationStatus.PENDING, expires_at__gt=timezone.now()
    ).exists()
