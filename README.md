# Нейро-Ассистент — Платформа автоматизации Авито

Веб-платформа для автоматизации работы с объявлениями на Авито через Avito API, n8n и AI-модули.

## Стек технологий

| Слой | Технология |
|------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui-style components, next-themes, recharts, @tanstack/react-table |
| Backend | NestJS, TypeScript, Prisma ORM, JWT auth, Swagger/OpenAPI |
| Database | PostgreSQL 16 |
| Orchestration | n8n (self-hosted) |
| Search | SearXNG (self-hosted) |
| Infra | Docker Compose, Nginx reverse proxy |

## Структура проекта

```
├── backend/                 # NestJS API
│   ├── prisma/              # Prisma schema, migrations, seed
│   ├── src/
│   │   ├── common/          # Guards, decorators, utils
│   │   ├── modules/         # Auth, Users, Projects, Avito, Bidder,
│   │   │                    # Autoload, Chat, Competitors, Analytics,
│   │   │                    # Reviews, Funnel, N8N, System
│   │   └── prisma/          # PrismaService
│   └── Dockerfile
├── frontend/                # Next.js 14 App
│   ├── src/
│   │   ├── app/             # Pages (App Router)
│   │   ├── components/      # UI + Layout components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # API client, auth context, utils
│   │   ├── styles/          # Global CSS + theme variables
│   │   └── types/           # TypeScript interfaces
│   └── Dockerfile
├── n8n-workflow-examples/   # Importable n8n workflows (JSON)
├── nginx/                   # Nginx config
├── docker-compose.yml
└── .env.example
```

## Быстрый старт

### 1. Клонирование и настройка

```bash
git clone <repo-url>
cd my-project
cp .env.example .env
# Отредактируйте .env — заполните секреты и ключи
```

### 2. Запуск через Docker Compose (продакшен/VPS)

```bash
docker compose up -d
```

Сервисы:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000/api
- **Swagger Docs**: http://localhost:4000/docs
- **n8n**: http://localhost:5678
- **SearXNG**: http://localhost:8080
- **Nginx** (прокси): http://localhost:80

После запуска выполните миграции и сид:
```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```

### 3. Запуск для разработки (без Docker)

**Требования**: Node.js 20+, PostgreSQL 16+

```bash
# PostgreSQL должен быть запущен, DATABASE_URL в .env

# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run start:dev
# → http://localhost:4000

# Frontend (в отдельном терминале)
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

## Демо-доступ (после seed)

| Email | Пароль | Роль |
|-------|--------|------|
| admin@neuro-assistant.ru | admin123 | ADMIN |
| manager@neuro-assistant.ru | manager123 | MANAGER |

## Модули платформы

### Биддер ставок
Автоматическое управление ставками: стратегии HOLD_POSITION, MIN_BID, MAX_COVERAGE, SCHEDULE_BASED.
Настройка мин/макс ставки, дневного бюджета, расписания. Журнал выполнения и графики.

### Автозагрузка
Мониторинг статуса выгрузки объявлений. Отчёты с количеством ошибок и алерты.

### Чаты / AI-Автоответчик
Список диалогов, просмотр сообщений, AI-генерация ответов, статусы обработки.

### Анализ конкурентов
Поиск через SearXNG, история снимков выдачи, просмотр результатов.

### Сквозная аналитика
Views, Favorites, Contacts, Chats, Calls, Spend, CPL, ROI, ROMI.
Графики, таблицы, фильтрация по датам, экспорт CSV.

### Отзывы + AI
Список отзывов, AI-генерация ответов, редактирование черновиков, публикация.

### Воронка продаж
Визуальная воронка конверсий, калькулятор ROI/ROMI/CPL.

### Админ-панель
Статус PostgreSQL, n8n, SearXNG. Системные события и ошибки.

## API для n8n

n8n обращается к backend через эндпоинты:

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/n8n/config` | Получить конфигурацию (правила, аккаунты) |
| POST | `/api/n8n/log` | Записать лог выполнения |
| POST | `/api/n8n/status` | Обновить статус воркфлоу |
| POST | `/api/n8n/alert` | Создать оповещение |

Авторизация: заголовок `X-N8N-API-Key`.

Примеры воркфлоу в `/n8n-workflow-examples/`:
1. **01-bidder-cycle.json** — Цикл биддера (каждые 5 мин)
2. **02-autoload-monitor.json** — Мониторинг автозагрузки (каждые 15 мин)
3. **03-reviews-monitor.json** — Мониторинг отзывов + AI (каждый час)

Импортируйте их в n8n через Settings → Import Workflow.

## Avito OAuth2

Полный Authorization Code Flow:
1. `GET /api/avito/oauth/start?projectId=X` — редирект на Авито
2. `GET /api/avito/oauth/callback` — обмен кода на токены
3. `POST /api/avito/refresh` — обновление токенов
4. `GET /api/avito/status?projectId=X` — проверка статуса

Токены хранятся с AES-256-GCM шифрованием. Никогда не передаются на фронтенд.

## Переменные окружения

Смотри `.env.example` для полного списка. Ключевые:

- `DATABASE_URL` — PostgreSQL
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — секреты токенов
- `TOKEN_ENCRYPTION_KEY` — ключ шифрования токенов Авито (мин. 32 символа)
- `AVITO_CLIENT_ID` / `AVITO_CLIENT_SECRET` — ваши OAuth-креды Авито
- `N8N_API_KEY` — ключ авторизации для n8n → backend

## Безопасность

- JWT + Refresh Tokens с RBAC (ADMIN / MANAGER)
- Rate limiting на публичных эндпоинтах
- Валидация через class-validator
- CORS настроен
- Helmet для HTTP заголовков
- Токены Авито: AES-256-GCM шифрование
- Секреты только в .env, не в коде
