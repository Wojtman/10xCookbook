# (Deprecated) Session Endpoints Plan

Anonymous sessions and migration flows are no longer supported. All application content and operations require authentication. This document is retained for historical context and should not be implemented. 

Key changes under the authenticated-only model:
- No `/api/sessions/anonymous` or `/api/sessions/migrate` endpoints.
- No anonymous draft storage or migration logic.
- All endpoints (AI parse, image upload, CRUD) require a valid authenticated session.

