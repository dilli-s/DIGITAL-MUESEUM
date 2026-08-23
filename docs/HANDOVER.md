# Project Handover

## Purpose
The Digital Museum Platform enables global audiences to explore cultural artifacts virtually while providing a robust CMS for museum administrators to manage collections, stories, and educational interactive materials.

## Architecture & Structure
- **Frontend**: React SPA (`frontend/`) deployed on Vercel.
- **Backend**: Flask API (`backend/`) deployed on Render/Railway.
- **Database**: PostgreSQL hosted on Neon.

## Setup & Deployment
New maintainers should consult:
- `docs/DEVELOPER_GUIDE.md` for local setup.
- `docs/DEPLOYMENT.md` for live hosting configuration.

## Administrative Access
To gain admin access, modify the database `users` table to set `role='admin'` for a registered account, or use the `make_admin.py` utility script provided in the backend directory.

## Maintenance Operations
- **Testing**: Handled by Pytest (backend) and GitHub Actions.
- **Monitoring**: Aggregated via the Admin Analytics Dashboard natively in the platform.
- **Backup/Recovery**: Refer to `docs/BACKUP_AND_RECOVERY.md`.
- **Rollback**: Refer to `docs/ROLLBACK.md`.

## Known Limitations
- Staging environment is not configured as a persistent duplicate cluster; staging tests rely on Neon Branching locally.
- Full E2E UI testing tools (e.g. Playwright/Cypress) are currently absent, relying on component/unit tests instead.

## Future Improvements
- Expand AI Assistant capabilities with a vector database (e.g. pgvector) for deep semantic search queries rather than static prompt mapping.
- Implement Redis caching for the Museum/Object public endpoints to reduce Neon query loads during high traffic.
