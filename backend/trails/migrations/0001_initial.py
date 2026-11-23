import django.contrib.gis.db.models.fields
import django.contrib.postgres.fields
import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Trail",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=120, unique=True)),
                ("region", models.CharField(choices=[("chui", "Чүй"), ("issyk_kul", "Ысык-Көл"), ("naryn", "Нарын"), ("jalal_abad", "Жалал-Абад"), ("osh", "Ош"), ("talas", "Талас"), ("batken", "Баткен")], db_index=True, max_length=20)),
                ("difficulty", models.CharField(choices=[("easy", "Жеңил"), ("moderate", "Орто"), ("hard", "Татаал"), ("expert", "Өтө татаал")], db_index=True, max_length=10)),
                ("distance_km", models.DecimalField(decimal_places=1, max_digits=6)),
                ("elevation_gain_m", models.PositiveIntegerField()),
                ("max_elevation_m", models.PositiveIntegerField()),
                ("duration_days", models.PositiveSmallIntegerField(default=1, help_text="1 = бир күндүк маршрут")),
                ("best_months", django.contrib.postgres.fields.ArrayField(base_field=models.PositiveSmallIntegerField(validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(12)]), blank=True, default=list, help_text="Барууга ылайыктуу айлар, 1–12", size=None)),
                ("start_point", django.contrib.gis.db.models.fields.PointField(geography=True, srid=4326)),
                ("route", django.contrib.gis.db.models.fields.LineStringField(blank=True, geography=True, null=True, srid=4326)),
                ("cover_image", models.URLField(blank=True)),
                ("is_published", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["region", "distance_km"]},
        ),
        migrations.CreateModel(
            name="TrailTranslation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("locale", models.CharField(choices=[("ky", "Кыргызча"), ("ru", "Русский"), ("en", "English")], max_length=2)),
                ("title", models.CharField(max_length=200)),
                ("summary", models.CharField(max_length=300)),
                ("description", models.TextField(blank=True)),
                ("how_to_get_there", models.TextField(blank=True)),
                ("trail", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="translations", to="trails.trail")),
            ],
            options={
                "constraints": [models.UniqueConstraint(fields=("trail", "locale"), name="unique_trail_locale")],
            },
        ),
    ]
