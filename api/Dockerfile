FROM node:22-alpine AS build
WORKDIR /app
COPY api/package*.json ./
COPY packages/shared-types /packages/shared-types
RUN npm install --legacy-peer-deps --no-audit --no-fund
COPY api/prisma ./prisma
RUN npx prisma generate
COPY api/ .
RUN npm run build
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
CMD ["sh", "-c", "npm run db:migrate:deploy && node dist/main.js"]