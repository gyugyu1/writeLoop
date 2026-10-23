# 빌드 컨텍스트는 저장소 루트다. 루트 package-lock.json으로 npm ci를 해서 매번 같은 버전으로 설치한다.
# 컨텍스트에 들어가는 파일은 Dockerfile.dockerignore가 정한다.
FROM node:24-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/frontend/package.json ./apps/frontend/package.json
RUN npm ci

FROM node:24-alpine AS builder

WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL=http://backend:8080
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/frontend ./apps/frontend
RUN npm run build --workspace @english-learning/frontend

FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_BASE_URL=http://backend:8080
COPY --from=builder --chown=node:node /app/apps/frontend/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/frontend/.next ./.next
COPY --from=builder --chown=node:node /app/apps/frontend/public ./public
COPY --from=builder --chown=node:node /app/apps/frontend/next.config.ts ./next.config.ts
EXPOSE 3000

USER node

CMD ["npm", "run", "start"]
