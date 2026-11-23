import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("trails", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="trail",
            name="elevation_profile",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.CreateModel(
            name="Review",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("rating", models.PositiveSmallIntegerField(validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)])),
                ("text", models.TextField(blank=True, max_length=2000)),
                ("hiked_on", models.DateField(blank=True, null=True)),
                ("conditions", models.CharField(blank=True, choices=[("dry", "Кургак"), ("mud", "Баткак"), ("snow", "Кар"), ("ice", "Муз")], max_length=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("trail", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reviews", to="trails.trail")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="trail_reviews", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
                "constraints": [
                    models.UniqueConstraint(fields=("trail", "user"), name="one_review_per_user"),
                    models.CheckConstraint(condition=models.Q(("rating__gte", 1), ("rating__lte", 5)), name="rating_1_5"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Favorite",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("trail", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="favorited_by", to="trails.trail")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="favorites", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
                "constraints": [models.UniqueConstraint(fields=("trail", "user"), name="unique_favorite")],
            },
        ),
    ]
