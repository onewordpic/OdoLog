# OdoLog — container image.
#
# Targets:
#   dev   → hot-reloading Vite dev server on :8080 (default for docker compose)
#   build → runs the production build and keeps the artifacts in /app/.output
#
# Production note: OdoLog builds to a Cloudflare Workers (edge) bundle, so the
# build output is not a Node server you can `node server.js`. The `build` stage
# exists for reproducible CI builds and artifact extraction, not for serving.

FROM oven/bun:1.1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* bunfig.toml* ./
RUN bun install --frozen-lockfile || bun install

FROM oven/bun:1.1-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV HOST=0.0.0.0 PORT=8080
EXPOSE 8080
CMD ["bun", "run", "dev", "--host", "0.0.0.0", "--port", "8080"]

FROM oven/bun:1.1-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build
# Artifacts live in /app/.output — copy them out with:
#   docker build --target build -t odolog-build . && \
#   docker create --name x odolog-build && docker cp x:/app/.output ./.output
CMD ["sh", "-c", "ls -R /app/.output"]
