FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
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
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/db/seed ./db/seed
USER node
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
