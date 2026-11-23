from django import forms
from django.contrib import messages
from django.contrib.gis import admin

from .models import Favorite, Review, Trail, TrailTranslation, UserRoute
from .services.gpx import GPXError
from .services.trail_gpx import apply_gpx


class TrailTranslationInline(admin.StackedInline):
    model = TrailTranslation
    extra = 0
    max_num = 3


class TrailAdminForm(forms.ModelForm):
    gpx_file = forms.FileField(
        required=False,
        help_text="GPX трек жүктөсөңүз, маршрут, аралык жана бийиктик автоматтык түрдө эсептелет.",
    )

    class Meta:
        model = Trail
        fields = "__all__"


@admin.register(Trail)
class TrailAdmin(admin.GISModelAdmin):
    form = TrailAdminForm
    list_display = ("slug", "region", "difficulty", "distance_km", "max_elevation_m", "has_route", "is_published")
    list_filter = ("region", "difficulty", "is_published")
    search_fields = ("slug", "translations__title")
    readonly_fields = ("elevation_profile",)
    inlines = [TrailTranslationInline]
    gis_widget_kwargs = {"attrs": {"default_lat": 42.0, "default_lon": 75.0, "default_zoom": 6}}

    @admin.display(boolean=True, description="GPX")
    def has_route(self, obj):
        return obj.route is not None

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        gpx = form.cleaned_data.get("gpx_file")
        if gpx:
            try:
                apply_gpx(obj, gpx.read())
                messages.success(request, f"GPX иштетилди: {obj.distance_km} км, +{obj.elevation_gain_m} м")
            except GPXError as e:
                messages.error(request, str(e))


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("trail", "user", "rating", "conditions", "created_at")
    list_filter = ("rating", "conditions")
    search_fields = ("trail__slug", "user__email", "text")


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("trail", "user", "created_at")


@admin.register(UserRoute)
class UserRouteAdmin(admin.GISModelAdmin):
    list_display = ("title", "user", "distance_km", "ascent_m", "created_at")
    search_fields = ("title", "user__email")
