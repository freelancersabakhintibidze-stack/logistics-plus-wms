# Logistics Plus LLC — Senior Warehouse Management System

**Version:** 1.0.0 · **Architecture:** Angular standalone SPA + Node.js/Express API + existing Microsoft SQL Server · **Default posture:** read-only, schema-adaptive, no schema modifications.

> This package is a deployable application foundation, not a claim of production validation against Logistics Plus' live database. No production schema export, credentials, identity provider configuration, approved status graph, or test database was supplied. The application does not synthesize operational records and disables write operations until those facts are verified.

## Included

- Responsive Angular workspace: Dashboard, Products, Inventory, Orders, Order Detail, Reports.
- Express REST API with route/controller → business service → repository → SQL Server layering.
- Runtime SQL Server metadata discovery, explicit candidate mapping, parameterized values, quoted discovered identifiers, pooling, timeouts, standardized errors, request telemetry and security headers.
- Vercel configuration for the Angular SPA and Node function.
- Read-only product, inventory, order, order-detail and dashboard endpoints; opt-in, role-gated filtered CSV export.
- OpenAPI API contract and Postman collection.
- Read-only SQL discovery and analytics templates; data dictionary, process and lifecycle diagrams, RBAC matrix, test matrix, demo runbook and open issues.
- No migrations or DDL scripts. The immutable schema policy is preserved.

## Quick start

Requirements: Node.js 20+, npm, approved network connectivity to SQL Server, and a least-privilege database account.

```bash
unzip logistics-plus-wms.zip
cd logistics-plus-wms
cp .env.example .env
# Add local database and gateway settings to .env. Never commit this file.
npm install
npm test
npm run check
npm run schema:discover
npm run build
SERVE_STATIC=true npm start   # serves the built SPA and the API on http://localhost:3000
```

`SERVE_STATIC=true` is a local convenience only. On Vercel the platform serves
`dist/wms` and routes `/api` to the Node function.

The Angular production output is `dist/wms`. The local Express service listens on port 3000 by default. `npm run schema:discover` reads metadata only and prints candidate entity/column mappings for review.

For local-only development before connecting the enterprise identity gateway, set `WMS_AUTH_MODE=disabled` and `NODE_ENV=development`. This bypass is restricted to loopback hostnames. Never use it in Vercel, shared development, staging, or production. For front-end-only iteration run `npx ng serve`, or use the single-process `SERVE_STATIC=true` mode above so the browser and the API share an origin.

## Deploy to Vercel

1. Import the project with the project root at this directory. Use Node.js 20 or newer.
2. Configure build command `npm run build:web` and output directory `dist/wms` (also described in `vercel.json`).
3. Set DB and gateway values from `.env.example` in Project Settings → Environment Variables. Put all secrets in protected environment settings or an approved secret manager. Do not put them in Angular files, git, or screenshots.
4. Configure the trusted enterprise identity gateway to authenticate users, remove inbound copies of identity/proxy headers, and inject `x-wms-proxy-key`, `x-wms-authenticated-user`, and `x-wms-authenticated-role`. The gateway must be the only authorized path to the app. The shared key is an additional trust check, not a substitute for SSO.
5. Use a dedicated SQL account with read-only rights for the required objects. Enable TLS certificate validation; restrict SQL network ingress to approved runtime egress.
6. Start with `WMS_ENABLE_CSV_EXPORT=false`. Review query plans, data classification, per-role export permissions, row cap and audit requirements before changing it.
7. Verify `/api/health`, gateway denial behavior, SPA deep links, staging SQL connectivity, logs, firewall rules, resource limits and monitoring.

**Network warning:** Vercel serverless functions do not automatically provide a private route into a corporate network. If SQL Server is private, use an approved private connectivity architecture or host the API inside the network. Do not make SQL Server publicly accessible just to deploy this UI.

## Environment variables

See `.env.example`. Required SQL configuration: `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`; TLS is enabled by default and certificate trust is disabled by default. `DB_SCHEMA` marks a preferred schema when searching metadata, but ambiguous matches fail closed and must be explicitly resolved. Pool and timeout settings should be tuned with the DBA and hosting limits.

Production protected endpoints require `WMS_AUTH_MODE=proxy`, a strong `WMS_TRUSTED_PROXY_SECRET`, and a real trusted gateway. Without them, protected API routes return 503 rather than manufacturing authentication. The app does not implement SSO, user provisioning, or database privilege administration.

## Runtime schema discovery and assumptions

The API reads existing `INFORMATION_SCHEMA.COLUMNS` metadata, maps a limited set of conventional entity and field aliases, and fails closed on ambiguous primary entity tables. It never creates, alters, or drops database objects. Dynamic SQL identifiers come only from discovered metadata and are delimited; user-supplied values use SQL parameters.

