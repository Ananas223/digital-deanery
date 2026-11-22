# syntax=docker/dockerfile:1

# Образ приложения «Цифровой деканат будущего».
# Next.js 16 (standalone) + Prisma 7 с драйвер-адаптером PostgreSQL.
# Требуется Node >= 22.13 (см. engines в package.json).

FROM node:22-alpine AS base
# libc6-compat нужен нативным модулям, openssl — Prisma.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- Зависимости: только манифесты и Prisma, чтобы слой кешировался -----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma7.config.ts ./
# `npm ci` запускает postinstall → `prisma generate`
# (клиент попадает в src/generated/prisma).
RUN npm ci

# --- Сборка: standalone-вывод, без dev-зависимостей в рантайме ---------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Заглушки только на время сборки: база и Better Auth на этапе `next build`
# не нужны, но модули читают переменные при импорте. Значения передаются
# одной командой (не `ENV`), чтобы не оседать в метаданных образа; реальные
# приходят из окружения контейнера в рантайме, `.env` в образ не копируется.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    BETTER_AUTH_SECRET="build-only-placeholder-secret-0123456789" \
    BETTER_AUTH_URL="http://localhost:3000" \
    npm run build

# --- Рантайм: standalone-сервер от непривилегированного пользователя ---------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Клиент Prisma 7 генерируется в src/generated/prisma (см. prisma/schema.prisma);
# копируем каталог, чтобы сгенерированный код был доступен и по исходному пути.
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated

USER nextjs
EXPOSE 3000

# Проба живости: публичный маршрут проверяет приложение и соединение с базой.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
