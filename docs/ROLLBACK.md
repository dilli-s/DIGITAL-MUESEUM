# Rollback Strategy

## Frontend Rollback (Vercel)
If a recent frontend deployment introduces critical bugs (e.g. blank screen, broken routing, failed API requests):
1. Navigate to the **Deployments** tab in your Vercel Dashboard.
2. Locate the previous stable deployment in the list.
3. Click the three dots (options) on the right side of the stable deployment and select **Promote to Production** (or **Revert** depending on branch structure).
4. Vercel will instantly swap the routing without requiring a new build.

## Backend Rollback (Render/Railway)
If a recent backend deployment introduces a critical regression (e.g. 500 errors, failed startup):
1. Navigate to your Backend service dashboard.
2. Go to the **Deploys** section.
3. Select the last known good deployment.
4. Click **Rollback** or **Redeploy** to revert the running container to the previous stable state.

## Database Migration Rollback (Neon PostgreSQL)
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
2. Utilize Neon's **Branching & Point-in-Time Recovery**.
3. In the Neon dashboard, navigate to the specific database branch.
4. Select "Restore" to a specific point in time (timestamp prior to the bad deployment).
5. Update your backend code to the stable state and redeploy.

*Warning: Database rollback is sensitive and must always be practiced in a staging environment first.*
