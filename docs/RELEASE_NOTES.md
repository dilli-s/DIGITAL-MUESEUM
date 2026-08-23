# Release Notes - v1.0.0

The initial release of the Digital Museum Platform.

## Major Features
- Immersive Virtual Browsing Experience (Museums, Galleries, Exhibitions, Objects).
- Interactive Education (Learning tracks and Activities).
- Personal Dashboard (Bookmarks, History, Progress tracking).
- Artificial Intelligence Assistant for contextual object discovery.
- Fully featured headless CMS for site Administrators.
- QR Code physical museum bridging support.

## Security Improvements
- Rolled out secure HTTP-Only session authentication mechanisms.
- Established rigorous `@admin_required` endpoint validations.
- Enabled Production configuration (Gunicorn, `DEBUG=0`).

## Deployment
- Frontend static distribution via Vercel.
- Dynamic REST operations distributed via cloud Python instances.
- Fully serverless resilient database via Neon PostgreSQL.

## Known Limitations
- Vector similarity search is not yet natively supported in the AI prompts.
- Large video object files are managed via external URLs; direct file uploads are restricted to maintain request size hygiene.
