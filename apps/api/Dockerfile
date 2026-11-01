FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @klindom/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY db db
RUN pnpm -F @klindom/api build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# dist holds both entrypoints: server.cjs (default) and worker.cjs (the compose `worker` service).
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
