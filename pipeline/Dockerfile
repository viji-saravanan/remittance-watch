# The ingest pipeline ships as its own image: a full ingest runs anywhere with
# `docker run --rm -e DATABASE_URL=… ghcr.io/viji-saravanan/rw-ingest <cmd>`.
# uv manages Python + deps inside the image so local, CI, and container stay identical.
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Deps first: lockfile layer caches independently of source changes.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src
RUN uv sync --frozen --no-dev

# Migrations live inside the package (importlib.resources), so the image is
# self-contained — point DATABASE_URL at any Postgres and go.
ENTRYPOINT ["uv", "run", "--no-sync", "rw-ingest"]
CMD ["--help"]
