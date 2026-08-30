FROM oven/bun:1.3 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ARG VITE_FUNCTIONS_BASE=/api
ENV VITE_FUNCTIONS_BASE=${VITE_FUNCTIONS_BASE}

RUN bun run build \
    && if grep -R "functions.poehali.dev" /app/dist; then \
         echo "В frontend-сборке остались vendor URL" >&2; \
         exit 1; \
       fi

FROM nginx:1.28-alpine

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
