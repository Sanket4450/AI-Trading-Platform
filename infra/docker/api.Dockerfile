FROM node:24-alpine

RUN corepack enable
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ai-trading/api... build

EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
