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

### Сделано
Проверено 20.10.2026 на локальной Supabase: линтер, типы, `test:unit`, `test:rls` (с новыми тестами чатов), `test:e2e` (21 тест),
скриншоты на 390, 768 и 1280 px.
- Цены: «Цена тиража» → «Стоимость тиража»; подсказки в полях нейтральные: «Название позиции / параметра / варианта / услуги».
- Настройки: выбор фирменного цвета убран. Цвет остаётся в базе и задаётся `--color` при создании типографии.
- Иконка: круглая, без белой рамки. Для iOS (`?opaque=1`) и Android (`?maskable=1`) — квадрат в фирменном цвете с круглым логотипом.
  Проверены все шесть вариантов (с логотипом и без). Логотип обрезается кругом (`cover`): широкий логотип-надпись обрежется по краям.
- Чаты, миграция `supabase/migrations/20261020000000_chat_folders.sql`:
  - таблица `chats`, функции `close_chat` / `reopen_chat`, триггер: новое сообщение возвращает чат в активные;
  - кнопка «Завершить чат» / «Вернуть в активные» в шапке диалога;
  - папки «Активные» / «Завершённые»;
  - звёздочка, если у клиента раньше уже был завершённый разговор;
  - поиск по именам и тексту сообщений; `ilike` находит кириллицу (и «ё») без учёта регистра.
  - Тесты: RLS (`RLS: chat folders` — клиент не видит и не меняет папки, чужой сотрудник не завершает, новое сообщение
    возвращает чат, счётчик завершений) и e2e «completes a chat…» в `tests/e2e/admin.spec.ts`.
- «О компании»: ряд круглых кнопок MAX / Звонок / Telegram / Написать / Маршрут убран, остались кликабельные строки контактов.
- Клиентская часть на планшетах и ПК: колонка `max-w-md` → `md:max-w-2xl lg:max-w-3xl`, отступы от md больше
  (`Screen`, чат, `loading`, полоса баннеров). От md в две колонки: «Ещё в работе» и «Выданные» (карточка становится плиткой:
  иконка и статус сверху, название ниже), контакты на «О компании», профиль (личные данные слева, уведомления и ссылки справа).
  Нижняя панель осталась узкой по центру.

### Не доделано
1. ИИ-чат для менеджера: не начат, нужно решение типографии.
   - Что он должен уметь: отвечать на вопросы, писать черновики ответов клиентам, знать заказы и цены?
   - Провайдер: проверить доступность API Anthropic из России (официально не поддерживается); альтернативы — YandexGPT, GigaChat.
     Если в ИИ уходят переписки клиентов — учесть 152-ФЗ.
   - Ключ API — в переменные окружения Vercel.
2. Деплой:
   - до выкатки применить миграцию к боевой базе (на 20.10.2026 таблицы `chats` там нет): Supabase → SQL Editor →
     вставить `20261020000000_chat_folders.sql` (или `npm run db:push` с `DATABASE_URL`). Без неё список чатов работает,
     но «Завершить чат» вернёт ошибку;
   - Vercel не подключён к GitHub, preview-сборок веток нет: проверить на телефоне через `vercel deploy` (preview),
     затем влить `manager-feedback` в `ru-hosting-calculator` и выкатить `vercel deploy --prod`.
3. Ветка `gallery-uploads` (фото из галереи, камеры и облака, входит в `manager-feedback`) ждёт проверки на телефоне Нины.
