# BidWar

Telegram Mini App: платный и бесплатный топы проектов. Позиция в платном топе
покупается (Raise) и отбирается (Attack), в бесплатном — зарабатывается
голосами за задания.

Спецификация лежит **вне репозитория**, в Obsidian (`Проекты/BidWar`): механики,
схема данных, платежи, план разработки. Перед задачей смотреть туда, а не
восстанавливать требования по коду. Что из спеки уже написано, а что ещё нет —
в документе `12 Состояние реализации`.

## Состояние

Приложение выложено: **app.bidwar.world**.

Работает: витрины Paid и Free с категориями и курсорной пагинацией, вход через
Telegram, добавление проекта в Free Top с OG-превью, счётчик кликов, правила и
документные страницы, платёжный слой на моке, платный вход и Raise.

Не работает — **Attack и Vote ещё не начаты**: платёжный слой и Raise закрыли
срез 1.5, следующий срез (1.6) заводит Attack.

> **Платежи идут через мок** (`PREVIEW.mockPayments`, `PAYMENT_PROVIDER=mock`):
> подтверждение мгновенное и без реального провайдера. Это единственный флаг в
> `shared/config/preview.ts`, который стоит денег, а не рисует заглушку — обязан
> быть снят до боевого запуска, снимается вместе с реальным провайдером в 1.10.

Вёрстка при этом перенесена вся, включая экраны ещё не написанных механик:

- блоки без источника данных спрятаны за флагами в `src/shared/config/preview.ts` —
  по этому файлу видно границу между витриной и работающей функцией;
- шторки `AttackSheet` и `VoteSheet` свёрстаны, но никуда не подключены;
  `RaiseSheet`, `PaySheet` и `ResultSheet` подключены к Raise и платному входу;
- экран проекта свёрстан и пока недостижим: витрина не передаёт на него переход.

Тесты — двумя уровнями, см. «Команды» ниже.

## Стек

React 19 + TypeScript + Vite, FSD-структура, CSS-модули на дизайн-токенах.
Бэкенд — Supabase: PostgreSQL, Edge Functions (Deno), Realtime. Node 22.

## Команды

```bash
npm run dev            # локальный фронт
npm run build          # прод-сборка
npm run check          # типы + линт + prettier + правило изоляции платформы + тесты
npm run format         # prettier --write
npm run test           # тесты Edge Functions (deno test), требует установленного Deno; входит в check и CI
npm run test:db        # интеграционные тесты хранимок против живой базы (deno test),
                        # нужны Deno и SUPABASE_DB_URL в .env; в check и CI НЕ входят
```

`npm run check` намеренно совпадает по составу с CI. Если добавляешь проверку в
пайплайн — добавь и сюда: расхождение всплывает только после пуша, уже красным.

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

В `supabase/migrations/` кроме схемы лежат хранимки и вьюха: идентичность
(`resolve_telegram_identity`), дедупликация кликов (`register_project_click`),
агрегаты категорий (`category_stats`) и применение платежа одной транзакцией
(`apply_payment`, идемпотентна). Часть логики опущена в базу намеренно —
там, где несколько связанных записей обязаны быть одной транзакцией.

> Локальные файлы миграций и история в связанной базе (`bidwar-dev`) разошлись
> начиная со второй миграции: часть применялась через Supabase MCP с
> генерируемым таймстемпом, и `supabase db push` попытается переприменить их
> поверх этой истории. Чинится связкой `supabase login` и
> `supabase migration repair` перед первым `db push` — подробности в
> документе `12 Состояние реализации` (Obsidian).

### Edge Functions

```text
health           версия и живость
auth             initData → users.id
bot              вебхук Telegram, /start с реферальным параметром
add-project      создание записи + OG-фетч с защитой от SSRF
click            счётчик переходов с дедупликацией
create-payment   валидация и создание платежа (сейчас — мок)
payment-webhook  применяет платёж через apply_payment; пока не вызывается
                 никем — ждёт вебхука настоящего провайдера (срез 1.10)
```

**Деплой ручной, автоматизации нет** — в CI функции не выкладываются:

```bash
npx supabase functions deploy <name>
npx supabase secrets set BOT_TOKEN=... WEBHOOK_SECRET=...
```

Общая обвязка (разбор запроса, единый формат ошибки, логирование) — в
`supabase/functions/_shared/`. ESLint функции не проверяет: у Deno свои импорты.

## Структура

```text
src/
  app/            Shell, навигация (вкладки + стек), тема
  pages/          paid, free, tasks, profile, project — каждая со своими model/ и ui/
  widgets/        mobile/ — экраны и шторки; desktop/ — пусто до Этапа 2
  features/       raise/ — платёж и подъём позиции; attack/vote придут в 1.6–1.7
  entities/       project, user, task, category
  shared/
    ui/           дизайн-система на токенах
    content/      правила, легалка, копирайтинг
    i18n/         строки интерфейса под RU/UZ/EN
    config/       preview-флаги: что нарисовано, но не подключено
    api/          supabase client, вызовы Edge Functions
    platform/     единственное место, знающее про Telegram
    lib/          форматирование сумм и дат
supabase/
  migrations/     схема, индексы, RLS, сиды, хранимки
  functions/      Edge Functions
design/           дизайн-кит: токены, компоненты, UI-киты mini_app и web
```

`rules` и `docs` — виджеты, а не страницы: своего `model/` у них нет, весь текст
лежит в `shared/content` и не грузится.

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

### Адреса

Одно развёртывание доступно по трём именам — это нормально и так и задумано:

```text
bidwar.world          сайт (Этап 2), индексируется
app.bidwar.world      мини-апп, этот адрес идёт в BotFather
bidwar.pages.dev      служебный алиас Pages, плюс превью веток
```

Кастомный домен в Pages **не заменяет** `*.pages.dev`: адрес выдаётся проекту
навсегда, и на нём же живут превью веток (`<branch>.bidwar.pages.dev`). Убрать
его нельзя.

Поэтому индексируется только `bidwar.world`, а мини-апп и все `*.pages.dev`
отдают `X-Robots-Tag: noindex` — правила по хостам в `public/_headers`. Именно
заголовком, а не `Disallow` в `robots.txt`: тот запрещает обход, но не
индексацию, и закрытый им адрес всё равно может всплыть в выдаче. Заголовок
краулер увидит, только если пустить его на страницу.

`public/_headers` задаёт ещё CSP и кеширование. Там намеренно **нет**
`X-Frame-Options` и есть `frame-ancestors` с доменами Telegram: Mini App
открывается внутри айфрейма, и запрет фрейминга её сломает.

## Правила, которые проверяет CI

- **Прямых обращений к `window.Telegram` вне `shared/platform` и `app/telegram` нет** —
  `scripts/check-platform-isolation.sh`. Всё, что знает про Telegram, живёт за
  интерфейсом `platform/`, иначе веб-версия в Этапе 2 пишется заново.
- **Нижние слои не импортируют из `app/` и `widgets/`** — `no-restricted-imports`
  в `eslint.config.js` для `entities`, `features`, `shared` и `pages/*/model`.
  Логика, утёкшая в композицию, — это и есть тот веб, который придётся дописывать.
- Типы, линт, prettier и сборка проходят.

## Переменные окружения

`.env.example` — список. Во фронт попадает только `VITE_*`; `SUPABASE_SERVICE_ROLE_KEY`,
`BOT_TOKEN` и ключи провайдеров живут в окружении Edge Functions и в бандл не
попадают никогда.

## Коммиты

Conventional Commits, **на английском**, без трейлеров. Работа идёт через ветки и
pull request'ы, не прямыми пушами в `main`.
