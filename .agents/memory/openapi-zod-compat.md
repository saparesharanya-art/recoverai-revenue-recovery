---
name: OpenAPI and Zod compatibility
description: The workspace uses Zod 3, so generated validation schemas must avoid OpenAPI integer output that emits zod.int().
---

Use numeric OpenAPI schemas for IDs and counts when generating contracts in this workspace, unless the Zod catalog version is upgraded together with the generator.

**Why:** The current generator emits `zod.int()` for OpenAPI integer types, but the pinned Zod 3 package does not expose that helper and breaks library typechecking after codegen.

**How to apply:** If a contract needs integer semantics, enforce integer values in the route/business layer or upgrade the shared Zod dependency and regenerate all clients in one change.