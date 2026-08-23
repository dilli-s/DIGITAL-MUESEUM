# Backup and Recovery

## 1. What is Backed Up
- **Neon PostgreSQL**: Neon manages continuous automated backups using its branching architecture. It captures all user interactions, object states, history, progress, bookmarks, and administrative content.
- **Application Code**: The Vercel (Frontend) and Render (Backend) deployments are stateless. All deployment source code is backed up via GitHub.

## 2. Where Backups/Recovery Points Exist
- In your [Neon Dashboard](https://neon.tech), under your project's **Branches** section.
- Neon automatically creates restore points for point-in-time recovery (PITR).

## 3. How to Identify the Correct Recovery Point
- Using the Neon branching UI, you can visualize the timeline of your database. Look for the timestamp just before a critical failure occurred (e.g., a destructive admin action or failed deployment).

## 4. How to Create a Safe Recovery Environment
- In Neon, create a new branch from a specific point in time in the past.
- This creates an isolated clone of the database exactly as it was at that timestamp without affecting the current production database.
- Connect your local development backend (`DATABASE_URL` in `.env`) to this new Neon branch to verify the data safely.

## 5. How to Restore (Production)
- If the isolated branch looks correct and data corruption in production is confirmed:
  1. In the Neon dashboard, navigate to the production branch.
  2. Select **Restore** and pick the verified timestamp.
  3. Wait for Neon to complete the point-in-time recovery.

## 6. How to Verify Restored Data
- Log in to the Admin Dashboard.
- Verify Analytics and user tables manually.
- Confirm recent critical data blocks (e.g., Museums/Galleries) load properly.

## 7. Reconnecting Flask
- Restart the Flask instances via your deployment provider (Render/Railway). No environment variables need to change since the production Neon URL remains identical.

## 8. Rollback Precautions
- Do **not** run `flask db downgrade` if a major table corruption occurred; it won't magically restore deleted data rows. Use Neon PITR instead.
- Pause traffic (via Vercel maintenance mode if configured) if a restore takes significant time to avoid data drift.

## 9. Things That Must NEVER be Done against Production
- Never run `drop database` or manual `DROP TABLE` via SQL against the live database URL.
- Never run automated load testing against the live database without branching it first.
- Never manually delete records without utilizing the CMS UI constraints.
