# Цифровой деканат будущего

Учебный концепт личного кабинета студента, созданный для конкурса. Это не официальный сервис вуза.

## Документация

- [`docs/PRD.md`](docs/PRD.md) — продуктовые требования: базовые функции, пользовательские сценарии и критерии приёмки.
- [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) — пошаговый план разработки ядра с чекбоксами и гейтами.
- [`AGENTS.md`](AGENTS.md) — обязательные ограничения для ИИ-агентов: архитектура, безопасность, качество и процесс.
- [`docs/SUBMISSION.md`](docs/SUBMISSION.md) — чек-лист сдачи работы по требованиям конкурса.
- [`docs/ai-log.md`](docs/ai-log.md) — журнал работы ИИ-агентов: инструменты, промпты, этапы.
- [`docs/adr/0001-stack.md`](docs/adr/0001-stack.md) — архитектурное решение по стеку и ограничения совместимости.
- [`docs/third-party.md`](docs/third-party.md) — реестр сторонних компонентов и лицензий.

## Стек

**Frontend**

- Next.js (App Router), React, TypeScript (strict)
- Tailwind CSS v4, shadcn/ui, Base UI
- Motion, Recharts, Lucide React
- React Hook Form, Zod
- React Context + `useReducer` для локального UI-состояния

**Backend**

- Next.js Server Actions, Route Handlers
- PostgreSQL, Prisma ORM
- Better Auth, RBAC
- Zod для серверной валидации

**AI (опциональный трек)**

- Vercel AI SDK, Agent Tools, LLM Provider API

**Тесты**

- Playwright, Vitest

Правила работы со стеком и ограничения — в [`AGENTS.md`](AGENTS.md) § 2. Архитектурное обоснование — в [`docs/adr/0001-stack.md`](docs/adr/0001-stack.md).

## Статус

Документация и план готовы. Реализация приложения ещё не начата: `package.json`, `prisma/` и `src/` отсутствуют. Документы описывают целевую версию продукта.

## Запуск

Инструкция по локальному запуску пока отсутствует — приложение не реализовано.

## Демо-аккаунты

Демонстрационные аккаунты пока отсутствуют: `prisma/seed.ts` не реализован. Учётные данные не хранятся в коде.

## Сдача работы

Требования ТЗ к сдаче собраны в чек-листе [`docs/SUBMISSION.md`](docs/SUBMISSION.md): ссылка на прототип, демо-аккаунты, репозиторий/архив, PDF-описание процесса и видео. Сборка пакета — этап 8 плана.
