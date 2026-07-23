FROM node:22-alpine

WORKDIR /app
RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY web/package.json web/package.json
COPY server/package.json server/package.json
RUN pnpm install --frozen-lockfile

COPY web web
COPY server server

RUN pnpm --filter web run build

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server/src/index.js"]
