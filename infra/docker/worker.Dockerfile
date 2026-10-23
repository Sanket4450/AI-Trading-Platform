FROM node:24-alpine

RUN corepack enable
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ai-trading/worker... build

CMD ["node", "apps/worker/dist/main.js"]
