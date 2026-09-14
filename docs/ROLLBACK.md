# Rollback Strategy

## Frontend Rollback
If a recent frontend deployment introduces critical bugs (e.g. blank screen, broken routing, failed API requests):
1. Navigate to the **Deployments** tab in your hosting dashboard.
2. Locate the previous stable deployment in the list.
3. Click the three dots (options) on the right side of the stable deployment and select **Promote to Production** (or **Revert** depending on branch structure).
4. Promote the stable deployment without requiring a new build.

## Backend Rollback
If a recent backend deployment introduces a critical regression (e.g. 500 errors, failed startup):
1. Navigate to your Backend service dashboard.
2. Go to the **Deploys** section.
3. Select the last known good deployment.
4. Click **Rollback** or **Redeploy** to revert the running container to the previous stable state.

## Database Migration Rollback (PostgreSQL)
If a recent deployment included a flawed database migration:

**Scenario A: Non-Destructive Changes (e.g. Added a column)**
1. Connect to the production backend shell.
2. Execute the Flask downgrade command:
   ```bash
   flask db downgrade
   ```
3. Verify the database state. If successful, deploy the reverted backend codebase.

**Scenario B: Destructive or Complex Changes (e.g. Data corruption)**
1. **DO NOT** attempt a manual `flask db downgrade` if data was irreversibly corrupted.
2. Restore the database from a backup created before the bad deployment.
3. Verify the restored database in an isolated environment.
4. Promote the restored database and redeploy the stable backend.
5. Update your backend code to the stable state and redeploy.

*Warning: Database rollback is sensitive and must always be practiced in a staging environment first.*
