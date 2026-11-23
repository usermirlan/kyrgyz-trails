from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from ninja import Router, Schema
from ninja.errors import HttpError
from pydantic import EmailStr, Field

from .auth import token_auth
from .models import AuthToken

User = get_user_model()
router = Router(tags=["auth"])


class RegisterIn(Schema):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=60)


class LoginIn(Schema):
    email: EmailStr
    password: str


class UserOut(Schema):
    id: int
    email: str
    name: str
    is_staff: bool


class TokenOut(Schema):
    token: str
    user: UserOut


def user_out(u) -> dict:
    return {"id": u.id, "email": u.email, "name": u.first_name or u.email.split("@")[0], "is_staff": u.is_staff}


@router.post("/register", response={201: TokenOut})
def register(request, data: RegisterIn):
    email = data.email.lower()
    try:
        validate_password(data.password)
    except ValidationError as e:
        raise HttpError(400, " ".join(e.messages))
    try:
        user = User.objects.create_user(
            username=email, email=email, password=data.password, first_name=data.name
        )
    except IntegrityError:
        raise HttpError(409, "Бул email менен колдонуучу бар")
    token = AuthToken.objects.create(user=user)
    return 201, {"token": token.key, "user": user_out(user)}


@router.post("/login", response=TokenOut)
def login(request, data: LoginIn):
    user = authenticate(request, username=data.email.lower(), password=data.password)
    if user is None:
        raise HttpError(401, "Email же сырсөз туура эмес")
    token = AuthToken.objects.create(user=user)
    return {"token": token.key, "user": user_out(user)}


@router.get("/me", response=UserOut, auth=token_auth)
def me(request):
    return user_out(request.auth)


@router.post("/logout", response={204: None}, auth=token_auth)
def logout(request):
    request.auth_token.delete()
    return 204, None
