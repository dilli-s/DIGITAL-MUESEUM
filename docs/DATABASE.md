# Database Architecture

## Technology Stack
- **Database Engine**: Neon PostgreSQL (Serverless)
- **ORM**: SQLAlchemy
- **Migrations**: Alembic / Flask-Migrate

## Connection Flow
`Flask (Gunicorn)` -> `psycopg3` -> `SQLAlchemy Connection Pool` -> `Neon DB`
*Note*: The React frontend never communicates directly with the database.

## Schema Overview
- **Users**: Core table for authentication and RBAC (`role='admin'` or `role='user'`).
- **Museums**: Top-level structural entity.
- **Galleries/Exhibitions/Collections**: Structural groupings for Objects, linked back to Museums via Foreign Keys.
- **MuseumObjects**: Primary content entity holding physical object data and media.
- **Educational (LearningResource, Story, Activity)**: Contextual modules linked to Museums/Objects.
- **User Engagement (Bookmark, UserHistory, LearningProgress, ActivityProgress)**: Relational tables associating `user_id` to content elements.

## Migration Strategy
Migrations are managed in `backend/migrations/`.
- **Generate**: `flask db migrate -m "message"`
- **Apply**: `flask db upgrade`
- **Revert**: `flask db downgrade` (Proceed with caution in production. Use Neon's branching instead for serious reverts).

## Performance Considerations
- All foreign keys are inherently indexed.
- Paginators are implemented in SQLAlchemy (`.paginate(page, per_page)`) preventing massive unbounded SELECT queries.
