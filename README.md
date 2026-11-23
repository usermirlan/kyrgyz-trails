# ⛰️ Too Arna — Кыргызстандын тоо маршруттары

Кыргызстандагы жөө жүрүш маршруттарынын платформасы: интерактивдүү карта, GPX треги жана бийиктик профили, аба ырайы, сын-пикирлер, офлайн режим жана биздин маалымат базасынан гана план түзгөн **AI саякат пландоочу**.

**Стек:** Django 5 · GeoDjango · Django Ninja · PostgreSQL + PostGIS · Next.js 16 (App Router, Server Actions) · MapLibre GL · Tailwind 4 · PWA · Docker · GitHub Actions

## Мүмкүнчүлүктөр

| | |
|---|---|
| 🗺️ **Каталог жана карта** | Облус, татаалдык, ай, узактык боюнча фильтрлер, рейтинг боюнча иреттөө, «мага жакын» (PostGIS `dwithin` + `Distance`) |
| 📈 **GPX** | Админкада же API аркылуу GPX жүктөлөт: маршрут, аралык, бийиктикке көтөрүлүү (hysteresis менен ызы-чуу чыпкаланат) жана бийиктик профили автоматтык түрдө эсептелет |
| 🌦️ **Аба ырайы** | Маршрут башталган жер үчүн Open-Meteo'дон 7 күндүк болжол (кэш менен) |
| ⭐ **Коомчулук** | Катталуу/кирүү (bearer token, httpOnly cookie), сын-пикирлер (бир колдонуучуга бир сын-пикир), тандалгандар |
| 🌐 **3 тил** | Кыргызча, орусча, англисче: интерфейс да, маршруттардын мазмуну да |
| ✨ **AI пландоочу** | LLM агенти tool calling аркылуу (`search_trails`, `get_trail_details`, `get_weather_forecast`) **чыныгы базадан** гана маршрут сунуштайт, ойдон чыгарбайт. Каалаган OpenAI-шайкеш API менен иштейт (Groq, Gemini, Ollama…). Демейки жөндөө: Groq + `openai/gpt-oss-120b` |
| 📴 **Офлайн (PWA)** | Service worker: «Офлайн сактоо» баскычы маршруттун барагын жана анын айланасындагы карта плиткаларын (z8–14) кэштейт, анткени тоодо байланыш жок |

## Иштетүү

```bash
cp .env.example .env      # AI пландоочу үчүн LLM_API_KEY толтуруңуз (Groq же Gemini, акысыз план бар)
docker compose up --build
```

**Windows'то** терминалсыз эле иштетсе болот:

| Файл | Эмне кылат |
|---|---|
| `start.bat` | `.env` түзөт, Docker Desktop'ту ачат жана `docker compose up --build` иштетет |
| `restart.bat` | `.env` өзгөргөндөн кийин контейнерлерди жаңы жөндөөлөр менен кайра ишке киргизет |
| `rebuild-frontend.bat` | Frontend кодун өзгөрткөндөн кийин аны кайра build кылат |

- Сайт: http://localhost:3000
- API (Swagger): http://localhost:8000/api/docs
- Админка: http://localhost:8000/admin. Адегенде админ түзүңүз:
  `docker compose exec backend python manage.py createsuperuser`

Backend ар бир жолу ачылганда миграцияларды иштетип, 10 маршрутту базага жүктөйт. Бар маршруттар өзгөртүлбөйт; кайра жазуу керек болсо, `seed_trails --force` колдонуңуз.

### GPX кошуу

1. Админкада маршрутту ачып, **GPX file** талаасына файлды жүктөңүз, же
2. `docker compose exec backend python manage.py import_gpx ala-archa-ratsek /app/track.gpx`

> PWA жана service worker production build'де гана иштейт (`docker compose`'тогу frontend production режиминде иштейт). `npm run dev` режиминде өчүк.

## Тесттер

```bash
docker compose exec backend pytest        # API, auth, сын-пикирлер, GPX, AI агент (LLM mock менен)
cd frontend && npx tsc --noEmit && npm run build
```

