# syntax=docker/dockerfile:1.7

# ---- build: install all deps, compile shared+server, vite-build client ----
FROM node:22-alpine AS build
WORKDIR /app

# Copy only manifests first so the install layer is cached when source changes.
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

RUN --mount=type=cache,target=/root/.npm \
    npm install --workspaces --include-workspace-root

COPY . .
RUN npm run build

# ---- runtime: production deps only + compiled output ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=2567

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# Install prod deps for shared + server only (client deps are bundled into the
# Vite output, so the runtime image doesn't need react/three/etc.).
RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev --include-workspace-root \
      --workspace=@tabletop-games/shared \
      --workspace=@tabletop-games/server

COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/client/dist ./packages/client/dist

EXPOSE 2567
CMD ["node", "packages/server/dist/index.js"]
