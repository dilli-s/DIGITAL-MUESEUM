# Final Test Report

| Test | Environment | Expected | Actual | Result |
|---|---|---|---|---|
| Unit (Backend) | Local CI | Pytest functions pass | 3/3 passed | PASS |
| API / Integration | Local CI | Endpoints return expected schemas | Clean JSON responses | PASS |
| Database | PostgreSQL | Migrations sync and persist | Validated integrity | PASS |
| Security | Production | No stack trace leaks, CORS valid | Blocked 401/403 as intended | PASS |
| Frontend | Static hosting | Vite compiles cleanly | Assets minimized and chunked | PASS |
| E2E | Browser | Full visitor flow works | Flow completes successfully | PASS |
| AI | Provider | Provider interprets prompt safely | Handled or fell back cleanly | PASS |
| Recommendations | Local/Prod | Fallbacks applied | Dynamic arrays generated | PASS |
| Analytics | Admin | Aggregation logic scales | Handled via optimized count() | PASS |
| Deployment | Cloud | Services mesh cleanly | Connected successfully | PASS |
| Recovery | Sandbox | PITR restores database | Verified structure | PASS |
