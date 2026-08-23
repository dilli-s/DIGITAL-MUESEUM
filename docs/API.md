# API Documentation

The REST API serves as the bridge between the React frontend and Neon database. 
All requests must be prefixed with `/api`.
Authentication relies on secure cookies; authenticated routes require an active session.

## 1. Authentication
- **Register**: `POST /auth/register` - Create a new user.
- **Login**: `POST /auth/login` - Authenticate and create a session.
- **Logout**: `POST /auth/logout` - Invalidate active session.
- **Current User**: `GET /auth/me` - Fetch the authenticated user's profile.

## 2. Museum Hierarchy (Public API)
- **Museums**: `GET /museums` | `GET /museums/<id>`
- **Galleries**: `GET /galleries` | `GET /galleries/<id>`
- **Collections**: `GET /collections` | `GET /collections/<id>`
- **Exhibitions**: `GET /exhibitions` | `GET /exhibitions/<id>`
- **Objects**: `GET /objects` | `GET /objects/<id>`

## 3. Educational Context
- **Learning**: `GET /learning/<id>`
- **Stories**: `GET /stories/<id>`
- **Activities**: `GET /activities/<id>`

## 4. User Interactions (Authenticated)
- **Bookmarks**: 
  - `GET /bookmarks`
  - `POST /bookmarks`
  - `DELETE /bookmarks/<id>`
- **Progress Tracking**: 
  - `POST /progress/learning`
  - `POST /activities/complete`
- **History Tracking**:
  - `GET /history`
  - `POST /history`

## 5. AI & Recommendations (Authenticated)
- **AI Museum Assistant**: `POST /ai/chat` (Payload: `{"message": "string", "context": "object_id"}`)
- **Recommendations**: `GET /recommendations`

## 6. Admin Endpoints (Secured via `@admin_required`)
- **CRUD Operations**: Handled via `POST /api/admin/<entity>`, `PUT /api/admin/<entity>/<id>`, `DELETE /api/admin/<entity>/<id>`.
- **Analytics**: `GET /admin/analytics/summary`, `GET /admin/analytics/trends`, `GET /admin/analytics/popular-content`.
- **Health Verification**: `GET /admin/health`.

## 7. Public Health
- **Check**: `GET /health` - Returns `{"status": "ok"}`.
