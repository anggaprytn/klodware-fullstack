FROM mcr.microsoft.com/playwright:v1.60.0-noble AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder

WORKDIR /app
COPY . .
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.60.0-noble AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/docs/reference ./docs/reference

EXPOSE 3000
CMD ["npm", "run", "start"]
