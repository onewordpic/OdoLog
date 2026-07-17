# OdoLog — dev/build container.
#
# Note: OdoLog deploys to Cloudflare Workers (edge) in production. This image
# is for reproducible local dev and CI builds, not a 1:1 production runtime —
# server functions (fuel-price scraper, Google Calendar callback, etc.) run in
# the Workers runtime, not Node. Use this for `bun dev`, `bun run build`, or
# serving the built static shell.

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
