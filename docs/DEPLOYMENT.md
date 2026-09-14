# Deployment Guide

## 1. Prerequisites
- GitHub repository with the latest code.
- PostgreSQL database.
- Static hosting for the frontend.
- A Python-compatible host for the backend.

## 2. GitHub Setup
- Ensure the repository is connected to your version control.
- Verify that `.env` files are not pushed to the repository.
- GitHub Actions are configured via `.github/workflows/ci.yml` for automated testing.

## 3. PostgreSQL Setup
- Create a PostgreSQL database locally or with your preferred host.
- Copy the provided `DATABASE_URL`. It will look something like `postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require`.
- In the backend environment settings, make sure to replace `postgresql://` with `postgresql+psycopg://` if deploying manually, though the Flask app (`config.py`) is configured to auto-replace this for convenience.

## 4. Backend Deployment
- Connect your GitHub repository to your hosting dashboard.
- Set the Root Directory to `backend/`.
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn -w 4 -b 0.0.0.0:5000 "app:create_app()"`
- Set up the environment variables (see section 5).

## 5. Environment Variables

**Backend:**
- `FLASK_ENV=production`
- `FLASK_DEBUG=0`
- `DATABASE_URL=<your-postgresql-database-url>`
- `SECRET_KEY=<generate-a-secure-random-key>`
- `FRONTEND_URL=https://<your-frontend-domain>`

**Frontend:**
- `VITE_API_BASE_URL=https://<your-backend-domain>/api`

## 6. Migration Process
- After the backend is successfully deployed, connect to its service shell (or use a deployment script).
- Run the migration command to construct the PostgreSQL database:
  ```bash
  flask db upgrade
  ```

## 7. Frontend Deployment
- Connect your GitHub repository to your static hosting provider.
- Select the `frontend/` directory as the Root Directory.
- Framework Preset: Vite
- Build Command: `npm run build`
- Install Command: `npm install`
- Add the Environment Variables (see section 5).

## 8. CORS Configuration
- In the backend environment variables, `FRONTEND_URL` acts as the strict CORS origin. Wildcard `*` origins are disabled for secure authenticated requests.

## 9. API URL Configuration
- The React application communicates with the backend solely through `VITE_API_BASE_URL`.

## 10. Health Check
- Verify backend is alive: `https://<your-backend-domain>/api/health`

## 11. Smoke Testing
- Load the deployed frontend.
- Navigate across Museums and Galleries to verify database reads.
- Register a test account.
- Log in and verify cookie-based authentication.
- Access the Admin Dashboard via the "Analytics & Health" section.

## 12. Rollback
- Refer to `ROLLBACK.md` for detailed rollback instructions if any step fails.
