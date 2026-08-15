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

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/package.json ./package.json
# The knowledge pack is read at runtime: the system prompt is assembled from it
# and the tools serve its images.
COPY --from=build --chown=node:node /app/knowledge ./knowledge
COPY --from=build --chown=node:node /app/next.config.mjs ./next.config.mjs

# The Agent SDK's CLI refuses to run with bypassPermissions as root ("cannot be
# used with root/sudo privileges"), so the container must run as a real user.
# `node` ships in the base image with a writable home for the SDK's session state.
USER node

EXPOSE 3000
CMD ["npm", "run", "start"]
