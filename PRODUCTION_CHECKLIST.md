# Production Checklist

## Environment
- [x] Environment variables separated (development/production)
- [x] `.env` is correctly git-ignored
- [x] `DATABASE_URL` is secured and not exported to frontend
- [x] Secret keys (e.g. `SECRET_KEY`, `JWT_SECRET`, `AI_API_KEY`) are secured

## Database
- [x] Neon PostgreSQL connection verified
- [x] SQLAlchemy pooling configured for Neon (serverless-friendly)
- [x] Migrations run successfully on a clean database

## Backend Security
- [x] WSGI server (Gunicorn) added to `requirements.txt`
- [x] `DEBUG = False` enforced in production
- [x] `MAX_CONTENT_LENGTH` set to 16MB to prevent large payload attacks
- [x] CORS properly locked down to `FRONTEND_URL`
- [x] Security headers added (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Strict-Transport-Security`)
- [x] Authentication and Authorization thoroughly enforced on all routes
- [x] Controlled generic JSON error handlers in place (no stack traces leaked)
- [x] Safe SQLAlchemy queries implemented (No raw SQL, preventing injection)

## Frontend Security & Performance
- [x] No secrets baked into Vite build (only `VITE_API_BASE_URL`)
- [x] Production build completes successfully without errors (`npm run build`)
- [x] `api.js` centralizes fetch logic and gracefully handles network errors
- [x] React safe rendering used (no unsanitized `dangerouslySetInnerHTML`)

## Health & Analytics
- [x] Public health endpoint operational (`/api/health`)
- [x] System health and AI status correctly monitored in Admin Analytics
- [x] Request timing logs configured without exposing sensitive headers

## E2E Testing
- [x] Public user journey validated (browsing, learning, activities, AI)
- [x] Admin content management flow validated (CRUD on all modules)
