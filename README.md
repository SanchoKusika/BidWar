# BidWar

Telegram Mini App: платный и бесплатный топы проектов. Позиция в платном топе
покупается (Raise) и отбирается (Attack), в бесплатном — зарабатывается
голосами за задания.

Спецификация лежит вне репозитория, в Obsidian: механики, данные, платежи,
план разработки.

## Стек

React 19 + TypeScript + Vite, FSD-структура, CSS-модули на дизайн-токенах.
Бэкенд — Supabase: PostgreSQL, Edge Functions (Deno), Realtime.

## Команды

```bash
npm run dev            # локальный фронт
npm run build          # прод-сборка
npm run check          # типы + линт + правило изоляции платформы (то же, что в CI)
npm run format         # prettier
```

### База

```bash
npm run db:reset       # накатить миграции с нуля на локальный стек (нужен Docker)
npm run db:push        # применить миграции на связанный проект
npm run db:diff        # чем схема связанного проекта отличается от миграций
npm run db:types       # перегенерировать src/shared/api/database.types.ts
```

`db:types` запускать после каждой миграции — файл генерируемый, руками не
править, prettier его не форматирует.

Связать локальный репозиторий с проектом:

```bash
npx supabase login
npx supabase link --project-ref <ref>
```

## Структура

```text
src/
  app/            оболочка, тема, platform-специфичные входы (telegram/, web/)
  pages/          экраны, каждый со своими model/ и ui/
  widgets/        композиция под mobile/ и desktop/
  features/       пользовательские сценарии
  entities/       project, user, task, category
  shared/         ui/ (дизайн-система), api/, platform/, content/, lib/
supabase/
  migrations/     схема, индексы, RLS, сиды
  functions/      Edge Functions
```

## Деплой

Фронт живёт на Cloudflare Pages, выкладывает его GitHub Actions
(`.github/workflows/deploy.yml`): пуш в `main` — продакшн, любая другая ветка —
превью-окружение. Сборка идёт в CI, потому что `VITE_*` вшиваются в бандл на
этапе сборки, а не читаются в рантайме.

Что нужно завести один раз:

| Где                 | Что                      | Значение                                  |
| ------------------- | ------------------------ | ----------------------------------------- |
| Actions → Secrets   | `CLOUDFLARE_API_TOKEN`   | токен с правом `Cloudflare Pages: Edit`   |
| Actions → Secrets   | `CLOUDFLARE_ACCOUNT_ID`  | ID аккаунта Cloudflare                    |
| Actions → Variables | `VITE_SUPABASE_URL`      | URL проекта Supabase                      |
| Actions → Variables | `VITE_SUPABASE_ANON_KEY` | публикуемый ключ, он и так уходит в бандл |

Без секретов Cloudflare шаг деплоя пропускается, а не валит проверки на pull
request. Без переменных `VITE_*` сборка падает намеренно: молча выложенное
приложение без бэкенда хуже упавшего деплоя.

Вручную, с локальной машины:

```bash
npx wrangler login
npm run build
npx wrangler pages deploy dist --project-name bidwar
```

`public/_headers` задаёт CSP и кеширование. Там намеренно **нет**
`X-Frame-Options` и есть `frame-ancestors` с доменами Telegram: Mini App
открывается внутри айфрейма, и запрет фрейминга её сломает.

## Правила, которые проверяет CI

- **Прямых обращений к `window.Telegram` вне `shared/platform` и `app/telegram` нет.**
  Всё, что знает про Telegram, живёт за интерфейсом `platform/` — иначе веб-версия
  в Этапе 2 пишется заново.
- Нижние слои (`shared`, `entities`, `features`, `pages/*/model`) не импортируют
  из `app/` и `widgets/`.
- Типы, линт и сборка проходят.

## Переменные окружения

`.env.example` — список. Во фронт попадает только `VITE_*`; `SUPABASE_SERVICE_ROLE_KEY`,
`BOT_TOKEN` и ключи провайдеров живут в окружении Edge Functions и в бандл не
попадают никогда.
