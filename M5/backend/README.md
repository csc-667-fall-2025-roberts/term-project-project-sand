## Backend (M5)

TypeScript/Node backend providing:

- **HTTP API** under `/api/*` (Express)
- **Realtime** updates via Socket.IO (websocket)
- **Postgres** persistence

### Key endpoints

- `GET /api/health` — returns `200` when DB connectivity is OK; `503` otherwise.
- Auth:
  - `POST /api/register`
  - `POST /api/login`
  - `POST /api/refresh`
  - `POST /api/logout`
  - `GET /api/whoami` (authenticated)
- Games + chat routers are mounted under `/api/*`.

## Configuration

Backend config is loaded from environment variables.

### Required

- **DATABASE_URL**: Postgres connection URL.
  - Example: `postgres://postgres:postgres@localhost:5432/webopoly`
- **JWT_SECRET**: secret used to sign/verify JWTs.

### Required in production

- **CORS_ORIGINS**: comma-separated allowed origins.
  - In this project, production mode enforces this; leaving it empty throws at startup.

### Optional

- **NODE_ENV**: `production` enables stricter behavior (notably CORS requirement).
- **HOST**: default `localhost`.
- **PORT**: default `3000`.
- **COOKIE_SECURE**: defaults to `true` in production and `false` in development.
- **JWT_EXPIRES_IN**: default `1h`.
- **REFRESH_TOKEN_TTL_DAYS**: default `30`.
- **REFRESH_TOKEN_COOKIE_NAME**: default `refresh_token`.

## Run locally (development)

### Prerequisites

- Node.js (project Dockerfiles use Node `25.x`)
- A running Postgres instance

### Start Postgres (Docker)

From `M5/`:

```bash
docker compose -f backend/compose.yaml up -d postgres
```

### Start the backend

From `M5/backend/`:

```bash
npm install
export DATABASE_URL='postgres://postgres:postgres@localhost:5432/webopoly'
export JWT_SECRET='change-me'
export NODE_ENV='development'

npm run dev
```

The server listens on `http://localhost:3000` and mounts routes under `/api`.

## Build and run (production)

From `M5/backend/`:

```bash
npm install
npm run build

export DATABASE_URL='postgres://...'
export JWT_SECRET='...'
export NODE_ENV='production'
export CORS_ORIGINS='https://your-domain.example'
export COOKIE_SECURE='true'

npm start
```

## Run with Docker Compose

The M5 stack’s recommended entrypoint is `M5/compose.yaml`, which runs this backend behind nginx and sets production defaults.

If you run only the backend services via `M5/backend/compose.yaml`, note that:

- The backend is configured for `NODE_ENV=production` there.
- `JWT_SECRET` must be provided via environment.

## Database migrations

Migrations are managed via `node-pg-migrate`.

- Location: `M5/backend/migrations/`
- Baseline schema: `M5/backend/migrations/000_baseline_schema.ts`

From `M5/backend/`:

```bash
export DATABASE_URL='postgres://postgres:postgres@localhost:5432/webopoly'

npm run migrate:up
# npm run migrate:down
# npm run migrate:create -- <name>
```

## Quality scripts

From `M5/backend/`:

```bash
npm run lint
npm run format
```

## Realtime (Socket.IO)

- Clients connect to the same origin as the page and use `/socket.io/*`.
- Authentication is performed via a JWT passed in the Socket.IO handshake (`auth.token` or `Authorization: Bearer ...`).
- The nginx proxy in `M5/nginx/` is configured to forward websocket upgrade headers for `/socket.io/`.
