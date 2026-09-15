FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.4.1 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ucell/database exec prisma generate
RUN pnpm build

EXPOSE 3000
CMD ["pnpm","--filter","@ucell/api","start:prod"]
