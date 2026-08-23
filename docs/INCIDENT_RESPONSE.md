# Incident Response

## Overview
This document outlines standard procedures for addressing common failure scenarios in production.

## Response Phases
1. **Detect**: Observe via health endpoints (`/api/health`), Vercel/Render logs, or user reports.
2. **Assess**: Is it frontend, backend, or database? Is it causing a full outage or partial failure?
3. **Contain**: Prevent further damage (e.g., rollback deployment, switch off specific features).
4. **Recover**: Execute the recovery plan (Neon PITR, Redeploy).
5. **Verify**: Ensure the application works via smoke tests.
6. **Document**: Record the root cause for future prevention.

---

## Specific Incident Types

### Database Unavailable (Neon Outage)
- **Symptom**: Backend logs 500 errors indicating connection exhaustion or SQLAlchemy failure. Frontend receives 500s.
- **Action**: Check the Neon status page. If the provider is down, wait for resolution. The app will fail gracefully showing error states to users.

### Backend Unavailable (Flask/Render Outage)
- **Symptom**: Vercel frontend logs `Network Error` or CORS issues due to server timeouts. Health endpoint fails.
- **Action**: Check Render/Railway dashboard. Review logs for startup failures (e.g., misconfigured `DATABASE_URL` or missing Python dependency). Restart the service instance. 

### Frontend Unavailable (Vercel Build Failure)
- **Symptom**: Users receive 404s or blank screens.
- **Action**: Revert to the last stable deployment in the Vercel Deployments dashboard immediately.

### AI Provider Failure
- **Symptom**: AI endpoint times out or returns 500.
- **Action**: The application is built to handle AI failures gracefully. The museum browsing experience remains unaffected. No immediate action required unless the provider rotates keys.

### Security Incident (Exposed Secrets)
- **Symptom**: A secret is accidentally committed or logged in production.
- **Action**: 
  1. Instantly rotate/revoke the secret at the provider (Neon/AI).
  2. Update environment variables in the deployment platform (Vercel/Render).
  3. Force restart the backend application to apply new secrets.
  4. Ensure any JWT/Session secrets rotated invalidate active users, requiring them to log in again.
  5. Delete the exposed secret from git history using a thorough scrubber, though immediate revocation is the primary defense.

### Migration Failure
- **Symptom**: `flask db upgrade` crashes, or backend fails to start complaining of missing tables/columns.
- **Action**: Stop deployment. If the deployment was destructive, use Neon's branching to review the database before restoring to the pre-deployment timestamp.

## RTO and RPO
- **Recovery Time Objective (RTO)**: Expected ~15-30 minutes for database PITR or Vercel Rollbacks.
- **Recovery Point Objective (RPO)**: Under 5 minutes leveraging Neon continuous backup logs.
