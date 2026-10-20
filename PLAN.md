# PrintFlow MVP — план

## Схема БД (Supabase Postgres, все таблицы под RLS)
- `companies`: id, name, slug (unique), logo_url, brand_color, phone, email, address, work_hours, created_at
- `profiles`: id (= auth.users.id), company_id, role (`client|staff|owner`), full_name, phone, created_at
  - пользователь привязан к одной компании; клиент регистрируется через `/c/[slug]`,
    триггер на `auth.users` создаёт профиль с ролью `client` (роль из метаданных игнорируется)
- `orders`: id, company_id, client_id → profiles, number (сквозной в рамках компании, триггер),
  title, description, status (`accepted|design|printing|finishing|ready|delivered`),
  due_date, delivery_method (`pickup|delivery`), delivery_address, comment, created_at, updated_at
- `messages`: id, company_id, client_id (диалог = клиент), sender_id, body, read_at, created_at
  - непрочитанные = сообщения другой стороны с `read_at is null`
- `faqs`: id, company_id, question, answer, position
- Storage: публичный bucket `logos` (запись — только staff/owner своей компании)

## RLS
- Хелперы `security definer`: `my_company_id()`, `my_role()`
- `companies`: select — всем (публичная витрина по slug: имя, лого, цвет, контакты); update — owner своей
- `profiles`: client — только свой; staff/owner — все профили своей компании
- `orders`: client — select своих; staff/owner — CRUD в своей компании
- `messages`: client — select/insert в своём диалоге; staff/owner — все диалоги своей компании;
  update только `read_at`
- `faqs`: select — всем по company_id; CRUD — staff/owner своей компании
- Realtime: публикация `messages` и `orders` (RLS применяется к подпискам)

## Маршруты
Клиент (mobile-first, нижние табы, брендинг через CSS-переменную `--brand`):
- `/c/[slug]/login`, `/c/[slug]/register`
- `/c/[slug]` — заказы; `/c/[slug]/orders/[id]` — карточка со шкалой этапов
- `/c/[slug]/chat`, `/c/[slug]/faq`, `/c/[slug]/profile`, `/c/[slug]/about`
- `/c/[slug]/manifest.webmanifest` — динамический manifest (имя, цвет, иконка компании)

Админка (desktop-first, сайдбар):
- `/admin/login`
- `/admin/orders`, `/admin/orders/new`, `/admin/orders/[id]`
- `/admin/clients`, `/admin/clients/[id]`
- `/admin/chat`, `/admin/chat/[clientId]`
- `/admin/faq`, `/admin/settings` (settings — только owner)
- `/` — редирект на демо-компанию

Мутации — Server Actions через `@supabase/ssr` под сессией пользователя (не service role).

## Этапы
- [x] 1. Каркас Next.js + shadcn, миграции схемы, RLS, сид, тест RLS
- [x] 2. Авторизация (клиент/админ), middleware, проверка ролей
- [x] 3. Админка: заказы (таблица, поиск, фильтр, CRUD, быстрая смена статуса/срока), клиенты
- [x] 4. Клиентское приложение: табы, список заказов, карточка заказа
- [x] 5. Чат realtime (обе стороны, непрочитанные)
- [x] 6. FAQ, «О компании», настройки компании, загрузка логотипа, брендинг
- [x] 7. PWA (manifest, SW, иконки, standalone), полировка UI, README, финальная проверка

## Тест
`npm run test:rls` — node:test + supabase-js: создаёт компанию B через service role,
логинится клиентом и сотрудником компании A, проверяет, что заказы/сообщения/профили/FAQ B
не читаются и не пишутся; затем убирает за собой.

## Решения MVP
- Заказ создаётся только на зарегистрированного клиента (выбор из списка).
- Шкала этапов строится по текущему статусу, без истории смен.
- Сид: «Демо-Типография» (slug `demo`), 1 owner-сотрудник, 3 клиента, 10 заказов, 5 FAQ.

