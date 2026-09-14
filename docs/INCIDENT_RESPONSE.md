# Incident Response

## Overview
This document outlines standard procedures for addressing common failure scenarios in production.

## Response Phases
1. **Detect**: Observe via health endpoints (`/api/health`), application logs, or user reports.
2. **Assess**: Is it frontend, backend, or database? Is it causing a full outage or partial failure?
3. **Contain**: Prevent further damage (e.g., rollback deployment, switch off specific features).
4. **Recover**: Execute the recovery plan (restore a database backup, redeploy).
5. **Verify**: Ensure the application works via smoke tests.
6. **Document**: Record the root cause for future prevention.

---

## Specific Incident Types

### Database Unavailable
- **Symptom**: Backend logs 500 errors indicating connection exhaustion or SQLAlchemy failure. Frontend receives 500s.
- **Action**: Check database connectivity and service status. The app will fail gracefully showing error states to users.

### Backend Unavailable
- **Symptom**: Frontend logs `Network Error` or CORS issues due to server timeouts. Health endpoint fails.
- **Action**: Check the backend host dashboard. Review logs for startup failures (e.g., misconfigured `DATABASE_URL` or missing Python dependency). Restart the service instance.

### Frontend Unavailable
- **Symptom**: Users receive 404s or blank screens.
- **Action**: Revert to the last stable deployment in the hosting dashboard immediately.

### AI Provider Failure
- **Symptom**: AI endpoint times out or returns 500.
- **Action**: The application is built to handle AI failures gracefully. The museum browsing experience remains unaffected. No immediate action required unless the provider rotates keys.

### Security Incident (Exposed Secrets)
- **Symptom**: A secret is accidentally committed or logged in production.
- **Action**: 
  1. Instantly rotate/revoke the secret at the affected provider.
  2. Update environment variables in the deployment platforms.
  3. Force restart the backend application to apply new secrets.
  4. Ensure any JWT/Session secrets rotated invalidate active users, requiring them to log in again.
  5. Delete the exposed secret from git history using a thorough scrubber, though immediate revocation is the primary defense.

### Migration Failure
- **Symptom**: `flask db upgrade` crashes, or backend fails to start complaining of missing tables/columns.
- **Action**: Stop deployment. If the deployment was destructive, restore a database backup from before the migration.

## RTO and RPO
- **Recovery Time Objective (RTO)**: Expected ~15-30 minutes for database recovery or deployment rollback.
- **Recovery Point Objective (RPO)**: Depends on the configured database backup schedule.
