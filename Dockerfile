FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "start"]
