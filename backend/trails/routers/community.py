from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from accounts.auth import current_user, optional_auth, token_auth

from ..models import Favorite, Locale, Review, Trail
from ..schemas import FavoriteToggleOut, ReviewIn, ReviewOut, TrailListItem
from .trails import base_queryset, serialize

router = Router(tags=["community"])


def review_out(r: Review, user) -> dict:
    return {
        "id": r.id,
        "rating": r.rating,
        "text": r.text,
        "hiked_on": r.hiked_on,
        "conditions": r.conditions,
        "conditions_label": r.get_conditions_display() if r.conditions else "",
        "author": r.user.first_name or r.user.email.split("@")[0],
        "is_mine": user is not None and r.user_id == user.id,
        "created_at": r.created_at,
    }


@router.get("/trails/{slug}/reviews", response=list[ReviewOut], auth=optional_auth)
def list_reviews(request, slug: str):
    trail = get_object_or_404(Trail, slug=slug, is_published=True)
    user = current_user(request)
    return [review_out(r, user) for r in trail.reviews.select_related("user")[:100]]


@router.post("/trails/{slug}/reviews", response={201: ReviewOut}, auth=token_auth)
def upsert_review(request, slug: str, data: ReviewIn):
    """One review per user per trail — posting again updates it."""
    trail = get_object_or_404(Trail, slug=slug, is_published=True)
    review, _ = Review.objects.update_or_create(
        trail=trail, user=request.auth, defaults=data.model_dump()
    )
    return 201, review_out(review, request.auth)


@router.delete("/reviews/{review_id}", response={204: None}, auth=token_auth)
def delete_review(request, review_id: int):
    review = get_object_or_404(Review, id=review_id)
    if review.user_id != request.auth.id and not request.auth.is_staff:
        raise HttpError(403, "Бул сиздин сын-пикириңиз эмес")
    review.delete()
    return 204, None


@router.post("/trails/{slug}/favorite", response=FavoriteToggleOut, auth=token_auth)
def toggle_favorite(request, slug: str):
    trail = get_object_or_404(Trail, slug=slug, is_published=True)
    fav, created = Favorite.objects.get_or_create(trail=trail, user=request.auth)
    if not created:
        fav.delete()
    return {"favorited": created}


@router.get("/me/favorites", response=list[TrailListItem], auth=token_auth)
def my_favorites(request, lang: Locale = Locale.RU):
    order = list(
        Favorite.objects.filter(user=request.auth).values_list("trail_id", flat=True)
    )  # newest first (Meta.ordering)
    trails = {t.id: t for t in base_queryset().filter(id__in=order)}
    return [serialize(trails[i], lang) for i in order if i in trails]


@router.get("/me/favorite-slugs", response=list[str], auth=token_auth)
def my_favorite_slugs(request):
    return list(Favorite.objects.filter(user=request.auth).values_list("trail__slug", flat=True))
