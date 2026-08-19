FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends tor curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/log/tor /var/lib/tor \
    && chown -R debian-tor:debian-tor /var/log/tor /var/lib/tor

WORKDIR /app
COPY collector/requirements.txt /app/collector/requirements.txt
RUN pip install --no-cache-dir -r /app/collector/requirements.txt
COPY collector /app/collector
COPY collector/entrypoint.sh /app/entrypoint.sh
RUN chmod 0755 /app/entrypoint.sh
EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
