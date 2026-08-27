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
