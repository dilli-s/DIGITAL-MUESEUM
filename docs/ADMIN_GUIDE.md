# Admin Guide

## Accessing the Dashboard
1. Log into your account (must have `role='admin'`).
2. Navigate to `https://<your-domain>/admin`.

## Managing Content (CRUD)
- The Admin Dashboard offers nested lists of Museums, Galleries, Collections, Exhibitions, Objects, Learning Resources, Stories, and Activities.
- You can create, edit, or delete items seamlessly.
- **Important**: Deleting a top-level entity (like a Museum) cascades the deletion to child objects (like its Galleries). Be cautious when deleting.

## System Monitoring & Analytics
Access the **Analytics & Health** tab from the Admin navigation header.
- **Summary**: Live counts of users, items, and platform interactions.
- **Popular Content**: Identifies highest trafficked objects across the platform based on recorded `UserHistory`.
- **Engagement**: Details completion rates for learning resources and activities.
- **Health Diagnostics**: Allows admins to verify database connectivity and AI Configuration without pinging live APIs externally.