GitHub'га push кылганда `.github/workflows/ci.yml` экөөнү тең PostGIS менен иштетет.

## API

| Метод | Жол | |
|---|---|---|
| GET | `/api/trails` | `q, region, difficulty[], max_distance_km, max_days, month, lat, lng, radius_km, sort, lang` |
| GET | `/api/trails/{slug}` | Толук маалымат + маршрут + бийиктик профили |
| GET | `/api/trails/{slug}/weather` | 7 күндүк болжол |
| POST | `/api/trails/{slug}/gpx` | GPX жүктөө (staff гана) |
| GET/POST | `/api/trails/{slug}/reviews` | Сын-пикирлер (POST: кайра жөнөтүлсө, жаңыртылат) |
| DELETE | `/api/reviews/{id}` | Өз сын-пикирин өчүрүү |
| POST | `/api/trails/{slug}/favorite` | Тандалгандарга кошуу/алуу |
| GET | `/api/me/favorites` | Тандалгандар |
| POST | `/api/planner` | AI план `{prompt, lang}` (IP боюнча саатына 15 суроо) |
| POST | `/api/auth/register` · `/login` · `/logout`, GET `/me` | Bearer token |

## Түзүлүшү

```
backend/
  config/                 settings, root NinjaAPI
  accounts/               AuthToken, register/login/me/logout
  trails/
    models.py             Trail (PostGIS), TrailTranslation, Review, Favorite
    routers/              trails, community, planner
    services/
      gpx.py              таза Python: GPX → координаттар, аралык, көтөрүлүү, профиль
      planner.py          AI агенттин цикли (провайдерге көз каранды эмес, тестке ыңгайлуу)
      weather.py          Open-Meteo + кэш
    tests/                pytest (API, GPX, агент)
frontend/
  app/                    беттер + actions.ts (Server Actions: auth, сын-пикир, тандалган, план)
  components/             TrailMap, ElevationProfile, Weather, Reviews, PlannerForm, SaveOfflineButton…
  lib/                    api.ts, i18n.ts (ky/ru/en), session.ts
  public/sw.js            service worker
```

## Архитектура боюнча чечимдер

- **Бардык API чакыруулары сервер тарабында жасалат** (Server Components/Actions). Токен httpOnly cookie'де сакталат, браузердеги JS аны көрбөйт.
- **AI маршрутту ойдон чыгарбайт:** агент маалыматты куралдар аркылуу гана алат, ал эми жоопто шилтеме берилген маршруттар гана `trail_slugs` катары кайтарылат.
- **Рейтинг subquery менен эсептелет** (JOIN менен эмес), ошондуктан текст боюнча издөө орточо бааны бузбайт.
- **GPX логикасы Django'дон бөлүнгөн**, ошондуктан аны база жок эле тестирлесе болот.

## Production

`.env`'ге `DJANGO_DEBUG=0`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` коюңуз. Ошондо backend gunicorn жана whitenoise менен иштейт. Ылайыктуу акысыз же арзан варианттар: frontend үчүн **Vercel**, backend үчүн **Railway/Fly.io** (Dockerfile даяр), база үчүн **Neon** же Railway Postgres (PostGIS кеңейтүүсү менен).

## ⚠️ Маалыматтар тууралуу

Seed'деги координаттар, аралыктар жана бийиктиктер **болжолдуу**. Коомчулукка чыгараардан мурда ар бир маршрутту чыныгы GPX трек менен текшериңиз.

## Сүрөттөр

Бардык сүрөттөр [Unsplash](https://unsplash.com) лицензиясы менен колдонулат:

- `hero.jpg` — Amir Asake, «Mountains of North Kyrgyzstan»
- `lake.jpg` — Ilya Yudin
- `valley.jpg` — Denis Volkov
- `hills.jpg` — Bakhtiyar Ibragimov

---
Карта: [OpenFreeMap](https://openfreemap.org) · © OpenStreetMap contributors · Аба ырайы: [Open-Meteo](https://open-meteo.com)
