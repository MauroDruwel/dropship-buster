# Dropship Buster - Telemetry & Ingestion Backend
FROM python:3.12-slim

WORKDIR /app

# Install curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend server, database, and pattern mining tools
COPY server/ ./server/
COPY db/ ./db/
COPY tools/ ./tools/

# Create persistent storage directories
RUN mkdir -p /app/server/vault /app/db/snapshots

# Environment defaults
ENV PORT=8787 \
    PYTHONUNBUFFERED=1

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

ENTRYPOINT ["python3", "server/app.py"]
