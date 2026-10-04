# PrintFlow

MVP сервиса для типографий и копицентров. Клиент сам видит статус заказа и пишет в чат, а типография ведёт заказы в админке.

- **Клиентское приложение** `/c/[slug]`: PWA, устроено как мобильное приложение и ставится на домашний экран. Есть заказы, карточка заказа со шкалой этапов, чат, FAQ, «О компании» и профиль.
- **Админка** `/admin`: заказы (поиск, фильтр, смена статуса и срока прямо в таблице), клиенты, чат, FAQ и настройки бренда.
- **Мультиарендность**: в каждой таблице есть `company_id`, изоляция сделана политиками RLS в Postgres.

Стек: Next.js 16 (App Router), TypeScript, Tailwind 4, shadcn/ui, Supabase (Postgres, Auth, Realtime, Storage), Vercel.

## Демо-доступы

Пароль у всех: `Demo1234!`

| Роль | Email | Куда входить |
|---|---|---|
| Владелец (сотрудник) | `owner@printflow.demo` | `/admin/login` |
| Клиент | `anna@printflow.demo` | `/c/demo/login` |
| Клиент | `ivan@printflow.demo` | `/c/demo/login` |
| Клиент | `olga@printflow.demo` | `/c/demo/login` |

Демо-типография: «Оттиск», slug `demo`. Новый клиент может зарегистрироваться сам на `/c/demo/register`.

## Запуск локально

```bash
npm install
cp .env.example .env.local   # заполнить (см. ниже)
npm run db:push              # применить миграции из supabase/migrations
npm run seed                 # демо-данные (сид можно запускать повторно, он пересоздаёт демо-компанию)
npm run dev                  # http://localhost:3000
```

### Переменные окружения

| Переменная | Где взять | Где нужна |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | приложение |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable / anon key | приложение |
| `SUPABASE_SERVICE_ROLE_KEY` | secret / service_role key | только `seed` и `test:rls`, **на Vercel не нужна** |
| `DATABASE_URL` | Database → Connection string → **Session pooler** | только `db:push` |

Прямое подключение `db.<ref>.supabase.co` работает только по IPv6, поэтому для миграций используйте строку Session pooler (`aws-0-<region>.pooler.supabase.com:5432`).

### Настройка проекта Supabase

1. Authentication → Sign In / Providers → Email: **выключить «Confirm email»**. Email-уведомлений в MVP нет, клиент входит сразу после регистрации.
2. Всё остальное создают миграции: таблицы, RLS, триггеры, публикация Realtime и bucket `logos`.

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:push` | применить миграции к БД из `DATABASE_URL` |
| `npm run seed` | пересоздать демо-типографию |
| `npm run test:rls` | тест изоляции компаний: клиент и сотрудник компании A не читают и не меняют данные компании B. Тест создаёт свои компании и удаляет их за собой |

## Деплой на Vercel

1. Залить репозиторий на GitHub и импортировать его в Vercel (Framework: Next.js, остальное по умолчанию).
2. Environment Variables: `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Регион функций должен совпадать с регионом Supabase. В `vercel.json` указан `dub1`, он подходит для Supabase `eu-west-1`. Для другого региона Supabase поменяйте значение, например `fra1` для `eu-central-1`. Иначе каждый запрос к БД будет идти через полконтинента.
4. Deploy. Альтернатива без GitHub: `npx vercel` и затем `npx vercel --prod`.

## Установка на телефон

Откройте `https://<домен>/c/demo` на телефоне:
- **iPhone (Safari):** «Поделиться» → «На экран Домой».
- **Android (Chrome):** баннер «Установить приложение» на экране заказов или меню ⋮ → «Установить приложение».

У каждой типографии свой манифест (`/c/[slug]/manifest.webmanifest`): название, иконка из логотипа или первой буквы на фирменном цвете. Приложение открывается без адресной строки (`display: standalone`). Нужен HTTPS (на Vercel он есть сразу).

## Новая типография (пока без UI)

1. Создать компанию в SQL Editor:
   ```sql
   insert into companies (name, slug, brand_color, phone, address, work_hours)
   values ('Копицентр «Пример»', 'primer', '#2563eb', '+7 ...', 'Адрес', 'Пн–Пт 9–19');
   ```
2. Зарегистрировать владельца на `/c/primer/register`, затем повысить ему роль:
   ```sql
   update profiles set role = 'owner' where email = 'boss@primer.ru';
   ```
   Для обычного сотрудника нужна роль `staff`: у него есть доступ ко всей админке, кроме настроек.

## Устройство

```
supabase/migrations/   схема, RLS, триггеры, storage
scripts/seed.ts        демо-данные
tests/rls.test.ts      тест изоляции компаний
src/proxy.ts           обновление сессии, редиректы на вход
src/lib/auth.ts        getSession / requireStaff / requireClient
src/app/c/[slug]/      клиентское приложение (PWA)
src/app/admin/         админка
src/app/actions/       server actions
src/components/chat.tsx  общий realtime-чат для клиента и сотрудника
```

Все запросы идут под сессией пользователя (anon key + JWT), изоляцию данных обеспечивает RLS. Service role используется только в сиде и тесте.

Что вне MVP — в [ROADMAP.md](ROADMAP.md).
