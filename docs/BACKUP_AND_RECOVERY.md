# Backup and Recovery

## 1. What is Backed Up
- **PostgreSQL**: Scheduled database backups capture all user interactions, object states, history, progress, bookmarks, and administrative content.
- **Application Code**: Frontend and backend deployments are stateless. All deployment source code is backed up via GitHub.

## 2. Where Backups/Recovery Points Exist
- In the database provider's backup and recovery console.
- The configured backup schedule determines available restore points.

## 3. How to Identify the Correct Recovery Point
- Use the database backup timeline to identify the point just before a critical failure occurred (e.g., a destructive admin action or failed deployment).

## 4. How to Create a Safe Recovery Environment
- Create an isolated restore or clone from a specific point in time in the past.
- Verify the restored data without affecting the current production database.
- Connect your local development backend (`DATABASE_URL` in `.env`) to the isolated database to verify the data safely.

## 5. How to Restore (Production)
- If the isolated branch looks correct and data corruption in production is confirmed:
  1. In the database console, select the verified backup.
  2. Restore the production database or promote the verified recovery instance.
  3. Wait for the database recovery to complete.

## 6. How to Verify Restored Data
- Log in to the Admin Dashboard.
- Verify Analytics and user tables manually.
- Confirm recent critical data blocks (e.g., Museums/Galleries) load properly.

## 7. Reconnecting Flask
- Restart the Flask instances via your deployment provider. Verify `DATABASE_URL` still points to the restored database.

## 8. Rollback Precautions
- Do **not** run `flask db downgrade` if a major table corruption occurred; it won't magically restore deleted data rows. Use a database backup instead.
- Pause traffic if a restore takes significant time to avoid data drift.

## 9. Things That Must NEVER be Done against Production
- Never run `drop database` or manual `DROP TABLE` via SQL against the live database URL.
- Never run automated load testing against the live database without branching it first.
- Never manually delete records without utilizing the CMS UI constraints.
