#!/bin/sh
set -e

# Wait until PostgreSQL really accepts connections. The postgis image restarts the
# server once after its first-time init, so a single readiness check is not enough.
echo "Waiting for database..."
until python - <<'PY' 2>/dev/null
import os, psycopg
if os.environ.get("DATABASE_URL"):  # hosted Postgres such as Neon
    psycopg.connect(os.environ["DATABASE_URL"], connect_timeout=5).close()
    raise SystemExit
psycopg.connect(
    host=os.environ.get("POSTGRES_HOST", "localhost"),
    port=os.environ.get("POSTGRES_PORT", "5432"),
    dbname=os.environ.get("POSTGRES_DB", "tooarna"),
    user=os.environ.get("POSTGRES_USER", "tooarna"),
    password=os.environ.get("POSTGRES_PASSWORD", "tooarna"),
    connect_timeout=3,
).close()
PY
do
    sleep 2
done
echo "Database is ready."

python manage.py migrate --noinput
python manage.py seed_trails

if [ "${DJANGO_DEBUG:-1}" = "1" ]; then
    exec python manage.py runserver 0.0.0.0:8000
else
    python manage.py collectstatic --noinput
    exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-3} --timeout 90
fi
