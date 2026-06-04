# image-classifier

A full-stack image classification app. Upload an image, get back the top-5 predicted labels with confidence scores. Predictions are saved per users so you can review history.

![Python](https://img.shields.io/badge/Python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-green)
![React](https://img.shields.io/badge/React-Frontend-61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED)
![CI](https://github.com/<user>/<repo>/actions/workflows/ci.yml/badge.svg)

# Project structure

```
image-classifier/
├── backend/
│   ├── app/
│   │   ├── api/routes/
│   │   ├── core/
│   │   ├── db/
│   │   ├── ml/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── tests/
│   │   └── main.py
│   ├── alembic/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── history/
│   │   │   └── upload/
│   │   ├── services/api.ts
│   │   ├── store/authStore.ts
│   │   ├── types/index.ts
│   │   └── styles/globals.css
│   ├── Dockerfile
│   └── nginx.conf
├── .github/workflows/ci.yml
├── docker-compose.yml
└── README.md
```

---

## Quick start

Requires: [Docker Desktop](https://www.docker.com/products/docker-desktop).

```bash
git clone https://github.com/aarongeb/image-classifier.git
cd image-classifier
```

Open `backend/.env` and replace `SECRET_KEY` with a random value:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Then start everything:

```bash
docker compose up
```

The first run downloads PyTorch (~800 MB). After that, starts are fast.

| Service            | URL                        |
| ------------------ | -------------------------- |
| Frontend           | http://localhost:5173      |
| Backend API        | http://localhost:8000      |
| API docs (Swagger) | http://localhost:8000/docs |

---

## Running tests

Tests run against SQLite in-memory and mock the ML model, so no database or GPU is needed.

```bash
cd backend
source venv/bin/activate
pytest -v
```

---

## API reference

| Method | Path                       | Auth | Description                    |
| ------ | -------------------------- | ---- | ------------------------------ |
| POST   | `/api/v1/auth/register`    | No   | Create account, returns JWT    |
| POST   | `/api/v1/auth/login`       | No   | Login, returns JWT             |
| GET    | `/api/v1/auth/me`          | JWT  | Current user profile           |
| POST   | `/api/v1/predictions/`     | JWT  | Classify an image              |
| GET    | `/api/v1/predictions/`     | JWT  | Prediction history (paginated) |
| GET    | `/api/v1/predictions/{id}` | JWT  | Single prediction result       |
| GET    | `/api/v1/health`           | No   | Health check                   |

Full interactive docs available at `/docs` (Swagger) or `/redoc`.

### Example with curl

```bash
# Get a token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Classify an image
curl -X POST http://localhost:8000/api/v1/predictions/ \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@photo.jpg"
```

---

## Deployment

### 1. Database — Neon

1. Sign up at [neon.tech](https://neon.tech)
2. Create a project and copy the **Pooled connection string**
   It looks like: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`

### 2. Backend — Render

1. Sign up at [render.com](https://render.com)
2. New → Web Service → connect your GitHub repo
3. Root directory: `backend` · Environment: `Docker` · Instance type: `Free`
4. Set these environment variables:

```
DATABASE_URL   = <Neon connection string>
SECRET_KEY     = <your generated random key>
ENVIRONMENT    = production
DEBUG          = false
CORS_ORIGINS   = ["https://your-app.vercel.app"]
```

5. After the first deploy, open Render's Shell and run:

```bash
alembic upgrade head
```

> The free tier sleeps after 15 minutes of inactivity (~30 second cold start on next request).
> To keep it warm, set up a free [UptimeRobot](https://uptimerobot.com) monitor pinging
> `https://your-backend.onrender.com/api/v1/health` every 14 minutes.

### 3. Frontend — Vercel

1. Sign up at [vercel.com](https://vercel.com)
2. New Project → import your repo
3. Root directory: `frontend` · Build command: `npm run build` · Output directory: `dist`
4. Add environment variable:

```
VITE_API_URL = https://your-backend.onrender.com
```

5. Deploy. Then go back to Render and update `CORS_ORIGINS` with your Vercel URL.

### 4. CI/CD

Add these secrets to your repo under Settings → Secrets → Actions:

```
RENDER_DEPLOY_HOOK    # Render → Service → Settings → Deploy Hook
VERCEL_TOKEN          # vercel.com/account/tokens
VERCEL_ORG_ID         # Vercel project settings
VERCEL_PROJECT_ID     # Vercel project settings
```

Every push to `main` runs tests, builds both services, and deploys if everything passes.

---

## ML model

The app uses **EfficientNet-B0** pretrained on ImageNet. Weights are downloaded automatically on first start (~21 MB).

|                         |           |
| ----------------------- | --------- |
| Parameters              | 5.3M      |
| Top-1 ImageNet accuracy | 77.1%     |
| Input size              | 224 × 224 |
| Output classes          | 1,000     |
| Inference time (CPU)    | ~80ms     |

Preprocessing pipeline: `Resize(256) → CenterCrop(224) → Normalize(ImageNet μ/σ)`

### Fine-tuning on a custom dataset

```bash
python -m app.ml.train \
  --data_dir ./data/my_dataset \
  --num_classes 10 \
  --epochs 15 \
  --output ./app/ml/weights/custom.pth
```

Expected dataset structure:

```
data/
  train/
    class_a/  *.jpg
    class_b/  *.jpg
  val/
    class_a/  *.jpg
    class_b/  *.jpg
```

---

## Environment variables

### Backend

| Variable                      | Default                     | Notes                                    |
| ----------------------------- | --------------------------- | ---------------------------------------- |
| `DATABASE_URL`                | —                           | Required. PostgreSQL connection string   |
| `SECRET_KEY`                  | —                           | Required. Use 32+ random characters      |
| `ENVIRONMENT`                 | `development`               | Set to `production` when deploying       |
| `DEBUG`                       | `false`                     | Enables SQL echo and verbose logs        |
| `CORS_ORIGINS`                | `["http://localhost:5173"]` | JSON array of allowed origins            |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440`                      | Token lifetime (24 hours)                |
| `MAX_IMAGE_SIZE_MB`           | `10`                        | Upload size limit                        |
| `CONFIDENCE_THRESHOLD`        | `0.1`                       | Minimum confidence to include in results |

### Frontend

| Variable       | Default                 | Notes            |
| -------------- | ----------------------- | ---------------- |
| `VITE_API_URL` | `http://localhost:8000` | Backend base URL |

---

## Common issues

**CORS error in the browser**
`CORS_ORIGINS` must exactly match your frontend URL — no trailing slash, correct protocol.

**Neon SSL error**
Add `?sslmode=require` to the end of `DATABASE_URL`.

**`torch` not found during tests**
Tests mock the classifier and don't need PyTorch installed. For the full app run `pip install -r requirements.txt` — torch is listed there.

**Alembic "relation already exists"**
The database was created before Alembic was run. Fix with `alembic stamp head`, then future migrations work normally.

---

## License

This project is licensed under the [MIT LICENSE]()
