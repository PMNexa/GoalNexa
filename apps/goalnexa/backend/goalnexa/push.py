"""Push notifications to the GoalNexa phone apps, through the push relay
(docs/mobile-app.md "Push protocol").

The server signs every request to the relay with an Ed25519 key derived
from `DJANGO_SECRET_KEY` - the same on every replica, no table. The app
registered its phone with the relay itself and gave us a handle bound to
that key (`PushDevice`), so we never see an FCM token and nobody else can
push to our users. A push carries only a kind and a `PushMessage` id; the
app fetches the text from us with its own session.

`push.relay_url` (system setting, env `PUSH_RELAY_URL`) is where the relay
is; empty (or `off`, the way to say it in the environment) turns push
off on this instance.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time
from functools import lru_cache

from django.conf import settings

from core_api.system import get_setting, log_delivery

logger = logging.getLogger(__name__)

DEFAULT_RELAY_URL = "https://goal.pmnexa.com/api/v1/push-relay"
#: The relay takes at most this many messages per request.
BATCH = 100
TIMEOUT = 10


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


@lru_cache(maxsize=4)
def _private_key(secret: str):
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    seed = hmac.new(secret.encode(), b"goalnexa-push-relay-key", hashlib.sha256).digest()
    return Ed25519PrivateKey.from_private_bytes(seed)


def private_key():
    return _private_key(settings.SECRET_KEY)


def server_key() -> str:
    """This server's public key, as the relay and the app see it."""
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

    return b64(private_key().public_key().public_bytes(Encoding.Raw, PublicFormat.Raw))


def relay_url() -> str:
    url = (get_setting("push.relay_url") or "").strip().rstrip("/")
    return "" if url.lower() == "off" else url


def enabled() -> bool:
    return bool(relay_url())


def signed_headers(body: bytes, now: float | None = None) -> dict:
    timestamp = str(int(now if now is not None else time.time()))
    signature = private_key().sign(timestamp.encode() + b"." + body)
    return {
        "Content-Type": "application/json",
        "X-GoalNexa-Key": server_key(),
        "X-GoalNexa-Timestamp": timestamp,
        "X-GoalNexa-Signature": b64(signature),
    }


def _post(path: str, body: bytes, headers: dict):
    import requests

    return requests.post(f"{relay_url()}/{path}", data=body, headers=headers, timeout=TIMEOUT)


def push_text(body: str) -> str:
    """The message without its trailing web link - a tap opens the app."""
    lines = body.rstrip().splitlines()
    while lines and (lines[-1].startswith(("Check in: ", "Dashboard: ")) or not lines[-1].strip()):
        lines.pop()
    return "\n".join(lines)


def send(user_id, kind: str, title: str, body: str) -> bool | None:
    """Pushes one message to every phone of `user_id`. True when at least
    one took it, False when none did, None when there was nothing to push
    to (push off here, or no phones). Devices the relay calls gone are
    deleted."""
    from goalnexa.models import PushDevice, PushMessage

    if not enabled():
        return None
    devices = list(PushDevice.objects.filter(user_id=user_id))
    if not devices:
        return None
    message = PushMessage.objects.create(user_id=user_id, kind=kind, title=title[:255], body=push_text(body))
    by_handle = {d.handle: d for d in devices}
    sent, error = 0, ""
    gone = []
    for start in range(0, len(devices), BATCH):
        chunk = devices[start:start + BATCH]
        payload = json.dumps(
            {"messages": [{"handle": d.handle, "kind": kind, "id": str(message.id)} for d in chunk]}
        ).encode()
        try:
            response = _post("send", payload, signed_headers(payload))
            response.raise_for_status()
            results = response.json().get("results") or []
        except Exception as exc:
            logger.warning("Push relay request for user %s failed: %s", user_id, exc)
            error = str(exc)[:500]
            continue
        for result in results:
            status = result.get("status")
            if status == "sent":
                sent += 1
            elif status == "gone" and result.get("handle") in by_handle:
                gone.append(by_handle[result["handle"]].id)
            elif not error:
                error = f"Relay answered {status} for a device."
    if gone:
        PushDevice.objects.filter(id__in=gone).delete()
    log_delivery("push", kind, user_id=user_id, target=f"{len(devices)} device{'s' if len(devices) != 1 else ''}",
                 ok=bool(sent), error="" if sent else (error or "No device took it."))
    return bool(sent)


def revoke(handles: list[str]) -> None:
    """Tells the relay these handles are done with. Best effort: a handle
    the relay keeps is harmless once we've forgotten it."""
    if not enabled():
        return
    for handle in handles:
        try:
            _post("revoke", json.dumps({"handle": handle}).encode(), {"Content-Type": "application/json"})
        except Exception as exc:
            logger.info("Push relay revoke failed: %s", exc)


def forget_devices(user_id) -> int:
    """Deletes every phone of `user_id` here and at the relay ("sign out
    everywhere", account deletion)."""
    from goalnexa.models import PushDevice

    devices = PushDevice.objects.filter(user_id=user_id)
    handles = list(devices.values_list("handle", flat=True))
    count = devices.delete()[0]
    revoke(handles)
    return count


def list_devices(user_id) -> list[dict]:
    """The phones as a session list ("Sessions" on the user's page)."""
    from goalnexa.models import PushDevice

    return [
        {
            "id": str(d.id),
            "label": d.device_name or d.get_platform_display(),
            "created_at": d.created_at.isoformat(),
            "last_used_at": d.last_seen_at.isoformat() if d.last_seen_at else None,
            "expires_at": None,
        }
        for d in PushDevice.objects.filter(user_id=user_id)
    ]
