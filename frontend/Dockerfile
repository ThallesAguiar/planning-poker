FROM node:22-alpine AS build
WORKDIR /app
# --- dependencia local @planning-poker/shared-types (sem passo de build: aponta para src/) ---
COPY frontend/package*.json ./frontend/
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/shared-types/ ./packages/shared-types/
RUN cd frontend && npm install --legacy-peer-deps --no-audit --no-fund
COPY frontend/ ./frontend/
ARG VITE_API_URL=http://localhost:3333
ENV VITE_API_URL=$VITE_API_URL
RUN npm --prefix frontend run build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80