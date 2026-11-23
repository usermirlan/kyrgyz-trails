from django.contrib import admin
from django.urls import path

from config.api import api

admin.site.site_header = "Too Arna — админка"
admin.site.site_title = "Too Arna"
admin.site.index_title = "Маршруттар, сын-пикирлер, колдонуучулар"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
]