## Правки Егора (менеджер типографии), 20.10.2026

Ветка `manager-feedback`, сделана от `gallery-uploads`. В боевую ветку `ru-hosting-calculator` пока не влита.

### Сделано (линтер и проверка типов проходят, в браузере не проверялось)
- Цены: «Цена тиража» → «Стоимость тиража»; подсказки в полях нейтральные: «Название позиции / параметра / варианта / услуги».
- Настройки: выбор фирменного цвета убран. Цвет остаётся в базе и задаётся `--color` при создании типографии.
- Иконка: круглая, без белой рамки. Для iOS (`?opaque=1`) и Android (`?maskable=1`) — квадрат в фирменном цвете с круглым логотипом.
- Чаты, миграция `supabase/migrations/20261020000000_chat_folders.sql`:
  - таблица `chats`, функции `close_chat` / `reopen_chat`, триггер: новое сообщение возвращает чат в активные;
  - кнопка «Завершить чат» / «Вернуть в активные» в шапке диалога;
  - папки «Активные» / «Завершённые»;
  - звёздочка, если у клиента раньше уже был завершённый разговор;
  - поиск по именам и тексту сообщений.
  Миграция применилась на локальной Supabase без ошибок.

### Не доделано
1. Проверить чаты:
   - RLS-тесты для `chats` в `tests/rls.test.ts`: клиент не видит и не меняет `chats`; сотрудник другой компании не может завершить чат;
     новое сообщение возвращает чат в активные; повторное завершение увеличивает `closed_count`, «Вернуть в активные» уменьшает.
     Ставить перед тестом флуда: он расходует лимит сообщений клиента A;
   - убедиться, что поиск (`ilike`) находит кириллицу без учёта регистра;
   - `npm run test:e2e`, скриншоты списка чатов на ПК и телефоне.
2. Иконка: посмотреть `/c/demo/app-icon/192`, `?opaque=1`, `?maskable=1` — с логотипом и без него.
3. «О компании» (`src/app/c/[slug]/(app)/about/page.tsx`): убрать ряд кнопок MAX / Звонок / Telegram / Написать / Маршрут
   (массив `actions` и блок под адресом). Строки контактов ниже и так кликабельные.
4. Вёрстка клиентской части для планшетов и ПК:
   - `Screen` (`src/components/client/screen.tsx`): `max-w-md` → `md:max-w-2xl lg:max-w-3xl`, больше отступы от md;
   - то же в `src/app/c/[slug]/(app)/chat/page.tsx` и `src/app/c/[slug]/(app)/loading.tsx`;
   - от md в две колонки: список заказов (`OrderList` в `src/app/c/[slug]/(app)/page.tsx`), контакты на «О компании», блоки профиля;
   - нижняя плавающая панель (`FloatingBar`) остаётся узкой по центру;
   - проверить скриншотами на 768 и 1280 px.
5. ИИ-чат для менеджера: не начат, нужно решение типографии.
   - Что он должен уметь: отвечать на вопросы, писать черновики ответов клиентам, знать заказы и цены?
   - Провайдер: проверить доступность API Anthropic из России (официально не поддерживается); альтернативы — YandexGPT, GigaChat.
     Если в ИИ уходят переписки клиентов — учесть 152-ФЗ.
   - Ключ API — в переменные окружения Vercel.
6. Деплой:
   - до выкатки применить миграцию к боевой базе: Supabase → SQL Editor → вставить `20261020000000_chat_folders.sql`
     (или `npm run db:push` с `DATABASE_URL`). Без неё список чатов работает, но «Завершить чат» вернёт ошибку;
   - проверить preview-сборки Vercel веток `gallery-uploads` и `manager-feedback` на телефоне, затем влить в `ru-hosting-calculator`.
7. Ветка `gallery-uploads` (фото из галереи, камеры и облака) ждёт проверки на телефоне Нины.
