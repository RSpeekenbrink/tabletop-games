# syntax=docker/dockerfile:1.7

# ---- deps: install npm workspace deps (with dev, for the build stage) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN --mount=type=cache,target=/root/.npm \
    npm install --workspaces --include-workspace-root

# ---- build: compile shared, build client (Vite), compile server ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=deps /app/packages/client/node_modules ./packages/client/node_modules
COPY . .
RUN npm run build:shared && npm run build:client && npm run build:server

# ---- runtime: production deps only + compiled output ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=2567

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev --workspaces --include-workspace-root --workspace=@tabletop-games/shared --workspace=@tabletop-games/server

COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/client/dist ./packages/client/dist

EXPOSE 2567
CMD ["node", "packages/server/dist/index.js"]
