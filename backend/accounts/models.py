import secrets

from django.conf import settings
from django.db import models


def _new_key() -> str:
    return secrets.token_hex(20)


class AuthToken(models.Model):
    """Simple bearer token (one per login session)."""

    key = models.CharField(max_length=40, unique=True, default=_new_key)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="auth_tokens"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.user} · {self.key[:6]}…"
