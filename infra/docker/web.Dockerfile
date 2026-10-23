FROM node:24-alpine

RUN corepack enable
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ai-trading/web... build

EXPOSE 3000
CMD ["pnpm", "--filter", "@ai-trading/web", "start"]
