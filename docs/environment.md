# Environment variables

Copy `.env.example` to `.env` for local development. Never commit real credentials.

## Web

| Variable | Default/example | Purpose |
| --- | --- | --- |
| `NUZENIO_API_BASE_URL` | `http://localhost:8000` | Server-only API URL used by Next.js. Preferred for server rendering. |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Public-compatible fallback API URL. Do not place credentials in it. |
| `NUZENIO_ENABLE_DEMO_FALLBACK` | `false` | Allows checked-in fixture fallback after network/5xx failures only in non-production development. |

The client always disables demo fallback when `NODE_ENV=production`, even if the fallback variable is true. Valid API empty results and 4xx responses are never replaced with fixture data.

## API

Pydantic settings use the `NUZENIO_` prefix.

| Variable | Default/example | Purpose |
| --- | --- | --- |
| `NUZENIO_ENVIRONMENT` | `development` | Environment label. |
| `NUZENIO_DATABASE_URL` | `postgresql+psycopg://nuzenio:nuzenio@localhost:5432/nuzenio` | SQLAlchemy PostgreSQL URL. |
| `NUZENIO_TEST_DATABASE_URL` | same host, database `nuzenio_test` | Disposable integration-test database. Consumed by tests, not application settings. |
| `NUZENIO_REDIS_URL` | `redis://localhost:6379/0` | Reserved cache/job URL. Redis-backed jobs are not implemented yet. |
| `NUZENIO_CORS_ORIGINS` | `["http://localhost:3000"]` | JSON array of allowed web origins. |
| `NUZENIO_MAX_PAGE_SIZE` | `50` | Maximum accepted reader page size. |
| `NUZENIO_SQL_ECHO` | `false` | Enables SQLAlchemy SQL logging for local diagnostics. |
| `NUZENIO_DEMO_MODE` | `true` | Labels the local edition as fictional demonstration data. |

Use a secret manager for production credentials. Milestone 2A does not include a production deployment configuration.

## Compose-only PostgreSQL

| Variable | Default | Purpose |
| --- | --- | --- |
| `POSTGRES_DB` | `nuzenio` | Local database name. |
| `POSTGRES_USER` | `nuzenio` | Local database user. |
| `POSTGRES_PASSWORD` | `nuzenio` | Local-only password. Replace outside local development. |

The Compose values in `.env.example` are local development defaults, not production credentials.
