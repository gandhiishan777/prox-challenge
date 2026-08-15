# Deployment image for the OmniPro 220 assistant.
#
# The Agent SDK spawns a subprocess and holds a streaming connection open for the
# length of an answer, so this wants a persistent Node host (Railway, Render, Fly)
# rather than a serverless function.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `prebuild` bundles the sandboxed artifact runner before Next builds.
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
# The knowledge pack is read at runtime: the system prompt is assembled from it
# and the tools serve its images.
COPY --from=build /app/knowledge ./knowledge
COPY --from=build /app/next.config.mjs ./next.config.mjs

EXPOSE 3000
CMD ["npm", "run", "start"]
