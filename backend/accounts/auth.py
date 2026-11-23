from ninja.security import HttpBearer

from .models import AuthToken


class TokenAuth(HttpBearer):
    def authenticate(self, request, token: str):
        try:
            t = AuthToken.objects.select_related("user").get(key=token, user__is_active=True)
        except AuthToken.DoesNotExist:
            return None
        request.auth_token = t
        return t.user


class OptionalTokenAuth(TokenAuth):
    """Lets anonymous requests through; `request.auth` is the user or None."""

    def __call__(self, request):
        user = super().__call__(request)
        return user if user is not None else AnonymousMarker()


class AnonymousMarker:
    """Truthy placeholder so Ninja treats the request as authenticated-anonymous."""

    is_authenticated = False

    def __bool__(self) -> bool:  # Ninja checks truthiness
        return True


token_auth = TokenAuth()
optional_auth = OptionalTokenAuth()


def current_user(request):
    user = getattr(request, "auth", None)
    return user if getattr(user, "is_authenticated", False) else None
