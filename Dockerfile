# ==============================================================================
# DMHA — Smart Learning App · Production Node 24 Standalone Container
# Works seamlessly on Hugging Face Spaces (port 7860), Render ($PORT), & VPS.
# ==============================================================================

FROM node:24-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# --- Stage 1: Install lean standalone dependencies (fast & low-RAM build) ---
FROM base AS deps
COPY package.docker.json ./package.json
RUN npm install --no-audit --no-fund

# --- Stage 2: Build standalone Next.js desktop app + /dmhs-api/* backend ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Swap in the lean Docker configs and strip Figma/Payload-only files inside
# the container build layer only (your workspace source remains untouched).
RUN rm -rf src/app/\(payload\) src/collections src/payload.config.ts src/payload-types.ts src/lib/payload.ts figma-image-loader.ts next.config.ts && \
    cp package.docker.json package.json && \
    cp next.config.docker.mjs next.config.mjs && \
    NODE_ENV=production NODE_OPTIONS="--no-deprecation --max-old-space-size=2048" npx next build

# --- Stage 3: Minimal production runtime (UID 1000 compatible with HF Spaces) ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=7860
ENV DMHS_ALLOW_DEMO_LOGIN=true
ENV DMHS_DATA_DIR=/app/data
ENV DMHS_UPLOAD_DIR=/app/public/uploads

# Copy Next.js standalone server, static bundles, and public assets
COPY --from=builder --chown=1000:1000 /app/public ./public
COPY --from=builder --chown=1000:1000 /app/.next/standalone ./
COPY --from=builder --chown=1000:1000 /app/.next/static ./.next/static

# Ensure SQLite data and runtime upload folders exist and are writable by UID 1000
RUN mkdir -p /app/data /app/public/uploads && \
    chown -R 1000:1000 /app/data /app/public/uploads

USER 1000
EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 7860) + '/dmhs-api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--no-deprecation", "server.js"]
