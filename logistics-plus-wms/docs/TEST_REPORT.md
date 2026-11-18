# Test Execution Report

**Status:** test plan and package-level utility tests are included. No live enterprise SQL Server, identity gateway, or staging environment was supplied; no integration result is claimed.

## Package checks

| ID | Execution | Expected result | Current package-preparation result | Status | Defect traceability |
|---|---|---|---|---|---|
| U-001 | `npm test` | Utility, mapping, pagination and CSV tests pass | Executed during package assembly: 14 tests passed; rerun after extraction | PASS* | N/A |
| S-001 | `npm run check` | API and script JavaScript syntax valid | Executed during package assembly with Node syntax checks; rerun in CI | PASS* | N/A |
| B-001 | `npm run build` | Angular production bundle compiles | Package registry / Angular compiler not available in build environment | BLOCKED | O-008 |
| I-001 | `npm run schema:discover` with secured `.env` | Metadata-only schema output, no DDL | Requires existing SQL credentials and network | BLOCKED | O-001 |
| SEC-001 | Gateway missing/invalid role and spoofed headers | 503/401/403; proxy strips spoofable values | Gateway not supplied | BLOCKED | O-002 |

`PASS*` means package-level tests and syntax were checked in the authoring environment, not a production build, endpoint integration, or production readiness.

## Integration and acceptance matrix

| ID | Steps | Expected result | Actual result | Status | Defect traceability |
|---|---|---|---|---|---|
| API-001 | GET products on an empty catalog | Empty `data`, total 0, UI empty state | Pending staging execution | NOT RUN | O-001 |
| API-002 | Search SKU/name and valid category together | Correct parameterized filter and pagination | Pending field mapping | NOT RUN | O-001 |
| API-003 | Unknown category ID | Empty page or safe 4xx; no exception leak | Depends on actual category key type | NOT RUN | O-001 |
| API-004 | Invalid numeric category ID | Validation response, not a conversion stack trace | Requires deployed SQL test | NOT RUN | O-001 |
| INV-001 | Zero-stock and same SKU in multiple warehouses | Separate balances; precision retained | Pending schema/data | NOT RUN | O-001 |
| INV-002 | Reserved field absent | Reserved/available marked unavailable, not inferred | Pending schema | NOT RUN | O-001 |
| ORD-001 | Existing, missing and malformed order ID | Detail, generic 404; no internal stack trace | Pending staging | NOT RUN | O-001 |
| SEC-002 | SQL metacharacters in search/status/customer input | Bound values cannot alter SQL structure | Pure utility tests only; full DB test required | NOT RUN | O-002 |
| CSV-001 | Enable export in staging and apply filters | Role-gated CSV honors filters and mitigates formulas | Disabled by default | NOT RUN | O-007 |
| WRITE-001 | PATCH status on an order | 501; no DB mutation | Route is explicitly read-only | NOT RUN | O-003 |
| PERF-001 | Large result set and query-plan review | Within agreed latency; bounded result size | Requires representative staging | BLOCKED | O-004 |
| UI-001 | Mobile viewport, refresh, timeout and rapid filter submit | Responsive layout; clear loading/error state | Browser QA required | NOT RUN | O-008 |
| DASH-001 | Compare dashboard aggregates to verification SQL | Exact match after business definitions approved | Pending schema and signoff | NOT RUN | O-005 |

## Release gate

Run `npm test`, `npm run check`, and `npm run build` in CI. Execute integration cases against a sanitized isolated DB with the read-only principal, review the identity gateway and SQL firewall, record actual results/pass-fail/defect IDs/reviewer/date, and attach CI logs. Do not convert `NOT RUN` or `BLOCKED` into `PASS` without evidence.
