---
name: Managed workflow port conflict
description: Artifact-managed API workflow can conflict with the combined Start application workflow on port 8080.
---

The combined `Start application` workflow owns the API port when it launches the frontend and API together. The artifact-managed API workflow must remain stopped in that setup, or it will fail with `EADDRINUSE` even while the main application is healthy.

**Why:** Replit can add artifact-specific workflows after artifact metadata changes, while the project already has a combined workflow.

**How to apply:** Keep one workflow responsible for port 8080; do not restart the managed API workflow alongside `Start application`.