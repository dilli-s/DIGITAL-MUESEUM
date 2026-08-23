# Operations Checklist

## Daily Checks
- [ ] Check Vercel deployment status (no failed builds).
- [ ] Ping the public health endpoint: `GET /api/health`.
- [ ] Verify Admin Analytics dashboard loads without database errors.

## Weekly Checks
- [ ] Review backend error logs for repeated 500s or persistent AI API timeouts.
- [ ] Verify Neon dashboard metrics (Connections and Compute usage within limits).
- [ ] Test the frontend Admin CMS by updating a test object and confirming the change is reflected publicly.

## Pre-Deployment Checks
- [ ] Verify GitHub Actions CI passed.
- [ ] Review any database migrations for destructive actions.
- [ ] Confirm Frontend and Backend environment variables are up to date.
- [ ] Confirm Rollback plan is understood.

## Post-Deployment Checks
- [ ] Frontend successfully loads globally.
- [ ] Authentication (Login/Logout) functions correctly.
- [ ] Museum browsing navigation remains unbroken.
- [ ] Test new features deployed.

## Security Checks (Monthly)
- [ ] Audit active Admin accounts via database checks.
- [ ] Review API keys for AI providers and verify unexpected billing spikes.
- [ ] Ensure `.env` and `sqlite` files remain securely excluded from git commits.
