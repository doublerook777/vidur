# Vidur: one container serves the phone app, the showcase and the speech gateway on $PORT.
# Build:  docker build -t vidur .
# Run:    docker run --rm -p 127.0.0.1:8080:8080 --env-file .env vidur       (your own key, local mode)
#         docker run --rm -p 127.0.0.1:8080:8080 -e MODE=mock vidur           (no keys, scripted speech)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
RUN npm ci
COPY packages packages
COPY apps apps
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY packages/core/package.json packages/core/
# Only what the server needs at run time. The web app is already built, and no key is ever baked in.
RUN npm ci --omit=dev --workspace @vidur/server --workspace @vidur/core --include-workspace-root=false && npm cache clean --force
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/web/dist apps/web/dist
# Docker publishes the port; inside the container the server must listen on every interface.
ENV HOST=0.0.0.0 PORT=8080
EXPOSE 8080
USER node
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://127.0.0.1:${PORT}/healthz || exit 1
CMD ["node", "apps/server/dist/index.js"]
