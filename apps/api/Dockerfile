FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100

WORKDIR /app

COPY pyproject.toml ./
COPY src ./src
RUN python -m pip install --no-cache-dir .

COPY alembic.ini ./
COPY migrations ./migrations

RUN useradd --create-home --uid 10001 nuzenio
USER nuzenio

EXPOSE 8000

CMD ["/bin/sh", "-c", "alembic -c alembic.ini upgrade head && python -m nuzenio_api.seed && uvicorn nuzenio_api.main:app --host 0.0.0.0 --port 8000"]
