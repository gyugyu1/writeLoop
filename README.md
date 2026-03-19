# English Learning App Starter

Next.js frontend and Spring Boot backend starter for an English learning app.

## Structure

```text
.
├─ apps
│  ├─ frontend       # Next.js app router project
│  └─ backend        # Spring Boot REST API
├─ package.json
└─ tsconfig.base.json
```

## Quick Start

### Frontend

```bash
npm install
npm run dev:frontend
```

### Backend

```bash
cd apps/backend
./gradlew bootRun
# Windows PowerShell: .\gradlew.bat bootRun
```

## Docker

### Development

Copy `.env.dev.example` to `.env` and run:

```bash
docker compose up --build
```

- Nginx entrypoint: `http://localhost`
- Frontend via Nginx: `http://writeloop.localtest.me`
- Backend via Nginx: `http://api.localtest.me`
- Health check via Nginx: `http://api.localtest.me/health`

### Production

Copy `.env.prod.example` to `.env`, fill in the real values, then run:

```bash
docker compose up --build
```

- Frontend: `https://app.writeloop.kr`
- Backend: `https://api.writeloop.kr`
- The nginx config is selected by `NGINX_CONF_PATH`
- MySQL is expected to run outside Docker

## OpenAI Setup

Create a root `.env` file or export environment variables before running the backend.

```bash
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o
OPENAI_API_URL=https://api.openai.com/v1/responses
APP_CORS_ALLOWED_ORIGINS=http://writeloop.localtest.me
SPRING_DATASOURCE_URL=jdbc:mysql://host.docker.internal:3306/writeloop?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
MYSQL_DATABASE=writeloop
MYSQL_USER=writeloop
MYSQL_PASSWORD=writeloop
```

If your MySQL server is not on the same machine as Docker, replace `host.docker.internal` with the database host name or IP.

The backend seeds a few starter prompts automatically when the `prompts` table is empty.

If `OPENAI_API_KEY` is empty, the backend falls back to the local mock feedback logic.

## API Endpoints

- `GET /health`
- `GET /api/prompts`
- `POST /api/feedback`
