# Delivery Manifest

- `src/` — Angular 19 standalone SPA feature routes and responsive UI.
- `server/` — Express API, service boundary, runtime SQL Server mapping and repository.
- `api/index.js` — Vercel function entry point.
- `sql/discovery.sql` — metadata, keys, indexes and concurrency-token read-only discovery queries.
- `sql/analytics.sql` — parameterized SELECT templates for requested operational reports.
- `openapi/openapi.yaml` — OpenAPI 3.1 REST contract.
- `postman/collection.json` — Postman request collection, no secret variables.
- `docs/` — architecture, data dictionary, workflow, RBAC, test matrix, demo and blockers.
- `tests/` — Node built-in unit tests for helpers and mapping logic.
- `.env.example` — names and safe defaults only; no credentials.

Not included: a real production data dictionary, production credentials, live DB integration report, verified screenshots, schema migrations, audited security configuration, or activated order status writes. These require customer access and approval.
