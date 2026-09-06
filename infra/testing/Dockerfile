# Disposable Linux verification environment; never a deployment image.
FROM python:3.12-slim-bookworm AS python
FROM node:22.13.0-bookworm
COPY --from=python /usr/local /usr/local
WORKDIR /work
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci && npx playwright install --with-deps chromium
COPY apps/api apps/api
RUN python -m venv apps/api/.venv && apps/api/.venv/bin/python -m pip install --upgrade pip && apps/api/.venv/bin/pip install -e 'apps/api[dev]'
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["npm", "run", "test:e2e"]
