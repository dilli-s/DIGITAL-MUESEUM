# Digital Museum & Virtual Museum Platform

A comprehensive digital museum platform featuring an interactive frontend and a Flask/PostgreSQL backend.

## Architecture

The project is structured into two completely distinct applications:
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Flask + SQLAlchemy + PostgreSQL

### Data Flow
`React (Frontend)` -> `HTTP / REST API (HTTPS)` -> `Flask (Backend, Gunicorn)` -> `SQLAlchemy` -> `PostgreSQL`

---

## 1. Local Environment Setup

### Environment Variables
You must set up environment variables for both the frontend and backend.

**Backend (`backend/.env`)**
Create this file based on `backend/.env.example`.
```env
FLASK_ENV=development
FLASK_DEBUG=1
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST/DATABASE?sslmode=require
FRONTEND_URL=http://localhost:5173
```
*Note: Set `DATABASE_URL` to the PostgreSQL connection string for your environment. Never commit this file to version control.*

**Frontend (`frontend/.env.local`)**
Create this file based on `frontend/.env.example`.
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## 2. PostgreSQL Setup

1. Create a PostgreSQL database locally or with your preferred host.
2. Copy its connection string.
3. Paste the connection string into your `backend/.env` file under `DATABASE_URL`.
4. Run the database migrations (see below) to create all the necessary museum tables.

---

## 3. Backend Setup & Startup

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a Python virtual environment:
   ```bash
   python3 -m venv .venv
   ```
3. Activate the virtual environment:
   - Linux/macOS: `source .venv/bin/activate`
   - Windows: `.venv\Scripts\activate`
4. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Run database migrations to construct the schema:
   ```bash
   flask db upgrade
   ```
6. Start the Flask server for local development:
   ```bash
   python run.py
   ```

---

## 4. Frontend Setup & Startup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the development server (runs on `http://localhost:5173`):
   ```bash
   npm run dev
   ```

---

## 5. Deployment Overview

### Frontend Deployment
1. Ensure your `frontend/.env.local` variables are configured in your hosting environment.
   - `VITE_API_BASE_URL` should point to your live backend domain via HTTPS.
2. Build commands:
   - Build: `npm run build`
   - Install Command: `npm install`
3. Output Directory: `dist`

### Backend Deployment (e.g. Render, Railway)
1. Deploy the `backend` folder.
2. Configure production Environment Variables securely:
   - `FLASK_ENV=production`
   - `FLASK_DEBUG=0`
   - `DATABASE_URL=<your-postgresql-url>`
   - `FRONTEND_URL=<your-frontend-domain>`
   - `SECRET_KEY=<secure-random-key>`
3. Set the build command:
   ```bash
   pip install -r requirements.txt
   ```
4. Set the Start Command (Using Gunicorn for WSGI):
   ```bash
   gunicorn -w 4 -b 0.0.0.0:5000 "app:create_app()"
   ```
5. Run Migrations: Manually run `flask db upgrade` in the deployed environment's shell or setup a release script before startup.

---

## 6. Operational Documentation

For production and operational guidelines, please refer to the following documentation files located in the `docs/` directory:
- [System Architecture](docs/ARCHITECTURE.md)
- [API Documentation](docs/API.md)
- [Database Guide](docs/DATABASE.md)
- [Developer Guide](docs/DEVELOPER_GUIDE.md)
- [Admin Guide](docs/ADMIN_GUIDE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Backup and Recovery](docs/BACKUP_AND_RECOVERY.md)
- [Rollback Strategy](docs/ROLLBACK.md)
- [Incident Response](docs/INCIDENT_RESPONSE.md)
- [Operations Checklist](docs/OPERATIONS_CHECKLIST.md)
- [Project Handover](docs/HANDOVER.md)
- [Final Release Checklist](docs/FINAL_RELEASE_CHECKLIST.md)
- [Final Test Report](docs/FINAL_TEST_REPORT.md)
- [Release Notes](docs/RELEASE_NOTES.md)

---

## 7. QR Payload Format

The physical museum navigation system relies on scanning QR codes at checkpoints. 
**Format Rules:**
- The QR Code payload must encode the exact **Node UUID string** (e.g., `c2827480-d770-4961-811d-fa77d1e8f19a`).
- **NO URL wrappers**, **NO JSON encoding**, and **NO extra whitespace**.
- The scanner will accept URLs matching the deployment domain (e.g. `https://museum.app/checkpoint/<uuid>`) by stripping everything before the last slash, but encoding the raw UUID directly is highly recommended to prevent domain-migration issues.
- When generating QR codes or seeding the `qr_locations` table, ensure the format matches this exactly to avoid "Checkpoint QR not recognized" errors.

---

## 8. Testing
Execute tests from the backend directory:
```bash
pytest
```
Or use the provided test scripts:
```bash
python test_phase17.py
```