Name matching is still a hypothesis, not proof of production semantics. Review `docs/DATA_DICTIONARY.md`, run `npm run schema:discover` in an approved environment, validate PK/FK/type/nullability/index metadata via `sql/discovery.sql`, and pin any required identifiers explicitly before production. The discovery output contains schema metadata; handle it as restricted operational information.

- Inventory quantity, reserved quantity and available balance appear only when corresponding fields are discovered. No dynamic reservation logic is inferred.
- Dashboard pending counts use a provisional text match over existing status values (`pending`, `new`, `open`, `processing`). Confirm actual business states.
- Dashboard low-stock count uses provisional threshold 10. Confirm policy and per-warehouse semantics.
- Header order total is displayed if found. Order details expose a line-item sum and reconciliation flag when quantity/price relationships are mapped.
- Daily trend and top-products report endpoints return an explicit 501 until timestamp, timezone and FK semantics are approved.
- Order PATCH status changes return 501 for all users until the existing schema and approved lifecycle support safe transitions and concurrency handling.

## API conventions

Collection endpoints are plural nouns and use `GET` for reads. Pagination is 1-indexed offset/page-based (`page`, `pageSize`, max 100, default 20), with a stable sort and response `pagination` object. Filters are query parameters. Detail reads use `GET /api/orders/{id}`. `PATCH` is the appropriate future partial update method for an order status but is deliberately disabled. Errors use `{ "error": { "code": "...", "message": "..." } }`; server stacks and credentials are never returned. CSV export is opt-in, role-gated, bounded to 100 rows per request and formula-injection mitigated.

Full endpoint schemas are in `openapi/openapi.yaml`; a no-secret Postman collection is in `postman/collection.json`.

## Roles and security boundary

| Role | Capabilities in this application |
|---|---|
| Operator | Read catalog, inventory, orders, dashboard; export only when explicitly enabled and gateway grants the role |
| Supervisor | Same reads/optional export; status endpoint is present but disabled (501) |
| System administrator | Same application reads; gateway/identity governance is external; no schema or SQL write privilege is granted |

The gateway must authenticate identity, strip untrusted client-supplied headers and inject trusted values. `operator`/`supervisor`/`admin` application roles do not grant database rights. Use a read-only DB account. Request metrics go to platform stdout; no new audit table is created. Add a centrally managed audit sink, rate limits and access review before production.

## Project layout

```text
api/                       Vercel function entry point only
server/                    Express app, auth, services, repositories, SQL Server adapter
src/app/core/               Typed API client and contracts
src/app/pages/              Dashboard, products, inventory, orders, detail, reports
src/app/shared/              Shared state and page-header components
scripts/                     Read-only schema discovery CLI
sql/                         Metadata discovery and parameterized analytics templates
openapi/                     OpenAPI 3.1 contract
postman/                     Postman collection without credentials
docs/                        Architecture, data dictionary, lifecycle, RBAC, tests, runbook
```

## Testing and current verification status

Run `npm test`, `npm run check`, `npm run build`, and then the staging integration matrix in `docs/TEST_REPORT.md`. Unit coverage targets query helper boundaries, safe SQL identifier handling, mapping behavior, paging and CSV formula protection. Automated utility tests do not replace SQL Server integration tests, Angular compilation, visual/browser QA, load tests or security assessment.

Build and integration results must be generated in the deployment CI environment because external package registries, enterprise SQL Server and the identity gateway are not available in this delivery environment. Do not mark blocked or unrun cases as passing.

## Acceptance demo

1. Sign in through enterprise SSO/gateway and open Dashboard. Reconcile order counts and totals using approved read-only SQL verification queries.
2. Search for a known SKU/name, combine category filtering, sort and paginate. Compare results with direct read-only SQL.
3. Inspect a known SKU at multiple warehouses. Confirm precise balances and whether reserved/available values exist in the actual schema.
4. Locate an order by status, customer and date; inspect details and compare header amount to line totals.
5. Demonstrate that a status update returns 501. Do not represent it as a live workflow feature until the state graph, cancellation invariant and transaction/concurrency rules are approved.
6. Review schema mappings and reports. Enable CSV only after permissions and sensitive-data handling are approved.
7. Take sanitized UI screenshots in staging only; omit customer data, credentials, hostnames and connection strings.

## Production blockers

1. No production schema snapshot or verified table/column/PK/FK mapping.
2. No configured identity provider/gateway, trust-boundary evidence, role provisioning or audit contract.
3. No approved order transition graph, canceled-order invariant, write authorization or existing concurrency/version token.
4. No agreed low-stock threshold, pending-state set, currency, business timezone or order-total authority.
5. No staging database, representative sanitized records, execution plans, load tests or integration report.
6. SQL Server network accessibility from the selected hosting runtime requires platform/security review.

Do not call this package production-ready until those owners approve the mapping, security boundary, tests and runtime connectivity.
