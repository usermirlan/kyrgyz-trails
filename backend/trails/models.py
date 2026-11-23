from django.contrib.gis.db import models
from django.contrib.postgres.fields import ArrayField
from django.core.validators import MaxValueValidator, MinValueValidator


class Region(models.TextChoices):
    CHUI = "chui", "Чүй"
    ISSYK_KUL = "issyk_kul", "Ысык-Көл"
    NARYN = "naryn", "Нарын"
    JALAL_ABAD = "jalal_abad", "Жалал-Абад"
    OSH = "osh", "Ош"
    TALAS = "talas", "Талас"
    BATKEN = "batken", "Баткен"


class Difficulty(models.TextChoices):
    EASY = "easy", "Жеңил"
    MODERATE = "moderate", "Орто"
    HARD = "hard", "Татаал"
    EXPERT = "expert", "Өтө татаал"


class Locale(models.TextChoices):
    KY = "ky", "Кыргызча"
    RU = "ru", "Русский"
    EN = "en", "English"


class Trail(models.Model):
    slug = models.SlugField(unique=True, max_length=120)
    region = models.CharField(max_length=20, choices=Region.choices, db_index=True)
    difficulty = models.CharField(max_length=10, choices=Difficulty.choices, db_index=True)

    distance_km = models.DecimalField(max_digits=6, decimal_places=1)
    elevation_gain_m = models.PositiveIntegerField()
    max_elevation_m = models.PositiveIntegerField()
    duration_days = models.PositiveSmallIntegerField(
        default=1, help_text="1 = бир күндүк маршрут"
    )
    best_months = ArrayField(
        models.PositiveSmallIntegerField(
            validators=[MinValueValidator(1), MaxValueValidator(12)]
        ),
        default=list,
        blank=True,
        help_text="Барууга ылайыктуу айлар, 1–12",
    )

    # geography=True → distances are computed in metres on the sphere
    start_point = models.PointField(geography=True, srid=4326)
    route = models.LineStringField(geography=True, srid=4326, null=True, blank=True)
    # [[km_from_start, elevation_m], ...] — downsampled from the GPX track
    elevation_profile = models.JSONField(default=list, blank=True)

    cover_image = models.URLField(blank=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["region", "distance_km"]

    def __str__(self) -> str:
        return self.slug

    def translation(self, locale: str) -> "TrailTranslation | None":
        """Requested locale, falling back to Russian, then anything available."""
        by_locale = {t.locale: t for t in self.translations.all()}
        return by_locale.get(locale) or by_locale.get(Locale.RU) or next(
            iter(by_locale.values()), None
        )


class TrailTranslation(models.Model):
    trail = models.ForeignKey(Trail, on_delete=models.CASCADE, related_name="translations")
    locale = models.CharField(max_length=2, choices=Locale.choices)
    title = models.CharField(max_length=200)
    summary = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    how_to_get_there = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["trail", "locale"], name="unique_trail_locale")
        ]

    def __str__(self) -> str:
        return f"{self.trail.slug} [{self.locale}]"


class Conditions(models.TextChoices):
    DRY = "dry", "Кургак"
    MUD = "mud", "Баткак"
    SNOW = "snow", "Кар"
    ICE = "ice", "Муз"


class Review(models.Model):
    trail = models.ForeignKey(Trail, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(
        "auth.User", on_delete=models.CASCADE, related_name="trail_reviews"
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    text = models.TextField(max_length=2000, blank=True)
    hiked_on = models.DateField(null=True, blank=True)
    conditions = models.CharField(max_length=10, choices=Conditions.choices, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["trail", "user"], name="one_review_per_user"),
            models.CheckConstraint(
                condition=models.Q(rating__gte=1, rating__lte=5), name="rating_1_5"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.trail.slug} · {self.rating}★"


class Favorite(models.Model):
    trail = models.ForeignKey(Trail, on_delete=models.CASCADE, related_name="favorited_by")
    user = models.ForeignKey("auth.User", on_delete=models.CASCADE, related_name="favorites")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["trail", "user"], name="unique_favorite")
        ]


class UserRoute(models.Model):
    """A route the user drew on the map in the route builder."""

    user = models.ForeignKey("auth.User", on_delete=models.CASCADE, related_name="routes")
    title = models.CharField(max_length=120)
    # [[lng, lat], ...] as clicked — kept so the route can be edited again
    waypoints = models.JSONField()
    follow_trails = models.BooleanField(default=False)
    path = models.LineStringField(geography=True, srid=4326)
    distance_km = models.DecimalField(max_digits=6, decimal_places=2)
    ascent_m = models.PositiveIntegerField()
    descent_m = models.PositiveIntegerField()
    max_elevation_m = models.IntegerField()
    duration_h = models.FloatField()
    elevation_profile = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.title} ({self.user_id})"
