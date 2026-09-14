# Developer Guide

Welcome to the Digital Museum codebase.

## 1. Prerequisites
- Node.js (v20+)
- Python (v3.12)
- Git
- PostgreSQL database

## 2. Environment Setup
Populate both environment files based on the `.example` variants.
- `backend/.env` requires `DATABASE_URL` and `SECRET_KEY`.
- `frontend/.env.local` requires `VITE_API_BASE_URL`.

## 3. Starting the Stack
**Backend**:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
flask db upgrade
python run.py
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

## 4. Testing
Backend tests leverage `pytest`. Run `pytest` within the activated `backend` virtual environment.

## 5. Development Workflow
- Follow feature-branch git structures.
- All pushes and Pull Requests run against GitHub Actions CI (`.github/workflows/ci.yml`).
- Ensure no `.env` files are pushed to GitHub.

## 6. Deployment
Refer to `docs/DEPLOYMENT.md` for steps on promoting local code to your hosting environments.
